import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlanRecordSchema } from 'shared';
import { createPlanStore } from './plan-store.js';
import { migrate } from './migrate.js';
import { migratedClient, realClient } from '../../test/real-db.js';
import { onboardingFixture, planFixture } from '../../test/fixtures.js';

// Task 1.2 (coach-plan-week-and-delete): every plan has a week (migration 002 and the store), and a plan can be deleted.
const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));
const WEEK = '2026-11-23';

describe('migration 002: the week of earlier plans', () => {
  let db: Awaited<ReturnType<typeof realClient>>;
  let onlyFirst: string;
  beforeEach(async () => {
    db = await realClient();
    onlyFirst = mkdtempSync(join(tmpdir(), 'mig-'));
    copyFileSync(join(MIGRATIONS, '001_init.sql'), join(onlyFirst, '001_init.sql'));
  });
  afterEach(async () => {
    rmSync(onlyFirst, { recursive: true, force: true });
    await db.cleanup();
  });

  // Plans made before this change, created at exact moments (a plan row as 001 knew it: no week).
  const old = (goal: string, createdAt: string) =>
    db.client.query('insert into plans(plan, onboarding, created_at) values ($1, $2, $3)', [
      JSON.stringify({ ...planFixture, recommendations: [goal] }),
      JSON.stringify(onboardingFixture),
      createdAt,
    ]);

  it('gives each earlier plan the Monday of the week it was created in, and changes nothing else @spec(plan-week/every-plan-has-a-week/earlier-plans-get-a-week)', async () => {
    await migrate(db.client, onlyFirst); // the database as it was before this change
    await old('thursday', '2026-11-26T10:00:00Z'); // a Thursday: the week of 23 Nov
    await old('sunday night', '2026-11-29T23:30:00Z'); // a Sunday just before Monday: still the week of 23 Nov
    await old('monday midnight', '2026-11-30T00:00:00Z'); // the first moment of the next week
    await old('new year', '2027-01-01T08:00:00Z'); // a Friday: the week of 28 Dec 2026
    await old('leap day', '2024-02-29T12:00:00Z'); // a Thursday: the week of 26 Feb 2024
    const before = (await db.client.query('select id, plan, onboarding, created_at from plans order by id')).rows;

    const applied = await migrate(db.client, MIGRATIONS);
    expect(applied).toEqual(['002_plan_week.sql']);

    const { rows } = await db.client.query(
      "select id, plan->'recommendations'->>0 as goal, to_char(week_start, 'YYYY-MM-DD') as week from plans order by id",
    );
    expect(rows.map((r) => [r.goal, r.week])).toEqual([
      ['thursday', '2026-11-23'],
      ['sunday night', '2026-11-23'],
      ['monday midnight', '2026-11-30'],
      ['new year', '2026-12-28'],
      ['leap day', '2024-02-26'],
    ]);
    const after = (await db.client.query('select id, plan, onboarding, created_at from plans order by id')).rows;
    expect(after).toEqual(before); // every plan, its onboarding and its creation time are unchanged
  });

  it('keeps a row inserted the old way working, with the Monday of the current week as its default', async () => {
    await migrate(db.client, MIGRATIONS);
    // The old server's insert names no week: it must still succeed during the deploy and after a rollback.
    await db.client.query('insert into plans(plan, onboarding) values ($1, $2)', [JSON.stringify(planFixture), JSON.stringify(onboardingFixture)]);
    const { rows } = await db.client.query(
      "select to_char(week_start, 'YYYY-MM-DD') as week, to_char(date_trunc('week', now() at time zone 'UTC'), 'YYYY-MM-DD') as expected from plans",
    );
    expect(rows[0]?.week).toBe(rows[0]?.expected);
  });

  it('does not let a plan be saved without a week', async () => {
    await migrate(db.client, MIGRATIONS);
    await expect(db.client.query('insert into plans(plan, onboarding, week_start) values ($1, $2, null)', [JSON.stringify(planFixture), JSON.stringify(onboardingFixture)])).rejects.toThrow(/null value/);
  });
});

