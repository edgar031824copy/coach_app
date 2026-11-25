import { expect, type Page } from '@playwright/test';
import { fillForm, mockPost, mockSavedPlan, openAllParts, savedPlan } from './ui-helpers.js';

// The views and states every interface check walks through. Each `open` returns once the state is on screen.
export const apiError = (error: string, extra: Record<string, unknown> = {}) => ({ status: error === 'validation_error' ? 400 : error === 'daily_limit_reached' ? 429 : 502, body: { error, message: `server says ${error}`, remainingCallsToday: 2, ...extra } });

// Starts a state and waits until it shows. Each returns after the state is on screen.
export const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'loading the saved plan', open: async (p) => { await mockSavedPlan(p, null, 4000); await p.goto('/'); await expect(p.getByText('Loading your saved plan…')).toBeVisible(); } },
  { name: 'the form, empty', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await expect(p.getByLabel('Goal')).toBeVisible(); } },
  { name: 'the form with every optional part open', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await openAllParts(p); } },
  { name: 'the form with errors', open: async (p) => { await mockSavedPlan(p, null); await p.goto('/'); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Choose your running level.')).toBeVisible(); } },
  { name: 'a failed read', open: async (p) => { await mockSavedPlan(p, 'fail'); await p.goto('/'); await expect(p.getByText('Could not load your saved plan.')).toBeVisible(); } },
  { name: 'the plan view', open: async (p) => { await mockSavedPlan(p, savedPlan()); await p.goto('/'); await expect(p.getByRole('region', { name: 'Your plan' })).toBeVisible(); } },
  { name: 'the plan view with a 400-character description', open: async (p) => { await mockSavedPlan(p, savedPlan({ longText: true })); await p.goto('/'); await expect(p.getByRole('region', { name: 'Your plan' })).toBeVisible(); } },
  { name: 'building the plan', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, { delayMs: 5000 }); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Building your plan…')).toBeVisible(); } },
  { name: 'waking up the coach', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, { delayMs: 8000 }); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText(/Waking up the coach/)).toBeVisible({ timeout: 6000 }); } },
  { name: 'a failure with Try again', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('coach_unavailable')); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Nothing was saved'); } },
  { name: 'the daily limit', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('daily_limit_reached', { remainingCallsToday: 0 })); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Daily limit reached'); } },
  { name: 'a server validation error', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, apiError('validation_error', { fields: { goal: 'Goal is required from the server.' } })); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByText('Goal is required from the server.')).toBeVisible(); } },
  { name: 'a network failure', open: async (p) => { await mockSavedPlan(p, null); await mockPost(p, 'network'); await p.goto('/'); await fillForm(p); await p.getByRole('button', { name: 'Build my plan' }).click(); await expect(p.getByRole('alert')).toContainText('Could not reach the server'); } },
];

