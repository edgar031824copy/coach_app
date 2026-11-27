import pg from 'pg';
import { E2E_DATABASE_NAME, E2E_DATABASE_URL } from './env.js';

// Direct database access for the tests: to start each one from an empty state, and to check what the server
// stored and counted (the end-to-end proof that a reload makes no coach call, and that a submission counts once).
async function withDb<T>(run: (db: pg.Client) => Promise<T>): Promise<T> {
  if (!E2E_DATABASE_NAME.includes('test')) throw new Error('refusing to touch a database whose name lacks "test"');
  const db = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

export const resetDb = () => withDb((db) => db.query('truncate plans, coach_call_counts restart identity').then(() => undefined));

export const counts = () =>
  withDb(async (db) => {
    const plans = await db.query('select count(*)::int as n from plans');
    const calls = await db.query('select coalesce(sum(calls), 0)::int as n from coach_call_counts');
    return { plans: plans.rows[0].n as number, calls: calls.rows[0].n as number };
  });

// The stored plans as the database holds them, oldest week first: the ids and weeks, to show what a rebuild or a deletion did.
export const planRows = () =>
  withDb(async (db) => {
    const { rows } = await db.query("select id, to_char(week_start, 'YYYY-MM-DD') as week from plans order by week_start");
    return rows.map((r) => ({ id: Number(r.id), week: r.week as string }));
  });