describe('plan store: the week', () => {
  let db: Awaited<ReturnType<typeof migratedClient>>;
  beforeEach(async () => { db = await migratedClient(); });
  afterEach(() => db.cleanup());
  const realTz = process.env.TZ;
  afterEach(() => { if (realTz === undefined) delete process.env.TZ; else process.env.TZ = realTz; });

  it('saves a plan with its week and returns it on the record and on latest() @spec(plan-week/every-plan-has-a-week/week-is-saved-and-returned)', async () => {
    const store = createPlanStore(db.client);
    const saved = await store.save(planFixture, onboardingFixture, WEEK);
    expect(saved.weekStart).toBe(WEEK);
    expect(PlanRecordSchema.safeParse(saved).success).toBe(true);
    expect((await store.latest())?.weekStart).toBe(WEEK);
  });

  it.each([['America/Los_Angeles', 480], ['Pacific/Auckland', -780], ['Asia/Kolkata', -330], ['UTC', 0]])('reads the week as the same date when the server runs in %s @spec(plan-week/every-plan-has-a-week/the-date-does-not-move-with-the-servers-time-zone)', async (tz, offsetMinutes) => {
    const store = createPlanStore(db.client);
    process.env.TZ = tz;
    expect(new Date(2026, 10, 23).getTimezoneOffset(), 'the time zone really changed in this process').toBe(offsetMinutes);
    await store.save(planFixture, onboardingFixture, WEEK);
    expect((await store.latest())?.weekStart).toBe(WEEK);
    await store.save(planFixture, onboardingFixture, '2026-12-28'); // a year-end week
    expect((await store.latest())?.weekStart).toBe('2026-12-28');
  });

  it('refuses a week that is not a date and saves nothing', async () => {
    const store = createPlanStore(db.client);
    for (const bad of ['next monday', '2026-13-40', '', '2026-11-23T00:00:00Z', '2026-11-24']) await expect(store.save(planFixture, onboardingFixture, bad), bad).rejects.toThrow();
    expect((await db.client.query('select count(*)::int as n from plans')).rows[0]?.n).toBe(0);
  });

  it('keeps the newest plan first whatever the weeks are (the order is by creation, not by week)', async () => {
    const store = createPlanStore(db.client);
    await store.save({ ...planFixture, recommendations: ['week of 30 Nov'] }, onboardingFixture, '2026-11-30');
    const later = await store.save({ ...planFixture, recommendations: ['week of 23 Nov'] }, onboardingFixture, '2026-11-23');
    expect((await store.latest())?.id).toBe(later.id);
  });
});

describe('plan store: delete', () => {
  let db: Awaited<ReturnType<typeof migratedClient>>;
  beforeEach(async () => { db = await migratedClient(); });
  afterEach(() => db.cleanup());

  it('removes the row and says so, and says no the second time', async () => {
    const store = createPlanStore(db.client);
    const a = await store.save({ ...planFixture, recommendations: ['a'] }, onboardingFixture, WEEK);
    const b = await store.save({ ...planFixture, recommendations: ['b'] }, onboardingFixture, WEEK);
    const c = await store.save({ ...planFixture, recommendations: ['c'] }, onboardingFixture, WEEK);
    expect(await store.delete(c.id)).toBe(true);
    expect(await store.delete(c.id)).toBe(false);
    expect(await store.delete(999_999)).toBe(false);
    const { rows } = await db.client.query('select id from plans order by id');
    expect(rows.map((r) => Number(r.id))).toEqual([a.id, b.id]); // the others are untouched
    expect((await store.latest())?.id).toBe(b.id); // the next newest is the latest again
  });

  it('leaves the table empty and latest() null after the only plan is deleted', async () => {
    const store = createPlanStore(db.client);
    const only = await store.save(planFixture, onboardingFixture, WEEK);
    expect(await store.delete(only.id)).toBe(true);
    expect(await store.latest()).toBeNull();
  });

  it('lets exactly one of two simultaneous deletions win, on two separate connections @spec(plan-deletion/deleting-a-plan/two-deletions-at-once)', async () => {
    const store = createPlanStore(db.client);
    const only = await store.save(planFixture, onboardingFixture, WEEK);
    const pool = db.pool(2);
    const [x, y] = await Promise.all([createPlanStore(pool).delete(only.id), createPlanStore(pool).delete(only.id)]);
    expect([x, y].sort()).toEqual([false, true]);
  });
});
