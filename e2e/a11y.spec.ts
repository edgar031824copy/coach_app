import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { resetDb } from './db.js';
import { mockSavedPlan, openAllParts, overflow, savedPlan } from './ui-helpers.js';
import { STATES } from './ui-states.js';

// The second batch of interface checks (task 4.2): the reachable button, reduced motion, headings and names, long text,
// and an automated accessibility scan of every view and state. The API is mocked, as in ui.spec.ts.
test.beforeEach(async () => { await resetDb(); });

test.describe('on a phone, 360 by 740', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test('"Build my plan" is inside the screen with the form scrolled to the top @spec(form-presentation/the-primary-button-stays-in-reach-on-a-phone/button-visible-without-scrolling-to-the-end)', async ({ page }) => {
    await mockSavedPlan(page, null);
    await page.goto('/');
    await expect(page.getByLabel('Goal')).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const box = await page.getByRole('button', { name: 'Build my plan' }).boundingBox();
    expect(box, 'the button has a box').not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(740);
    // and the page really is longer than the screen, so this is the pinned bar and not a short form
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1200);
  });

  test('a 400-character description is whole, inside its card and not clipped @spec(plan-presentation/sessions-are-identified-by-text/long-text-is-not-cut-off)', async ({ page }) => {
    await mockSavedPlan(page, savedPlan({ longText: true }));
    await page.goto('/');
    const card = page.getByRole('listitem', { name: 'Monday' }).locator('[data-slot="card"]');
    const text = card.locator('span.break-words').first();
    await expect(text).toBeVisible();
    expect((await text.textContent())!.length).toBe(400);
    const cardBox = (await card.boundingBox())!;
    const textBox = (await text.boundingBox())!;
    expect(textBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(textBox.x + textBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
    // nothing is clipped: the card and the text are as tall as their content, and the page is not wider than the screen
    const clipped = await card.evaluate((el) => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(false);
    expect(await overflow(page)).toBe(0);
  });

  test('the seven day cards run from Monday to Sunday down the page, each as wide as the others @spec(plan-presentation/one-card-per-day-in-week-order/days-in-week-order)', async ({ page }) => {
    const saved = savedPlan();
    saved.plan.days.reverse(); // the plan stores its days Sunday to Monday; the view must still show Monday first
    await mockSavedPlan(page, saved);
    await page.goto('/');
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const boxes = [];
    for (const name of names) boxes.push((await page.getByRole('listitem', { name }).boundingBox())!);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y, names[i]).toBeGreaterThan(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
    expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const name of ['the form, empty', 'the form with every optional part open', 'the plan view', 'building the plan', 'a failure with Try again']) {
    test(`shows no animation and no transition in ${name} @spec(responsive-accessibility/reduced-motion/reduced-motion-respected)`, async ({ page }) => {
      await STATES.find((s) => s.name === name)!.open(page);
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the browser must report reduced motion').toBe(true);
      // hover and focus a control too, since transitions run on change
      await page.getByRole('button').first().hover();
      const result = await page.evaluate(() => {
        const running = document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'animation');
        const withTransition: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          const cs = getComputedStyle(el);
          const longest = Math.max(...cs.transitionDuration.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 0.001 : 1)));
          const anim = Math.max(...cs.animationDuration.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 0.001 : 1)));
          if (longest > 0 || anim > 0) withTransition.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} ${cs.transitionDuration} ${cs.animationDuration}`);
        }
        return { running, withTransition };
      });
      expect(result.running).toEqual([]);
      expect(result.withTransition.slice(0, 5)).toEqual([]);
    });
  }
});

// Headings run 1, 2, 3 without a gap, every control has a name, and the level controls are groups with their names.
async function structure(page: Page) {
  const headings = await page.evaluate(() => Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => Number(h.tagName[1])));
  const snapshot = await page.locator('body').ariaSnapshot();
  const unnamed = snapshot.split('\n').filter((l) => /^\s*- (button|textbox|checkbox|radio|combobox|spinbutton|link|group|region|list|listitem)(?!.*")(?:\s*\[.*\])?:?\s*$/.test(l) && /- (button|textbox|checkbox|radio|combobox|spinbutton|link)\b/.test(l));
  return { headings, unnamed, snapshot };
}

test('the form view has one h1, h2 "New plan", h3 sections, named controls and the two level groups @spec(responsive-accessibility/structure-for-screen-readers/labels-and-headings)', async ({ page }) => {
  await mockSavedPlan(page, null);
  await page.goto('/');
  await openAllParts(page);
  const { headings, unnamed } = await structure(page);
  expect(headings).toEqual([1, 2, 3, 3, 3, 3]);
  expect(unnamed, unnamed.join('\n')).toEqual([]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hybrid Coach');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('New plan');
  await expect(page.getByRole('group', { name: 'Running level' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'CrossFit level' })).toBeVisible();
});

test('the plan view has one h1, h2 "Your plan", an h3 per day, and named controls @spec(responsive-accessibility/structure-for-screen-readers/labels-and-headings)', async ({ page }) => {
  await mockSavedPlan(page, savedPlan());
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Your plan' })).toBeVisible();
  const { headings, unnamed } = await structure(page);
  expect(headings).toEqual([1, 2, 3, 3, 3, 3, 3, 3, 3]);
  expect(unnamed, unnamed.join('\n')).toEqual([]);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Your plan');
});

// axe, with the contrast rule off (the token test computes every pair), on each view and state.
test.describe('automated accessibility scan', () => {
  for (const state of STATES) {
    test(`finds no violation in ${state.name} @spec(responsive-accessibility/structure-for-screen-readers/automated-accessibility-rules)`, async ({ page }) => {
      await state.open(page);
      const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
});
