// One place for the ports and the database the end-to-end stack uses. They differ from the development ones
// (3000 and 5173), so a running dev server never clashes with a test run.
export const SERVER_PORT = 3100;
export const CLIENT_PORT = 5174;
export const CLIENT_ORIGIN = `http://localhost:${CLIENT_PORT}`;
export const DAILY_CAP = 3; // small on purpose, so the "daily limit reached" journey is short

// The same server the unit tests use (TEST_DATABASE_URL; CI sets it, locally it is the Homebrew Postgres), but its own
// database, so the end-to-end runs never touch the tests' databases or any real data.
const base = process.env.TEST_DATABASE_URL ?? 'postgres://localhost/coach_app_test';
export const BASE_DATABASE_URL = base;
export const E2E_DATABASE_NAME = 'coach_app_e2e_test';
export const E2E_DATABASE_URL = (() => {
  const url = new URL(base);
  url.pathname = `/${E2E_DATABASE_NAME}`;
  return url.toString();
})();
