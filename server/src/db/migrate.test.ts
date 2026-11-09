import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate.js';
import { realClient } from '../../test/real-db.js';

const MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url));

let dir: string;
let db: Awaited<ReturnType<typeof realClient>>;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  db = await realClient();
});
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true });
  await db.cleanup();
});
const write = (name: string, sql: string) => writeFileSync(join(dir, name), sql);

describe('migrate', () => {
  it('applies the first migration: plans and coach_call_counts exist', async () => {
    expect(await migrate(db.client, MIGRATIONS)).toEqual(['001_init.sql']);
    await db.client.query('insert into plans(plan, onboarding) values ($1, $2)', ['{}', '{}']);
    await db.client.query("insert into coach_call_counts(day, calls) values ('2026-11-08', 1)");
    expect((await db.client.query('select count(*)::int as n from plans')).rows[0].n).toBe(1);
  });

  it('applies twice without error and records each file once', async () => {
    await migrate(db.client, MIGRATIONS);
    expect(await migrate(db.client, MIGRATIONS)).toEqual([]);
    const { rows } = await db.client.query('select name from schema_migrations order by name');
    expect(rows).toEqual([{ name: '001_init.sql' }]);
  });

  it('runs only new files, in name order, and ignores other files', async () => {
    write('002_b.sql', 'create table b (n int);');
    write('001_a.sql', 'create table a (n int);');
    write('notes.txt', 'not sql');
    expect(await migrate(db.client, dir)).toEqual(['001_a.sql', '002_b.sql']);
    write('003_c.sql', 'create table c (n int);');
    expect(await migrate(db.client, dir)).toEqual(['003_c.sql']);
  });

  it('rolls back a failing migration and does not record it', async () => {
    write('001_ok.sql', 'create table ok (n int);');
    write('002_bad.sql', 'create table half_done (n int); select * from does_not_exist;');
    await expect(migrate(db.client, dir)).rejects.toThrow(/does_not_exist/);
    const tables = await db.client.query(
      'select table_name from information_schema.tables where table_schema = current_schema() order by 1',
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual(['ok', 'schema_migrations']); // half_done rolled back
    const done = await db.client.query('select name from schema_migrations');
    expect(done.rows).toEqual([{ name: '001_ok.sql' }]);
  });
});

describe('migrate error handling', () => {
  it('rethrows the original migration error even when the rollback itself fails', async () => {
    write('001_bad.sql', 'select 1;');
    const broken = {
      async query(text: string) {
        if (text.includes('information_schema') || text.includes('schema_migrations')) return { rows: [] };
        if (text === 'begin') return { rows: [] };
        if (text === 'rollback') throw new Error('connection lost during rollback');
        throw new Error('the real migration failure');
      },
    };
    await expect(migrate(broken, dir)).rejects.toThrow('the real migration failure');
  });
});
