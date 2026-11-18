import { defineConfig } from '@playwright/test';
import { CLIENT_ORIGIN, CLIENT_PORT, DAILY_CAP, E2E_DATABASE_URL, SERVER_PORT } from './env.js';

// The local stack: the built server with the fake coach on a real Postgres, and the Vite client proxying /api to it.
// One worker, tests in order: they share one database, which each test empties first.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: CLIENT_ORIGIN, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run build -w server && node e2e/prepare-db.mjs && node server/dist/index.js',
      cwd: '..',
      url: `http://localhost:${SERVER_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        CLIENT_ORIGIN,
        COACH_MODE: 'fake',
        MAX_COACH_CALLS_PER_DAY: String(DAILY_CAP),
        PORT: String(SERVER_PORT),
      },
    },
    {
      command: `npm run dev -w client -- --port ${CLIENT_PORT} --strictPort`,
      cwd: '..',
      url: CLIENT_ORIGIN,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${SERVER_PORT}` },
    },
  ],
});
