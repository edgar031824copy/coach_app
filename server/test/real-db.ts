import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/db/migrate.js';

// Every database test runs against real Postgres (the same engine as production and CI).
// Locally: your own Postgres, database `coach_app_test` (default URL below). CI: a Postgres service container
// with TEST_DATABASE_URL set in the workflow. Never point this at the production database.
const url = process.env.TEST_DATABASE_URL ?? 'postgres://localhost/coach_app_test';

// One connection in its own throwaway schema, so tests never touch each other or any real data.
export async function realClient() {
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
  await client.query(`create schema ${schema}`);
  await client.query(`set search_path to ${schema}`);
  const cleanup = async () => {
    await client.query('reset search_path');
    await client.query(`drop schema ${schema} cascade`);
    await client.end();
  };
  return { client, cleanup };
}

// A fresh schema with the real migrations applied: what the store and cap tests start from.
export async function migratedClient() {
  const db = await realClient();
  await migrate(db.client, fileURLToPath(new URL('../migrations', import.meta.url)));
  return db;
}
