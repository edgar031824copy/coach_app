import type { Page, Route } from '@playwright/test';

// Helpers for the interface checks (layout, target sizes, keyboard, focus rings, structure). The checks mock the API
// with page.route, so every state is deterministic and none of them uses a coach call.

export const WIDTHS = [360, 768, 1280] as const;

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const session = (discipline: 'running' | 'crossfit', description: string, intensity: 'easy' | 'moderate' | 'hard', source: 'athlete' | 'coach') => ({ discipline, description, intensity, source });

// A saved plan that exercises every part of the plan view: a safety note, a pasted week, two sessions on a day with a
// combined-load note, a rest day, suggestions, and (when asked) a 400-character description.
export function savedPlan(options: { longText?: boolean } = {}) {
  const long = 'Steady aerobic run with strides, keep the effort conversational and stay relaxed through the shoulders. '.repeat(4).trim().slice(0, 400);
  const sessions: Record<string, ReturnType<typeof session>[]> = {
    mon: [session('running', options.longText ? long : '5 km easy', 'easy', 'athlete')],
    tue: [session('running', '6 km easy', 'easy', 'athlete'), session('crossfit', 'Gymnastics skill work and light conditioning', 'easy', 'coach')],
    wed: [session('crossfit', 'Upper body strength', 'moderate', 'coach')],
    thu: [session('running', '8 km tempo', 'hard', 'athlete')],
    fri: [session('crossfit', 'Mixed modal, moderate effort', 'moderate', 'coach')],
    sat: [session('running', 'Long run 11 km, steady easy pace', 'moderate', 'athlete')],
  };
  return {
    id: 1,
    createdAt: '2026-11-25T10:00:00.000Z',
    weekStart: '2026-11-23',
    onboarding: {
      goal: 'Finish a 10k', runningLevel: 'intermediate', crossfitLevel: 'intermediate', injuries: 'sore knee',
      runningDays: ['mon', 'tue', 'thu', 'sat'], crossfitDays: ['tue', 'wed', 'fri'],
      existingRunningPlan: 'Week 3: Mon 5 km easy', pastedPlanWeek: 3, weeklyTraining: null, targetEvent: null,
    },
    plan: {
      days: DAYS.map((day) => ({ day, sessions: sessions[day] ?? [], combinedLoadNote: day === 'tue' ? 'Two sessions today: run first, keep the CrossFit light on the legs.' : null })),
      recommendations: ['Sunday is a full rest day. Light walking or mobility is optional.', 'Eat and hydrate well on the days you run and do CrossFit together.'],
      safetyNote: 'You reported pain. The coach is not a clinician and cannot diagnose what is causing it. Please see a qualified professional before you train through pain.',
    },
  };
}

const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// What GET /api/plan answers. `null` is "nothing saved"; 'fail' makes the read fail.
export async function mockSavedPlan(page: Page, saved: ReturnType<typeof savedPlan> | null | 'fail', delayMs = 0) {
  await page.route('**/api/plan', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (page.isClosed()) return; // the test is over; nothing to answer
    return saved === 'fail' ? route.abort('failed') : json(route, 200, saved);
  });
}

// What POST /api/plan answers: an API error, a network failure, or a delayed answer.
export async function mockPost(page: Page, answer: { status: number; body: unknown } | 'network' | { delayMs: number }) {
  await page.route('**/api/plan', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    if (answer === 'network') return route.abort('failed');
    if ('delayMs' in answer) { await new Promise((r) => setTimeout(r, answer.delayMs)); if (page.isClosed()) return; return route.abort('failed'); }
    return json(route, answer.status, answer.body);
  });
}

// Fills the smallest valid form with plain actions (pointer), then does not submit.
export async function fillForm(page: Page) {
  await page.getByLabel('Goal').fill('Finish a 10k');
  await page.getByRole('group', { name: 'Running level' }).getByLabel('Intermediate').check();
  await page.getByRole('group', { name: 'CrossFit level' }).getByLabel('Intermediate').check();
  await page.getByRole('group', { name: 'Running days' }).getByLabel('Mon').check();
}

export const openAllParts = async (page: Page) => {
  for (const title of ['I already follow a running plan', 'My usual week', 'Target event']) await page.locator('summary', { hasText: title }).click();
};

// How far the page is wider than the screen (0 when it fits).
export const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Every interactive element that is on screen, with its size. A radio or a checkbox is measured as its own box, which
// covers its label; links inside a sentence do not exist in this app.
export const targets = (page: Page) =>
  page.evaluate(() => {
    const selector = 'button, a[href], input:not([type=hidden]), textarea, select, summary';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .map(({ el, r }) => ({
        name: `${el.tagName.toLowerCase()}${el.getAttribute('type') ? `[${el.getAttribute('type')}]` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? el.closest('label')?.textContent ?? '').trim().slice(0, 28)}"`,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      }));
  });

// Presses Tab until the wanted element has focus (a keyboard-only way of getting there), within a limit.
export async function tabTo(page: Page, target: import('@playwright/test').Locator, limit = 60) {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return i;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab did not reach the element within ${limit} presses`);
}
