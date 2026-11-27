import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { counts, planRows, resetDb } from './db.js';
import { CLIENT_ORIGIN, E2E_DATABASE_URL, SERVER_PORT } from './env.js';
import { fillForm } from './ui-helpers.js';

// The main journey in a real browser, against the built server (fake coach, real Postgres) and the client.
// Each test starts from an empty database; the stack's daily cap is 3 calls.
test.beforeEach(async () => { await resetDb(); });

const plan = (page: Page) => page.getByRole('region', { name: 'Your plan' });
const day = (page: Page, name: string) => page.getByRole('listitem', { name });

// The week and the day a plan was made, as the page writes them ("23 Nov"): the Monday of the current week on the
// browser's own calendar, plus a number of weeks. The browser and this test run on the same machine, so one clock.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const mondayLabel = (weeksLater = 0) => {
  const now = new Date();
  return shortDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + 7 * weeksLater));
};
const madeLabel = () => `Made ${shortDay(new Date())}`;

// "Delete this plan", then "Delete plan" once the half second that ignores a stray second click has passed.
async function deleteShownPlan(page: Page) {
  await page.getByRole('button', { name: 'Delete this plan' }).click();
  await expect(page.getByText(/Delete the plan for the week of/)).toBeVisible();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Delete plan' }).click();
}

// Fills the onboarding with a pasted running plan and builds the first plan.
async function buildFirstPlan(page: Page, paste: string) {
  await page.goto('/');
  await page.getByLabel('Goal').fill('Finish a 10k');
  await page.getByRole('group', { name: 'Running level' }).getByLabel('Intermediate').check();
  await page.getByRole('group', { name: 'CrossFit level' }).getByLabel('Intermediate').check();
  await page.getByText('I already follow a running plan').click(); // the optional parts are folded
  await page.getByLabel(/Your running plan/).fill(paste);
  await page.getByRole('group', { name: 'CrossFit days' }).getByRole('checkbox', { name: 'Fri' }).check();
  await page.getByRole('button', { name: 'Build my plan' }).click();
}

