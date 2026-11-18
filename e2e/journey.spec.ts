import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { counts, resetDb } from './db.js';
import { CLIENT_ORIGIN, E2E_DATABASE_URL } from './env.js';

// The main journey in a real browser, against the built server (fake coach, real Postgres) and the client.
// Each test starts from an empty database; the stack's daily cap is 3 calls.
test.beforeEach(async () => { await resetDb(); });

const plan = (page: Page) => page.getByRole('region', { name: 'Your plan' });
const day = (page: Page, name: string) => page.getByRole('listitem', { name });

// Fills the onboarding with a pasted running plan and builds the first plan.
async function buildFirstPlan(page: Page, paste: string) {
  await page.goto('/');
  await page.getByLabel('Goal').fill('Finish a 10k');
  await page.getByLabel('Running level').selectOption('intermediate');
  await page.getByLabel('CrossFit level').selectOption('intermediate');
  await page.getByLabel(/Your running plan/).fill(paste);
  await page.getByRole('group', { name: 'CrossFit days' }).getByRole('checkbox', { name: 'Fri' }).check();
  await page.getByRole('button', { name: 'Build my plan' }).click();
}

test('onboarding with a pasted plan, reload, and Plan next week @spec(plan-storage/plan-next-week/form-is-pre-filled) @spec(plan-storage/plan-next-week/submitting-counts-as-a-normal-call)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build my plan' })).toBeVisible();
  await expect(plan(page)).toHaveCount(0); // nothing saved yet

  await buildFirstPlan(page, 'Week 1: Mon 5 km easy, Wed 8 km tempo. Week 2: Tue 6 km easy; Thu 10 km long');
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(day(page, 'Monday')).toContainText('5 km easy');
  await expect(day(page, 'Monday')).toContainText('from your plan'); // the pasted session, labeled as the athlete's
  await expect(day(page, 'Friday')).toContainText('CrossFit');
  await expect(day(page, 'Tuesday')).toContainText('Rest day');
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Reload: the same plan comes back from the database, and the coach is not called again.
  await page.reload();
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(day(page, 'Wednesday')).toContainText('8 km tempo');
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Plan next week: the form is pre-filled with the next week, and nothing changes until it is submitted.
  await page.getByRole('button', { name: 'Plan next week' }).click();
  await expect(page.getByLabel('Goal')).toHaveValue('Finish a 10k');
  await expect(page.getByLabel(/Week of your plan/)).toHaveValue('2');
  await expect(plan(page)).toContainText('Week 1 of your running plan'); // the saved plan is still the one shown
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Submitting it is one normal call: validated, counted toward the cap, answered by the coach, saved.
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  await expect(day(page, 'Tuesday')).toContainText('6 km easy');
  await expect(day(page, 'Monday')).toContainText('Rest day');
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // The newest plan is the one that comes back after a reload; the first stays stored.
  await page.reload();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
});

test('after the daily limit the client says so, with no retry, and nothing more is called @spec(cost-cap/daily-cap/cap-reached)', async ({ page }) => {
  await buildFirstPlan(page, 'Mon 5 km easy, Wed 8 km tempo');
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  for (const week of [2, 3]) {
    await page.getByRole('button', { name: 'Plan next week' }).click();
    await page.getByRole('button', { name: 'Build my plan' }).click();
    await expect(plan(page)).toContainText(`Week ${week} of your running plan`);
  }
  expect(await counts()).toEqual({ plans: 3, calls: 3 }); // the cap of the stack: all used

  await page.getByRole('button', { name: 'Plan next week' }).click();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Daily limit reached');
  await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(plan(page)).toContainText('Week 3 of your running plan'); // the last plan stays on screen
  expect(await counts()).toEqual({ plans: 3, calls: 3 }); // the refused request used no call and saved nothing
});

test('the server refuses to start with the fake coach in production', () => {
  const entry = fileURLToPath(new URL('../server/dist/index.js', import.meta.url));
  const run = spawnSync(process.execPath, [entry], {
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, NODE_ENV: 'production', COACH_MODE: 'fake', DATABASE_URL: E2E_DATABASE_URL, CLIENT_ORIGIN, PORT: '3199' },
  });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('COACH_MODE=fake is not allowed when NODE_ENV is production');
});
