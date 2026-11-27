import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanRecordSchema, type Plan } from 'shared';
import { createPlanStore } from './plan-store.js';
import { migratedClient } from '../../test/real-db.js';
import { onboardingFixture, planFixture } from '../../test/fixtures.js';

const WEEK = '2026-11-23'; // a Monday
let db: Awaited<ReturnType<typeof migratedClient>>;
beforeEach(async () => {
  seeded = 0;
  db = await migratedClient();
});
afterEach(() => db.cleanup());

const count = async () => (await db.client.query('select count(*)::int as n from plans')).rows[0]?.n;
// Seeds a row with an exact created_at, for the ordering tests. One plan per week (migration 003): each seed names its own week.
let seeded = 0;
const seed = (goal: string, createdAt: string) =>
  db.client.query('insert into plans(plan, onboarding, created_at, week_start) values ($1, $2, $3, $4) returning id', [
    JSON.stringify({ ...planFixture, recommendations: [goal] }),
    JSON.stringify(onboardingFixture),
    createdAt,
    new Date(Date.UTC(2026, 9, 5 + 7 * seeded++)).toISOString().slice(0, 10),
  ]);

describe('plan store: save', () => {
  it('saves a plan together with its onboarding and returns the record @spec(plan-storage/save-only-valid-plans/valid-plan-is-saved-with-its-onboarding)', async () => {
    const store = createPlanStore(db.client);
    const record = await store.save(planFixture, onboardingFixture, WEEK);

    expect(PlanRecordSchema.safeParse(record).success).toBe(true);
    expect(record.plan).toEqual(planFixture);
    expect(record.onboarding).toEqual(onboardingFixture);
    expect(Number.isInteger(record.id)).toBe(true);
    expect(Math.abs(Date.now() - Date.parse(record.createdAt))).toBeLessThan(60_000);

    const { rows } = await db.client.query('select plan, onboarding from plans');
    expect(rows).toEqual([{ plan: planFixture, onboarding: onboardingFixture }]);
  });

  it('saves nothing when the plan or the onboarding is not valid @spec(plan-storage/save-only-valid-plans/invalid-plan-is-not-saved)', async () => {
    // Structural validity only: the business rules (seven days and so on) are validateCoachResponse in group 4,
    // and "store empty after any coach failure" is tested through the endpoint in task 5.1.
    const store = createPlanStore(db.client);
    await expect(store.save({ days: 'none' } as unknown as Plan, onboardingFixture, WEEK)).rejects.toThrow();
    await expect(store.save(planFixture, { goal: 'only a goal' } as never, WEEK)).rejects.toThrow();
    expect(await count()).toBe(0);
  });
});

describe('plan store: latest', () => {
  it('returns null when no plan has been saved @spec(plan-storage/reload-without-a-coach-call/no-plan-yet)', async () => {
    expect(await createPlanStore(db.client).latest()).toBeNull();
  });

  it('returns the plan with the highest creation time, whatever the insert order @spec(plan-storage/reload-without-a-coach-call/latest-plan-wins)', async () => {
    await seed('middle', '2026-11-08T10:00:00Z');
    await seed('newest', '2026-11-09T10:00:00Z');
    await seed('oldest', '2026-11-07T10:00:00Z');
    const latest = await createPlanStore(db.client).latest();
    expect(latest?.plan.recommendations).toEqual(['newest']);
    expect(latest?.createdAt).toBe('2026-11-09T10:00:00.000Z');
  });

  it('breaks a tie in creation time with the highest id @spec(plan-storage/reload-without-a-coach-call/latest-plan-wins)', async () => {
    const same = '2026-11-08T10:00:00Z';
    await seed('first', same);
    const { rows } = await seed('second', same);
    await seed('earlier', '2026-11-01T10:00:00Z'); // highest id, but older
    const latest = await createPlanStore(db.client).latest();
    expect(latest?.plan.recommendations).toEqual(['second']);
    expect(latest?.id).toBe(Number(rows[0]?.id));
  });

  it('after two saves through the store, returns the second and keeps the first stored', async () => {
    const store = createPlanStore(db.client);
    await store.save({ ...planFixture, recommendations: ['one'] }, onboardingFixture, '2026-11-16');
    const second = await store.save({ ...planFixture, recommendations: ['two'] }, onboardingFixture, WEEK);
    expect((await store.latest())?.id).toBe(second.id);
    expect(await count()).toBe(2);
  });
});

