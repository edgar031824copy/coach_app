import { test, expect, type Page } from '@playwright/test';
import { resetDb } from './db.js';
import { WIDTHS, fillForm, mockPost, mockSavedPlan, openAllParts, overflow, savedPlan, tabTo, targets } from './ui-helpers.js';

// Interface checks that need a real browser: layout, target sizes, keyboard use and focus rings. The API is mocked with
// page.route, except in the keyboard journey, which uses the real stack (one fake-coach call).
test.beforeEach(async () => { await resetDb(); });

const apiError = (error: string, extra: Record<string, unknown> = {}) => ({ status: error === 'validation_error' ? 400 : error === 'daily_limit_reached' ? 429 : 502, body: { error, message: `server says ${error}`, remainingCallsToday: 2, ...extra } });

// Starts a state and waits until it shows. Each returns after the state is on screen.
const STATES: { name: string; open: (page: Page) => Promise<void> }[] = [
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

for (const width of WIDTHS) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: width === 360 ? 740 : 900 } });

    for (const state of STATES) {
      test(`${state.name} fits the screen with no horizontal scroll @spec(responsive-accessibility/layout-at-every-width/no-horizontal-scroll)`, async ({ page }) => {
        await state.open(page);
        expect(await overflow(page)).toBe(0);
      });
    }
  });
}

