import pg from 'pg';
import { migrate } from './migrate.js';

// One fixed number for "the coach_app migration lock". Postgres advisory locks are held by a session and are the standard
// way to make two processes take turns; two deploys migrating at once would otherwise both try to apply the same file.
const MIGRATION_LOCK_KEY = 7_165_421_903;

// Connects with its own single connection (migrate() needs one, because each file runs in a transaction on it), waits for
// the lock, applies the pending migrations, and always closes the connection. The lock belongs to that session, so closing
// the connection releases it, even after a failure: a session pooler keeps the same session for the whole run.
export async function runMigrations(opts: { connectionString: string; dir: string; lockTimeoutMs?: number }): Promise<string[]> {
  const client = new pg.Client({ connectionString: opts.connectionString });
  // A pooler can drop an idle connection; without a listener that event would crash the process with an unlabeled error.
  // The failure still surfaces through the query that was waiting, and only its label is printed (see `label`).
  client.on('error', () => undefined);
  await client.connect();
  try {
    // Give up instead of waiting forever for a run that never finishes (the setting applies to waiting for the lock only:
    // it is switched off again before any migration runs, so a slow migration is never cut short).
    await client.query(`set lock_timeout = ${Math.floor(opts.lockTimeoutMs ?? 120_000)}`);
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query('set lock_timeout = 0');
    return await migrate(client, opts.dir);
  } finally {
    await client.end().catch(() => undefined);
  }
}

// What may be printed about a failure: the error's NAME and Postgres code only. Messages can quote the connection string,
// the host or the SQL, and the CI log of this public repository is public (design.md section 9).
function label(err: unknown): string {
  const name = err instanceof Error ? err.name : 'Error';
  const code = typeof (err as { code?: unknown })?.code === 'string' ? ` ${(err as { code: string }).code}` : '';
  return `${name}${code}`;
}

// The command behind `npm run migrate -w server` and the deploy workflow's migrate step. Returns the exit code:
// 0 done (or nothing to do), 1 a failure, 2 not configured.
export async function runMigrateCli(opts: { env: Record<string, string | undefined>; dir: string; log: (line: string) => void }): Promise<number> {
  const url = opts.env.DATABASE_URL;
  if (!url) {
    opts.log('migrate: DATABASE_URL is not set.');
    return 2;
  }
  try {
    const applied = await runMigrations({ connectionString: url, dir: opts.dir });
    opts.log(applied.length > 0 ? `migrate: applied ${applied.join(', ')}` : 'migrate: nothing to apply, the database is up to date');
    return 0;
  } catch (err) {
    opts.log(`migrate: failed (${label(err)}). Nothing after the failed step was applied.`);
    return 1;
  }
}