// Task 1.2 (coach-plan-history): one plan per week, saved as an upsert, and the list.
describe('plan store: one plan per week', () => {
  const planOf = (note: string): Plan => ({ ...planFixture, recommendations: [note] });
  const onboardingOf = (goal: string) => ({ ...onboardingFixture, goal });
  const rowOf = async (week: string) => (await db.client.query("select * from plans where week_start = $1", [week])).rows;

  it('adds a row for a week that has no plan @spec(plan-week/one-plan-per-week/the-first-plan-of-a-week-is-added)', async () => {
    const store = createPlanStore(db.client);
    await store.save(planOf('a'), onboardingFixture, '2026-11-16');
    expect(await count()).toBe(1);
    await store.save(planOf('b'), onboardingFixture, WEEK);
    expect(await count()).toBe(2);
  });

  it('replaces the plan and onboarding of a stored week, keeps the id and moves the creation time @spec(plan-week/one-plan-per-week/rebuilding-a-week-replaces-its-plan)', async () => {
    await db.client.query("insert into plans(plan, onboarding, week_start, created_at) values ($1, $2, $3, '2026-11-01T10:00:00Z')", [
      JSON.stringify(planOf('old')), JSON.stringify(onboardingOf('old goal')), WEEK,
    ]);
    const before = (await rowOf(WEEK))[0];
    const store = createPlanStore(db.client);
    const record = await store.save(planOf('new'), onboardingOf('new goal'), WEEK);

    expect(await count()).toBe(1);
    expect(record.id).toBe(Number(before.id));
    expect(record.plan.recommendations).toEqual(['new']);
    expect(record.onboarding.goal).toBe('new goal');
    expect(Date.parse(record.createdAt)).toBeGreaterThan(Date.parse('2026-11-01T10:00:00Z'));
    expect(Math.abs(Date.now() - Date.parse(record.createdAt))).toBeLessThan(60_000); // the time of the rebuild
    const [row] = await rowOf(WEEK);
    expect(row.plan).toEqual(planOf('new'));
    expect(row.onboarding).toEqual(onboardingOf('new goal'));
    expect(row.created_at.toISOString()).toBe(record.createdAt); // what was returned is what is stored
    expect(PlanRecordSchema.safeParse(record).success).toBe(true);
  });

  it('leaves the plans of other weeks as they were @spec(plan-week/one-plan-per-week/other-weeks-are-untouched)', async () => {
    const store = createPlanStore(db.client);
    await store.save(planOf('16'), onboardingFixture, '2026-11-16');
    await store.save(planOf('23'), onboardingFixture, WEEK);
    const before = (await db.client.query('select * from plans order by id')).rows;
    await store.save(planOf('30'), onboardingFixture, '2026-11-30'); // a new week
    const others = () => db.client.query('select * from plans where week_start <> $1 order by id', ['2026-11-30']);
    expect((await others()).rows).toEqual(before);
    await store.save(planOf('30 again'), onboardingFixture, '2026-11-30'); // a rebuilt week
    expect((await others()).rows).toEqual(before);
    expect((await rowOf('2026-11-30')).length).toBe(1);
  });

  it('leaves exactly one plan when two builds of one week finish at the same time, on two connections @spec(plan-week/one-plan-per-week/two-builds-at-once-leave-one-plan)', async () => {
    const pool = db.pool(2);
    const [x, y] = await Promise.all([
      createPlanStore(pool).save(planOf('x'), onboardingFixture, WEEK),
      createPlanStore(pool).save(planOf('y'), onboardingFixture, WEEK),
    ]);
    expect(await count()).toBe(1);
    expect(x.id).toBe(y.id);
    const [row] = await rowOf(WEEK);
    expect(['x', 'y']).toContain(row.plan.recommendations[0]); // one of the two that were built
  });

  it('lists every plan by week, oldest first, whatever the order they were saved or made in', async () => {
    const store = createPlanStore(db.client);
    expect(await store.list()).toEqual([]);
    const c = await store.save(planOf('30'), onboardingFixture, '2026-11-30');
    const a = await store.save(planOf('16'), onboardingFixture, '2026-11-16');
    const b = await store.save(planOf('23'), onboardingFixture, WEEK);
    await store.save(planOf('16 again'), onboardingFixture, '2026-11-16'); // newest made, oldest week
    const list = await store.list();
    expect(list.map((r) => r.weekStart)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    expect(list.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect(list[0]?.plan.recommendations).toEqual(['16 again']);
    for (const r of list) expect(PlanRecordSchema.safeParse(r).success).toBe(true);
  });
});