// Touch input at 360 and 768: every interactive element is at least 44 by 44. A mouse at 1280: at least 36 high and 24 wide.
for (const width of [360, 768] as const) {
  test.describe(`touch at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: true, isMobile: true });

    for (const name of ['the form, empty', 'the form with every optional part open', 'the form with errors', 'the plan view', 'a failure with Try again']) {
      test(`every control is at least 44 by 44 in ${name} @spec(responsive-accessibility/touch-targets/target-size-with-touch)`, async ({ page }) => {
        await STATES.find((s) => s.name === name)!.open(page);
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the browser must report a coarse pointer').toBe(true);
        const small = (await targets(page)).filter((t) => t.width < 43.5 || t.height < 43.5);
        expect(small, JSON.stringify(small)).toEqual([]);
      });
    }
  });
}

test.describe('mouse at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const name of ['the form, empty', 'the form with every optional part open', 'the form with errors', 'the plan view', 'a failure with Try again']) {
    test(`every control is at least 36 high and 24 wide in ${name} @spec(responsive-accessibility/touch-targets/target-size-with-a-mouse)`, async ({ page }) => {
      await STATES.find((s) => s.name === name)!.open(page);
      expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches), 'the browser must report a fine pointer').toBe(true);
      const small = (await targets(page)).filter((t) => t.height < 35.5 || t.width < 23.5);
      expect(small, JSON.stringify(small)).toEqual([]);
    });
  }
});

// The whole flow with the keyboard alone, on the real stack: fill the form, fold and open a part, submit, move on.
test('the keyboard alone fills the form, submits it and reaches "Plan next week" @spec(responsive-accessibility/keyboard-use/keyboard-only-journey)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Goal')).toBeVisible();
  const key = (k: string) => page.keyboard.press(k);

  await tabTo(page, page.getByLabel('Goal'));
  await page.keyboard.type('Finish a 10k');
  await tabTo(page, page.getByRole('group', { name: 'Running level' }).getByLabel('Beginner'));
  await key('ArrowRight'); // Intermediate
  await expect(page.getByRole('group', { name: 'Running level' }).getByLabel('Intermediate')).toBeChecked();
  await tabTo(page, page.getByRole('group', { name: 'CrossFit level' }).getByLabel('Intermediate').or(page.getByRole('group', { name: 'CrossFit level' }).getByLabel('Beginner')).first());
  await key('Space');
  await expect(page.getByRole('group', { name: 'CrossFit level' }).getByRole('radio', { checked: true })).toHaveCount(1);
  await tabTo(page, page.getByRole('group', { name: 'Running days' }).getByLabel('Mon'));
  await key('Space');
  await expect(page.getByRole('group', { name: 'Running days' }).getByLabel('Mon')).toBeChecked();

  // Fold and open an optional part with Enter and Space.
  const part = page.locator('summary', { hasText: 'Target event' });
  await tabTo(page, part);
  await key('Enter');
  await expect(page.getByLabel('Event name')).toBeVisible();
  await key('Space');
  await expect(page.getByLabel('Event name')).toBeHidden();

  await tabTo(page, page.getByRole('button', { name: 'Build my plan' }));
  await key('Enter');
  await expect(page.getByRole('region', { name: 'Your plan' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Your plan' })).toBeFocused(); // the view's heading, without a pointer

  await key('Tab');
  await expect(page.getByRole('button', { name: 'Plan next week' })).toBeFocused(); // one Tab from the heading
  await key('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'New plan' })).toBeFocused();
});

// Visible focus: Tab through every stop of a view and look at what the browser draws. Radios and checkboxes are drawn by
// the span next to the (invisible) input, so that span is the element checked.
async function focusRings(page: Page, lastStop: string) {
  const stops: { name: string; ok: boolean; detail: string }[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250); // colors transition for 150 ms; read the settled values
    const stop = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      const drawn = active instanceof HTMLInputElement && (active.type === 'radio' || active.type === 'checkbox') ? (active.nextElementSibling as HTMLElement) : active;
      const cs = getComputedStyle(drawn);
      // The ring has to stand out from what is behind it: the element itself when it is drawn on the edge, the surface
      // around it when it is drawn with an offset.
      const offset = parseFloat(cs.outlineOffset) > 0;
      let bg = 'rgba(0, 0, 0, 0)';
      for (let el: HTMLElement | null = offset ? drawn.parentElement : drawn; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } }
      return {
        name: `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''} "${(active.getAttribute('aria-label') || active.textContent || active.closest('label')?.textContent || (active as HTMLInputElement).labels?.[0]?.textContent || '').trim().slice(0, 28)}"`,
        width: parseFloat(cs.outlineWidth), style: cs.outlineStyle, color: cs.outlineColor, bg,
      };
    });
    // A date field has inner stops (day, month, year, the picker icon): the first one is checked, and the browser draws the
    // inner ones itself, so a repeated stop on the same element is part of the same control.
    if (stops.at(-1)?.name === stop.name) continue;
    stops.push({ name: stop.name, ok: stop.style !== 'none' && stop.width > 0 && stop.color !== stop.bg, detail: `${stop.style} ${stop.width}px ${stop.color} on ${stop.bg}` });
    if (stop.name.includes(lastStop)) break;
  }
  return stops;
}

test('every focus stop in the form view and the plan view shows a visible ring @spec(responsive-accessibility/keyboard-use/focus-is-visible)', async ({ page }) => {
  await mockSavedPlan(page, null);
  await page.goto('/');
  await expect(page.getByLabel('Goal')).toBeVisible();
  await openAllParts(page);
  await page.getByRole('heading', { level: 1 }).click(); // Tab starts from here, the top of the page
  const formStops = await focusRings(page, 'Build my plan');
  expect(formStops.length, 'the form has many stops').toBeGreaterThan(20);
  expect(formStops.filter((s) => !s.ok), JSON.stringify(formStops.filter((s) => !s.ok))).toEqual([]);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockSavedPlan(page, savedPlan());
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Your plan' })).toBeVisible();
  const planStops = await focusRings(page, 'New plan');
  expect(planStops.map((s) => s.name)).toEqual(['button "Plan next week"', 'button "New plan"']);
  expect(planStops.filter((s) => !s.ok), JSON.stringify(planStops)).toEqual([]);
});

test('the tab order follows the page from top to bottom @spec(responsive-accessibility/keyboard-use/focus-is-visible)', async ({ page }) => {
  await mockSavedPlan(page, null);
  await page.goto('/');
  await openAllParts(page);
  await page.getByRole('heading', { level: 1 }).click(); // Tab starts from here, the top of the page
  const order: number[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const y = await page.evaluate(() => { const a = document.activeElement as HTMLElement; const r = (a instanceof HTMLInputElement && (a.type === 'radio' || a.type === 'checkbox') ? a.closest('label')! : a).getBoundingClientRect(); return r.top + window.scrollY; });
    order.push(Math.round(y));
    if ((await page.evaluate(() => (document.activeElement as HTMLElement).textContent?.trim())) === 'Build my plan') break;
  }
  // Never goes back up the page by more than a row (the day buttons of one row share a height).
  for (let i = 1; i < order.length; i++) expect(order[i]!, `stop ${i}`).toBeGreaterThanOrEqual(order[i - 1]! - 4);
});
