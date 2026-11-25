// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name: string) => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

// Task 2.3: two risks recorded at the group 1 review. E1's plain stylesheet is unlayered and would beat Tailwind's
// utilities (which live in a layer) on every shared property; and the page background must be the token, light only.
describe('page styles', () => {
  it('keeps the legacy stylesheet in a layer that sits below Tailwind, so utilities win', () => {
    expect(read('styles.css')).toMatch(/^(?:\s*\/\*[\s\S]*?\*\/)?\s*@layer legacy\s*\{/);
    const main = read('main.tsx');
    expect(main.indexOf("'./styles.css'")).toBeGreaterThan(-1);
    expect(main.indexOf("'./styles.css'")).toBeLessThan(main.indexOf("'./index.css'")); // the layer is declared first, so it ranks lowest
  });

  it('has no dark-scheme rule left in the legacy stylesheet, because the page is light only', () => {
    expect(read('styles.css')).not.toMatch(/prefers-color-scheme/);
  });

  it('is light only, with the page background and text color taken from the tokens', () => {
    const css = read('index.css');
    expect(css).toMatch(/color-scheme:\s*light\s*;/);
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--page\)[^}]*\}/);
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--fg\)[^}]*\}/);
  });
});
