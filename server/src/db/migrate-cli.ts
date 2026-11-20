// `npm run migrate -w server`: applies the SQL files in server/migrations to the database in DATABASE_URL, taking a lock so
// two runs never overlap. It reads DATABASE_URL from the environment or the repo-root `.env` (the npm script loads it).
// The deploy workflow runs the same command. All the logic is in migrate-run.ts; this file only connects it to the process.
import { fileURLToPath } from 'node:url';
import { runMigrateCli } from './migrate-run.js';

const dir = fileURLToPath(new URL('../../migrations', import.meta.url)); // server/migrations, from both src/db and dist/db
process.exit(await runMigrateCli({ env: process.env, dir, log: (line) => console.log(line) }));