test('onboarding with a pasted plan, reload, and Plan next week @spec(plan-storage/plan-next-week/form-is-pre-filled) @spec(plan-storage/plan-next-week/submitting-counts-as-a-normal-call)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Build my plan' })).toBeVisible();
  await expect(plan(page)).toHaveCount(0); // nothing saved yet

  const thisWeek = mondayLabel(); const nextWeek = mondayLabel(1); const made = madeLabel(); // taken before the page builds them, so a run across midnight compares the same day
  await buildFirstPlan(page, 'Week 1: Mon 5 km easy, Wed 8 km tempo. Week 2: Tue 6 km easy; Thu 10 km long');
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${thisWeek}`); // every plan shows its calendar week and the day it was made
  await expect(plan(page)).toContainText(made);
  await expect(day(page, 'Monday')).toContainText('5 km easy');
  await expect(day(page, 'Monday')).toContainText('from your plan'); // the pasted session, labeled as the athlete's
  await expect(day(page, 'Friday')).toContainText('CrossFit');
  await expect(day(page, 'Tuesday')).toContainText('Rest day');
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Reload: the same plan comes back from the database, and the coach is not called again.
  await page.reload();
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${thisWeek}`); // the stored week, read back as the same date
  await expect(day(page, 'Wednesday')).toContainText('8 km tempo');
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Plan next week: the form is pre-filled with the next week, and nothing changes until it is submitted.
  await page.getByRole('button', { name: 'Plan next week' }).click();
  await expect(page.getByLabel('Goal')).toHaveValue('Finish a 10k');
  await expect(page.getByLabel(/Week of your plan/)).toHaveValue('2');
  await expect(plan(page)).toHaveCount(0); // the form view is open; the saved plan is one press away
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  await expect(plan(page)).toContainText('Week 1 of your running plan'); // still the saved plan
  await page.getByRole('button', { name: 'Plan next week' }).click();
  await expect(page.getByLabel(/Week of your plan/)).toHaveValue('2');
  expect(await counts()).toEqual({ plans: 1, calls: 1 });

  // Submitting it is one normal call: validated, counted toward the cap, answered by the coach, saved.
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${nextWeek}`); // "Plan next week" asks for the following calendar week
  await expect(day(page, 'Tuesday')).toContainText('6 km easy');
  await expect(day(page, 'Monday')).toContainText('Rest day');
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // A reload opens the plan of the current week (the first); the plan for next week stays stored, one press of "Later plan" away.
  await page.reload();
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${thisWeek} · 1 of 2`);
  await page.getByRole('button', { name: 'Later plan' }).click();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${nextWeek} · 2 of 2`);
});

test('a deleted plan is gone from the database and after a reload; an earlier plan is what the reload shows @spec(plan-deletion/delete-button-with-a-confirmation/a-reload-does-not-show-the-deleted-plan) @spec(plan-deletion/delete-button-with-a-confirmation/confirming-deletes-the-plan-and-opens-a-new-form) @spec(plan-deletion/delete-button-with-a-confirmation/an-older-plan-can-remain-stored) @spec(plan-deletion/delete-button-with-a-confirmation/cancel-keeps-the-plan)', async ({ page }) => {
  await buildFirstPlan(page, 'Week 1: Mon 5 km easy, Wed 8 km tempo. Week 2: Tue 6 km easy; Thu 10 km long');
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await page.getByRole('button', { name: 'Plan next week' }).click();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // Asking and cancelling changes nothing.
  await page.getByRole('button', { name: 'Delete this plan' }).click();
  await expect(page.getByText(/Delete the plan for the week of/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Delete this plan' })).toBeFocused();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // Deleting the newest plan: the row is gone, the cap is not refunded, and the nearest week (the earlier one: none is later)
  // is shown, with the status line.
  await deleteShownPlan(page);
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page).getByRole('status')).toContainText('Deleted the plan for the week of');
  await expect(page.getByRole('heading', { level: 2, name: 'Your plan' })).toBeFocused();
  expect(await counts()).toEqual({ plans: 1, calls: 2 });

  // After a reload the older plan is shown and the deleted one does not come back.
  await page.reload();
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page)).not.toContainText('Week 2 of your running plan');

  // Deleting that one too leaves nothing: a reload shows the empty form and the database holds no plan.
  await deleteShownPlan(page);
  await expect(page.getByRole('heading', { level: 2, name: 'New plan' })).toBeVisible();
  expect(await counts()).toEqual({ plans: 0, calls: 2 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Build my plan' })).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
});

test('two weeks, the switcher, a rebuild with its warning, a deletion that lands on the nearest week, and the last plan @spec(stored-plans/the-plan-shown-on-start/the-current-week-opens) @spec(stored-plans/moving-between-weeks/earlier-and-later-move-one-stored-week) @spec(stored-plans/a-warning-before-a-plan-replaces-another/new-plan-for-a-week-that-has-a-plan) @spec(plan-week/one-plan-per-week/rebuilding-a-week-replaces-its-plan) @spec(plan-deletion/delete-button-with-a-confirmation/the-next-later-week-is-shown-first) @spec(stored-plans/listing-the-stored-plans/a-rebuilt-week-is-listed-once)', async ({ page }) => {
  const thisWeek = mondayLabel(); const nextWeek = mondayLabel(1); // taken before the page builds them
  const listed = async () => ((await (await page.request.get(`http://localhost:${SERVER_PORT}/api/plans`)).json()) as { plans: { id: number; weekStart: string }[] }).plans;

  // Two weeks: this week's plan, then next week's.
  await buildFirstPlan(page, 'Week 1: Mon 5 km easy, Wed 8 km tempo. Week 2: Tue 6 km easy; Thu 10 km long');
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await expect(plan(page)).not.toContainText(/ · \d+ of \d+/); // one plan: no switcher yet
  await page.getByRole('button', { name: 'Plan next week' }).click();
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  await expect(plan(page)).toContainText(`Week of ${nextWeek} · 2 of 2`);
  const [first, second] = await planRows();
  expect(await planRows()).toEqual([{ id: first!.id, week: first!.week }, { id: second!.id, week: second!.week }]);
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // The switcher moves between them and sends nothing.
  await page.getByRole('button', { name: 'Earlier plan' }).click();
  await expect(plan(page)).toContainText(`Week of ${thisWeek} · 1 of 2`);
  await expect(plan(page)).toContainText('Week 1 of your running plan');
  await page.getByRole('button', { name: 'Later plan' }).click();
  await expect(plan(page)).toContainText(`Week of ${nextWeek} · 2 of 2`);
  expect(await counts()).toEqual({ plans: 2, calls: 2 });

  // A reload opens the plan of the current week, although next week's was made more recently.
  await page.reload();
  await expect(plan(page)).toContainText(`Week of ${thisWeek} · 1 of 2`);

  // "New plan" is for the current week, which has a plan: the form says so before anything is sent. Building replaces it.
  await page.getByRole('button', { name: 'New plan' }).click();
  await expect(page.getByRole('note')).toHaveText(`You already have a plan for the week of ${thisWeek}. Building a new one replaces it.`);
  expect(await counts()).toEqual({ plans: 2, calls: 2 });
  await fillForm(page);
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(plan(page)).toContainText(`Week of ${thisWeek} · 1 of 2`); // still two plans
  await expect(plan(page)).not.toContainText('Week 1 of your running plan'); // the new plan has no pasted week: it is the new one
  expect(await counts()).toEqual({ plans: 2, calls: 3 });
  expect(await planRows()).toEqual([{ id: first!.id, week: first!.week }, { id: second!.id, week: second!.week }]); // the same two rows, the same ids
  expect((await listed()).map((p) => p.id)).toEqual([first!.id, second!.id]); // the week is listed once

  // Deleting this week's plan lands on the next later week, with the status line and the heading focused.
  await deleteShownPlan(page);
  await expect(plan(page)).toContainText('Week 2 of your running plan');
  await expect(plan(page).getByRole('status')).toHaveText(`Deleted the plan for the week of ${thisWeek}. Showing the week of ${nextWeek}.`);
  await expect(page.getByRole('heading', { level: 2, name: 'Your plan' })).toBeFocused();
  await expect(plan(page)).not.toContainText(/ · \d+ of \d+/); // one plan left: no switcher
  expect(await planRows()).toEqual([{ id: second!.id, week: second!.week }]);
  expect((await listed()).map((p) => p.id)).toEqual([second!.id]);

  // Deleting the last plan opens the empty form; the cap is not refunded.
  await deleteShownPlan(page);
  await expect(page.getByRole('heading', { level: 2, name: 'New plan' })).toBeFocused();
  await expect(page.getByLabel('Goal')).toHaveValue('');
  expect(await counts()).toEqual({ plans: 0, calls: 3 });
  expect(await listed()).toEqual([]);
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
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  await expect(plan(page)).toContainText('Week 3 of your running plan'); // the last plan stays reachable
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
