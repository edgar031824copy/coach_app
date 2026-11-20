import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMigrateCli, runMigrations } from './migrate-run.js';
import pg from 'pg';
import { realClient } from '../../test/real-db.js';

// Real Postgres, in a throwaway schema: the connection string for the runner points at that schema, so the runner
// connects the way the deploy workflow does (its own connection, from a URL) and cleans up nothing by itself.
const baseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://localhost/coach_app_test';
const dirs: string[] = [];
let db: Awaited<ReturnType<typeof realClient>> | undefined;
let schema: string;
afterEach(async () => {
  await db?.cleanup();
  db = undefined; // a test that never called setup() must not clean up the previous test's database again
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

async function setup() {
  const conn = (db = await realClient());
  schema = (await conn.client.query('show search_path')).rows[0]!.search_path as string;
  const url = new URL(baseUrl);
  url.searchParams.set('options', `-c search_path=${schema}`);
  return url.toString();
}
function migrationsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'migrate-run-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
}
const tables = async () => (await db!.client.query(`select table_name from information_schema.tables where table_schema = '${schema}' order by 1`)).rows.map((r) => r.table_name);

describe('runMigrations', () => {
  it('applies the pending migrations in name order, records them, and a second run applies nothing', async () => {
    const url = await setup();
    const dir = migrationsDir({ '002_b.sql': 'create table b (id int);', '001_a.sql': 'create table a (id int);' });
    expect(await runMigrations({ connectionString: url, dir })).toEqual(['001_a.sql', '002_b.sql']);
    expect(await tables()).toEqual(['a', 'b', 'schema_migrations']);
    expect(await runMigrations({ connectionString: url, dir })).toEqual([]);
  });

  it('applies only what is new when a migration is added later', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_a.sql': 'create table a (id int);' });
    await runMigrations({ connectionString: url, dir });
    writeFileSync(join(dir, '002_b.sql'), 'create table b (id int);');
    expect(await runMigrations({ connectionString: url, dir })).toEqual(['002_b.sql']);
  });

  it('serializes two runs at the same time with a lock: every migration is applied exactly once and neither run fails', async () => {
    const url = await setup();
    // The first migration is slow on purpose, so a second run that did not wait would start it again and fail.
    const dir = migrationsDir({ '001_slow.sql': 'select pg_sleep(0.5); create table slow (id int);', '002_b.sql': 'create table b (id int);' });
    const results = await Promise.all([runMigrations({ connectionString: url, dir }), runMigrations({ connectionString: url, dir })]);
    expect(results.flat().sort()).toEqual(['001_slow.sql', '002_b.sql']); // each applied once, by one of the two runs
    expect(results.map((r) => r.length).sort()).toEqual([0, 2]); // the second run waited, then found nothing to do
    expect(await tables()).toEqual(['b', 'schema_migrations', 'slow']);
  });

  it('rolls a failed migration back, applies nothing after it, and reports the failure', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_ok.sql': 'create table ok (id int);', '002_bad.sql': 'create table half (id int); select 1/0;', '003_after.sql': 'create table after (id int);' });
    await expect(runMigrations({ connectionString: url, dir })).rejects.toThrow();
    expect(await tables()).toEqual(['ok', 'schema_migrations']); // 001 stays applied; 002 is rolled back (no "half"); 003 never ran
    const recorded = (await db!.client.query('select name from schema_migrations order by name')).rows.map((r) => r.name);
    expect(recorded).toEqual(['001_ok.sql']);
  });

  it('releases the lock and the connection even when a migration fails, so the next run can proceed', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_bad.sql': 'select 1/0;' });
    await expect(runMigrations({ connectionString: url, dir })).rejects.toThrow();
    writeFileSync(join(dir, '001_bad.sql'), 'create table fixed (id int);');
    expect(await runMigrations({ connectionString: url, dir })).toEqual(['001_bad.sql']); // would hang forever on a leaked lock
  });

  it('gives up with an error instead of waiting forever when another run keeps the lock, and does not leave its connection open', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_a.sql': 'create table a (id int);' });
    const holder = new pg.Client({ connectionString: url });
    await holder.connect();
    await holder.query('select pg_advisory_lock($1)', [7_165_421_903]);
    try {
      const started = Date.now();
      await expect(runMigrations({ connectionString: url, dir, lockTimeoutMs: 300 })).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(5000);
      expect(await tables()).toEqual([]); // nothing was applied
    } finally {
      await holder.end();
    }
    expect(await runMigrations({ connectionString: url, dir, lockTimeoutMs: 300 })).toEqual(['001_a.sql']); // free again
  });

  it('waits for the lock timeout only while taking the migration lock: a migration that waits on a table lock is not cut short', async () => {
    const url = await setup();
    await db!.client.query('create table pre (id int)');
    const dir = migrationsDir({ '001_alter.sql': 'alter table pre add column x int;' });
    const holder = new pg.Client({ connectionString: url });
    await holder.connect();
    await holder.query('begin');
    await holder.query('lock table pre in access exclusive mode');
    setTimeout(() => void holder.query('commit').then(() => holder.end()), 700); // longer than the 200 ms lock timeout
    expect(await runMigrations({ connectionString: url, dir, lockTimeoutMs: 200 })).toEqual(['001_alter.sql']);
  });
});

describe('runMigrateCli', () => {
  const capture = () => {
    const out: string[] = [];
    return { out, log: (line: string) => out.push(line) };
  };

  it('exits 2 and says so when DATABASE_URL is missing, without touching a database', async () => {
    const c = capture();
    expect(await runMigrateCli({ env: {}, dir: '/nonexistent', log: c.log })).toBe(2);
    expect(c.out.join('\n')).toMatch(/DATABASE_URL is not set/);
  });

  it('exits 0 and lists what it applied, or says there was nothing to do', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_a.sql': 'create table a (id int);' });
    const first = capture();
    expect(await runMigrateCli({ env: { DATABASE_URL: url }, dir, log: first.log })).toBe(0);
    expect(first.out.join('\n')).toContain('001_a.sql');
    const second = capture();
    expect(await runMigrateCli({ env: { DATABASE_URL: url }, dir, log: second.log })).toBe(0);
    expect(second.out.join('\n')).toMatch(/nothing to apply/i);
  });

  it('exits 1 for a failed migration and prints the error name and code, never its message (the log is public)', async () => {
    const url = await setup();
    const dir = migrationsDir({ '001_bad.sql': "create table t (id int); select 1/0 /* secret-marker-in-sql */;" });
    const c = capture();
    expect(await runMigrateCli({ env: { DATABASE_URL: url }, dir, log: c.log })).toBe(1);
    const text = c.out.join('\n');
    expect(text).toMatch(/failed/i);
    expect(text).toContain('22012'); // Postgres' division_by_zero code
    expect(text).not.toMatch(/division by zero/i); // the message
    expect(text).not.toContain('secret-marker-in-sql');
  });

  it('exits 1 without printing the connection string or host when the database cannot be reached', async () => {
    const c = capture();
    const code = await runMigrateCli({ env: { DATABASE_URL: 'postgres://nobody:hunter2pw@127.0.0.1:1/nodb' }, dir: '/nonexistent', log: c.log });
    expect(code).toBe(1);
    const text = c.out.join('\n');
    expect(text).not.toContain('hunter2pw');
    expect(text).not.toContain('127.0.0.1');
    expect(text).toMatch(/failed/i);
  });
});
