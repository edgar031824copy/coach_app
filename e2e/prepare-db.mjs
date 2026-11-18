/* global process, URL, console -- a plain Node script; the root lint config has no Node globals for .mjs files */
// Creates the end-to-end database if it is missing and applies the migrations. Run by the server's webServer command
// (see playwright.config.ts), after the server is built. The name must contain "test": this never touches a real database.
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { migrate } from '../server/dist/db/migrate.js';

const base = process.env.TEST_DATABASE_URL ?? 'postgres://localhost/coach_app_test';
const name = 'coach_app_e2e_test';
if (!name.includes('test')) throw new Error('refusing to prepare a database whose name lacks "test"');

const admin = new pg.Client({ connectionString: base });
await admin.connect();
const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
if (exists.rowCount === 0) await admin.query(`create database ${name}`);
await admin.end();

const url = new URL(base);
url.pathname = `/${name}`;
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
const applied = await migrate(db, fileURLToPath(new URL('../server/migrations', import.meta.url)));
await db.end();
console.log(`e2e database ${name} ready (migrations applied now: ${applied.length})`);
