import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';
import { realClient } from '../../test/real-db.js';
import { onboardingFixture, planFixture } from '../../test/fixtures.js';

// Task 1.1 (coach-plan-history): migration 003 keeps one plan per week, copies what it removes to plans_merged, and
// makes the database refuse a second plan for a week.
const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));
const FILE_003 = '003_one_plan_per_week.sql';

describe('migration 003: one plan per week', () => {
  let db: Awaited<ReturnType<typeof realClient>>;
  let beforeDir: string;
  beforeEach(async () => {
    db = await realClient();
    // The database as production has it today: migrations 001 and 002 only.
    beforeDir = mkdtempSync(join(tmpdir(), 'mig3-'));
    for (const f of ['001_init.sql', '002_plan_week.sql']) copyFileSync(join(MIGRATIONS, f), join(beforeDir, f));
    await migrate(db.client, beforeDir);
  });
  afterEach(async () => {
    rmSync(beforeDir, { recursive: true, force: true });
    await db.cleanup();
  });

  const add = async (goal: string, week: string, createdAt: string) =>
    Number(
      (
        await db.client.query(
          'insert into plans(plan, onboarding, week_start, created_at) values ($1, $2, $3, $4) returning id',
          [JSON.stringify({ ...planFixture, recommendations: [goal] }), JSON.stringify(onboardingFixture), week, createdAt],
        )
      ).rows[0]?.id,
    );
  const goals = async (table: string) =>
    (await db.client.query(`select plan->'recommendations'->>0 as goal from ${table} order by id`)).rows.map((r) => r.goal);
  const snapshot = async (table: string) => (await db.client.query(`select * from ${table} order by id`)).rows;

  it('keeps the newest plan of a week and the single plan of another, and copies the removed ones @spec(plan-week/one-plan-per-week/the-migration-keeps-the-newest-plan-of-a-week)', async () => {
    // The newest plan has the LOWEST id on purpose: "newest" must mean creation time, not id.
    await add('newest', '2026-11-16', '2026-11-20T12:00:00Z');
    await add('oldest', '2026-11-16', '2026-11-17T08:00:00Z');
    await add('middle', '2026-11-16', '2026-11-18T08:00:00Z');
    await add('other week', '2026-11-23', '2026-11-24T08:00:00Z');
    const keptBefore = (await db.client.query("select * from plans where plan->'recommendations'->>0 in ('newest', 'other week') order by id")).rows;
    const removedBefore = (await db.client.query("select * from plans where plan->'recommendations'->>0 in ('oldest', 'middle') order by id")).rows;

    expect(await migrate(db.client, MIGRATIONS)).toEqual([FILE_003]);

    expect(await goals('plans')).toEqual(['newest', 'other week']);
    expect(await snapshot('plans')).toEqual(keptBefore); // unchanged content, ids and creation times
    expect(await snapshot('plans_merged')).toEqual(removedBefore); // exactly the removed rows, whole
  });

  it('breaks a tie in creation time with the highest id @spec(plan-week/one-plan-per-week/the-migration-breaks-a-tie-with-the-highest-id)', async () => {
    await add('first', '2026-11-16', '2026-11-18T08:00:00Z');
    const second = await add('second', '2026-11-16', '2026-11-18T08:00:00Z');
    await migrate(db.client, MIGRATIONS);
    expect(await goals('plans')).toEqual(['second']);
    expect((await db.client.query('select id from plans')).rows.map((r) => Number(r.id))).toEqual([second]);
    expect(await goals('plans_merged')).toEqual(['first']);
  });

  it('changes nothing when its SQL is executed a second time (the runner never does) @spec(plan-week/one-plan-per-week/the-migration-can-run-again)', async () => {
    await add('old', '2026-11-16', '2026-11-17T08:00:00Z');
    await add('new', '2026-11-16', '2026-11-18T08:00:00Z');
    await add('other', '2026-11-23', '2026-11-24T08:00:00Z');
    await migrate(db.client, MIGRATIONS);
    const plans = await snapshot('plans');
    const merged = await snapshot('plans_merged');

    await db.client.query(readFileSync(join(MIGRATIONS, FILE_003), 'utf8')); // by hand: the file itself, again
    expect(await snapshot('plans')).toEqual(plans);
    expect(await snapshot('plans_merged')).toEqual(merged);
    expect(await migrate(db.client, MIGRATIONS)).toEqual([]); // and the runner has nothing left to apply
  });

  it('refuses a second plan for a week once migrated, and still accepts a plan for another week', async () => {
    await add('a', '2026-11-16', '2026-11-17T08:00:00Z');
    await migrate(db.client, MIGRATIONS);
    await expect(add('b', '2026-11-16', '2026-11-18T08:00:00Z')).rejects.toThrow(/plans_week_start_key|duplicate key/);
    await expect(add('c', '2026-11-23', '2026-11-18T08:00:00Z')).resolves.toBeGreaterThan(0);
  });

  it('works on an empty table and on one with no duplicates (nothing is copied)', async () => {
    await migrate(db.client, MIGRATIONS);
    expect(await snapshot('plans_merged')).toEqual([]);
  });

  it('copies the plan_merged rows with the same columns as plans', async () => {
    await add('old', '2026-11-16', '2026-11-17T08:00:00Z');
    await add('new', '2026-11-16', '2026-11-18T08:00:00Z');
    await migrate(db.client, MIGRATIONS);
    const cols = async (t: string) =>
      (await db.client.query('select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1 order by ordinal_position', [t])).rows.map((r) => r.column_name);
    expect(await cols('plans_merged')).toEqual(await cols('plans'));
  });
});
