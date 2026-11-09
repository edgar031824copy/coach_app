import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './types.js';

// `db` must be ONE connection (not a pool), because each migration runs inside a BEGIN ... COMMIT on it.
// Forward-only SQL migrations (design.md section 8). Runs every `*.sql` file in `dir` that is not yet recorded in
// `schema_migrations`, in name order, each in its own transaction. Returns the names it applied.
// Migrations run while the old server is still up, so they must be backward compatible (add, never drop or rename).
export async function migrate(db: Db, dir: string): Promise<string[]> {
  await db.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  const done = new Set((await db.query('select name from schema_migrations')).rows.map((r) => r.name));
  const pending = readdirSync(dir).filter((f) => f.endsWith('.sql') && !done.has(f)).sort();

  const applied: string[] = [];
  for (const name of pending) {
    const sql = readFileSync(join(dir, name), 'utf8');
    await db.query('begin');
    try {
      await db.query(sql);
      await db.query('insert into schema_migrations(name) values ($1)', [name]);
      await db.query('commit');
    } catch (err) {
      await db.query('rollback');
      throw err;
    }
    applied.push(name);
  }
  return applied;
}
