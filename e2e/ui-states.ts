import { expect, type Page } from '@playwright/test';
import { fillForm, mockPost, mockSavedPlan, openAllParts, savedPlan, savedPlans } from './ui-helpers.js';

// The views and states every interface check walks through. Each `open` returns once the state is on screen.
export const apiError = (error: string, extra: Record<string, unknown> = {}) => ({ status: error === 'validation_error' ? 400 : error === 'daily_limit_reached' ? 429 : 502, body: { error, message: `server says ${error}`, remainingCallsToday: 2, ...extra } });

// The plan view after "Delete plan" was pressed and the deletion failed: the server answered with an error, or nothing came
// back. The half second that ignores a stray second click has to pass first.
async function openFailedDeletion(p: Page, how: 'server' | 'network') {
  await mockSavedPlan(p, savedPlan());
  await p.route('**/api/plan/*', (route) => (how === 'network' ? route.abort('failed') : route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server_error', message: 'server says server_error' }) })));
  await p.goto('/');
  await p.getByRole('button', { name: 'Delete this plan' }).click();
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Delete plan' }).click();
}

// The plan view with several plans after the newest was deleted: the nearest week is shown with the status line. The half second
// that ignores a stray second click has to pass first.
async function openAfterDeletion(p: Page) {
  await mockSavedPlan(p, savedPlans(3));
  await p.route('**/api/plan/*', (route) => route.fulfill({ status: 204 }));
  await p.goto('/');
  await p.getByRole('button', { name: 'Delete this plan' }).click();
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Delete plan' }).click();
}

// Starts a state and waits until it shows. Each returns after the state is on screen.
export const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'loading the saved plan', open: async (p) => { await mockSavedPlan(p, null, 4000); await p.goto('/'); await expect(p.getByText('Loading your saved plan…')).toBeVisible(); } },
  { name: 'the form, empty', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await expect(p.getByLabel('Goal')).toBeVisible(); } },
  { name: 'the form with every optional part open', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await openAllParts(p); } },
  { name: 'the form with errors', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Choose your running level.')).toBeVisible(); } },
  { name: 'a failed read', open: async (p) => { await mockSavedPlan(p, 'fail'); await p.goto('/'); await expect(p.getByText('Could not load your saved plan.')).toBeVisible(); } },
  { name: 'the plan view', open: async (p) => { await mockSavedPlan(p, savedPlan()); await p.goto('/'); await expect(p.getByRole('region', { name: 'Your plan' })).toBeVisible(); } },
  { name: 'the plan view with a 400-character description', open: async (p) => { await mockSavedPlan(p, savedPlan({ longText: true })); await p.goto('/'); await expect(p.getByRole('region', { name: 'Your plan' })).toBeVisible(); } },
  { name: 'the plan view with several plans (the week switcher)', open: async (p) => { await mockSavedPlan(p, savedPlans(5)); await p.goto('/'); await expect(p.getByRole('button', { name: 'Earlier plan' })).toBeVisible(); } },
  { name: 'the plan view with twelve plans (the longest switcher text)', open: async (p) => { await p.clock.setFixedTime(new Date('2026-12-30T12:00:00Z')); await mockSavedPlan(p, savedPlans(12, '2026-10-12')); await p.goto('/'); await expect(p.getByText('Week of 28 Dec · 12 of 12')).toBeVisible(); } },
  { name: 'the plan view after a deletion (the status line)', open: async (p) => { await openAfterDeletion(p); await expect(p.getByRole('status').filter({ hasText: 'Deleted the plan for the week of' })).toBeVisible(); } },
  { name: 'the form with the replace note', open: async (p) => { await p.clock.setFixedTime(new Date('2026-11-26T12:00:00Z')); await mockSavedPlan(p, savedPlan()); await p.goto('/'); await p.getByRole('button', { name: 'New plan' }).click(); await expect(p.getByRole('note')).toContainText('You already have a plan for the week of 23 Nov'); } },
  { name: 'the plan view with the deletion confirmation', open: async (p) => { await mockSavedPlan(p, savedPlan()); await p.goto('/'); await p.getByRole('button', { name: 'Delete this plan' }).click(); await expect(p.getByText(/Delete the plan for the week of/)).toBeVisible(); } },
  { name: 'a failed deletion (the server says no)', open: async (p) => { await openFailedDeletion(p, 'server'); await expect(p.getByRole('alert')).toContainText('The plan could not be deleted'); } },
  { name: 'a deletion that may have happened (no answer)', open: async (p) => { await openFailedDeletion(p, 'network'); await expect(p.getByRole('alert')).toContainText('The plan may already be deleted'); } },
  { name: 'building the plan', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, { delayMs: 5000 }); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Building your plan…')).toBeVisible(); } },
  { name: 'waking up the coach', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, { delayMs: 8000 }); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText(/Waking up the coach/)).toBeVisible({ timeout: 6000 }); } },
  { name: 'a failure with Try again', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('coach_unavailable')); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Nothing was saved'); } },
  { name: 'the daily limit', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('daily_limit_reached', { remainingCallsToday: 0 })); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Daily limit reached'); } },
  { name: 'a server validation error', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('validation_error', { fields: { goal: 'Goal is required from the server.' } })); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Goal is required from the server.')).toBeVisible(); } },
  { name: 'a network failure', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, 'network'); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Could not reach the server'); } },
];

