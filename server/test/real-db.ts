import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/db/migrate.js';

// Every database test runs against real Postgres (the same engine as production and CI).
// Locally: your own Postgres, database `coach_app_test` (default URL below). CI: a Postgres service container
// with TEST_DATABASE_URL set in the workflow.
const url = process.env.TEST_DATABASE_URL ?? 'postgres://localhost/coach_app_test';

// The tests create and drop schemas, so they must never run against a real database: its name must contain "test".
export function assertTestDatabase(connectionUrl: string): void {
  const name = new URL(connectionUrl).pathname.replace(/^\//, '');
  if (!name.includes('test')) {
    throw new Error(
      `Refusing to run database tests against "${name || '(no database name)'}": a test database name must contain "test".`,
    );
  }
}

// One connection in its own throwaway schema, so tests never touch each other or any real data.
export async function realClient() {
  assertTestDatabase(url);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    const target = new URL(url);
    throw new Error(
      `Cannot reach the test database (${target.host}${target.pathname}): ${(err as Error).message || (err as { code?: string }).code}. ` +
        'Start Postgres (brew services start postgresql@16), create the database (createdb coach_app_test), ' +
        'or set TEST_DATABASE_URL.',
      { cause: err },
    );
  }
  const schema = `t_${Math.random().toString(36).slice(2, 10)}`;
  // A pool on the same schema, for tests that need several connections at once (concurrency).
  const pools: pg.Pool[] = [];
  const pool = (max: number) => {
    const p = new pg.Pool({ connectionString: url, max, options: `-c search_path=${schema}` });
    pools.push(p);
    return p;
  };
  const cleanup = async () => {
    await Promise.all(pools.map((p) => p.end()));
    await client.query('reset search_path');
    await client.query(`drop schema if exists ${schema} cascade`);
    await client.end();
  };
  try {
    await client.query(`create schema ${schema}`);
    await client.query(`set search_path to ${schema}`);
  } catch (err) {
    await cleanup().catch(() => client.end().catch(() => undefined)); // do not leak the connection or the schema
    throw err;
  }
  return { client, pool, cleanup };
}

// A fresh schema with the real migrations applied: what the store and cap tests start from.
export async function migratedClient() {
  const db = await realClient();
  try {
    await migrate(db.client, fileURLToPath(new URL('../migrations', import.meta.url)));
  } catch (err) {
    await db.cleanup().catch(() => undefined);
    throw err;
  }
  return db;
}
