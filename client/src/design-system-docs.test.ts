// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const DOC = readFileSync(fileURLToPath(new URL('../../docs/design-system.md', import.meta.url)), 'utf8');
const UI = join(SRC, 'components', 'ui');
const isSource = (name: string) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);

// Task 1.3: the design system document stays in step with the code.
describe('docs/design-system.md', () => {
  it('names every component file in components/ui @spec(design-system/documented-components/every-component-is-documented)', () => {
    const files = readdirSync(UI).filter(isSource);
    expect(files.length).toBeGreaterThanOrEqual(7); // button, card, badge, alert, input, textarea, label
    for (const file of files) expect(DOC, file).toContain(`\`${file}\``);
  });

  it('names the icons file and each icon', () => {
    expect(DOC).toContain('`icons.tsx`');
    for (const icon of ['RouteIcon', 'BarbellIcon', 'MoonIcon', 'WarningIcon', 'TrashIcon', 'ChevronLeftIcon', 'ChevronRightIcon']) expect(DOC, icon).toContain(icon);
  });

  it('lists every color token', () => {
    const css = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
    const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const names = [...root.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(DOC, `--${name}`).toContain(`\`--${name}\``);
  });
});

// Task 2.4 (coach-plan-week-and-delete): the danger variant and its contrast pair are listed, in the code and in the document.
describe('the danger button', () => {
  it('has its text-on-background pair in token-pairs.json and is described in the document', () => {
    const pairs = JSON.parse(readFileSync(join(SRC, 'styles', 'token-pairs.json'), 'utf8')).pairs as { text: string; background: string; min: number }[];
    expect(pairs.find((p) => p.text === 'brand-fg' && p.background === 'error')?.min).toBe(4.5);
    const button = DOC.slice(DOC.indexOf('### Button'), DOC.indexOf('### Card'));
    expect(button).toContain('`danger`');
    expect(button).toMatch(/brand-fg.*on.*error|white on the error/i);
  });
});

// Task 3.3 (coach-plan-history): the switcher, the status line and the replace note are described, with their roles.
describe('the plan history patterns', () => {
  it('describes the week switcher, the status line and the replace note', () => {
    const view = DOC.slice(DOC.indexOf('**Plan view.**'), DOC.indexOf('## ', DOC.indexOf('**Plan view.**')));
    for (const text of ['week switcher', 'Earlier plan', 'Later plan', 'aria-disabled', 'role="status"', 'role="note"', 'You already have a plan for the week of']) expect(view, text).toContain(text);
  });

  it('lists the size of the bundle after the change, and the size of the plan list', () => {
    expect(DOC).toContain('After `coach-plan-history`');
    expect(DOC).toContain('Size of the plan list');
  });
});

// "Styled with tokens only": a Tailwind palette color (bg-blue-500, text-white) would sidestep the token file.
const PALETTE = /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|shadow|divide|decoration)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
describe('components/ui', () => {
  it('detects a palette color class and ignores token classes @spec(design-system/tokens-in-one-place/no-raw-colors-in-the-screens)', () => {
    expect(PALETTE.test('rounded-md bg-blue-500')).toBe(true);
    expect(PALETTE.test('text-white')).toBe(true);
    expect(PALETTE.test('bg-primary text-muted-foreground border-alert-border shadow-card')).toBe(false);
  });

  it('uses token classes only, no Tailwind palette colors @spec(design-system/tokens-in-one-place/no-raw-colors-in-the-screens)', () => {
    const offenders = readdirSync(UI).filter(isSource).filter((f) => PALETTE.test(readFileSync(join(UI, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  // In Tailwind 4, `outline-none` sets the outline style to none, and `focus-visible:outline-2` then draws nothing. This
  // was found by the Playwright focus check (task 4.1): inputs, chips, summaries and the main button had no focus ring.
  it('does not use outline-none, which would remove the focus ring that focus-visible:outline-2 asks for', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const offenders = walk(SRC).filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)).filter((f) => /\boutline-none\b/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
  });
});
