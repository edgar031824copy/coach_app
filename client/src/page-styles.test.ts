// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const read = (name: string) => readFileSync(path(name), 'utf8');

// Page-wide styles. E1's plain stylesheet is gone (task 3.1); Tailwind's reset replaces the browser defaults, and the page
// is light only with its background and text color taken from the tokens.
describe('page styles', () => {
  it('has no legacy stylesheet and does not load one', () => {
    expect(existsSync(path('styles.css'))).toBe(false);
    expect(read('main.tsx')).not.toMatch(/styles\.css/);
  });

  it("uses Tailwind's reset in the base layer, so utilities win over it", () => {
    expect(read('index.css')).toMatch(/@import\s+"tailwindcss\/preflight"\s+layer\(base\)/);
  });

  it('is light only, with the page background and text color taken from the tokens', () => {
    const css = read('index.css');
    expect(css).toMatch(/color-scheme:\s*light\s*;/);
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--page\)[^}]*\}/);
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--fg\)[^}]*\}/);
  });

  // The pinned action bar is about 4.5 rem tall, plus the safe-area inset on a phone with one; without this a field focused
  // near the bottom scrolls in underneath it.
  it('keeps a focused field clear of the pinned action bar, inset included', () => {
    const match = /html\s*\{[^}]*scroll-padding-bottom:\s*calc\((\d+(?:\.\d+)?)rem\s*\+\s*env\(safe-area-inset-bottom\)\)/.exec(read('index.css'));
    expect(match, 'html { scroll-padding-bottom: calc(N rem + env(safe-area-inset-bottom)) } is missing').not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(5);
  });
});
