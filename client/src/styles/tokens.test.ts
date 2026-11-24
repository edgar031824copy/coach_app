// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio } from './contrast';
import pairsFile from './token-pairs.json';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_FILE = fileURLToPath(new URL('./tokens.css', import.meta.url));

// The values of every custom property declared in the token file's `:root` block.
function readTokens(css: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(css);
  if (!root) throw new Error('tokens.css has no :root block');
  const tokens: Record<string, string> = {};
  for (const [, name, value] of (root[1] ?? '').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) if (name && value) tokens[name] = value.trim();
  return tokens;
}

// Raw color values: hexadecimal, rgb(a), hsl(a), oklch. `var(--x)` and Tailwind utility names are not raw colors.
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g;
export function findRawColors(text: string): string[] {
  return text.match(RAW_COLOR) ?? [];
}

// Source files of the screens and components: everything under `src` except tests, the token file and the legacy
// stylesheet (see LEGACY below).
const LEGACY = ['styles.css']; // E1's plain stylesheet; it goes away when the views are rebuilt (tasks 2.3 and 3.1).
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return path === TOKEN_FILE || LEGACY.includes(relative(SRC, path)) ? [] : [path];
  });
}

const tokens = readTokens(readFileSync(TOKEN_FILE, 'utf8'));

describe('design tokens', () => {
  it('defines the colors, type scale, spacing and radii the screens use @spec(design-system/tokens-in-one-place/tokens-are-defined)', () => {
    const colors = ['page', 'card', 'soft', 'fg', 'muted-fg', 'border', 'brand', 'brand-fg', 'run', 'run-soft', 'cf', 'cf-soft', 'alert-bg', 'alert-bd', 'alert-fg', 'error', 'focus'];
    for (const name of colors) expect(tokens[name], `color token --${name}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    const css = readFileSync(TOKEN_FILE, 'utf8');
    for (const name of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'spacing'])
      expect(css, `--${name}`).toMatch(new RegExp(`--${name}\\s*:`));
  });

  it('maps the tokens into the Tailwind theme so utilities use them @spec(design-system/tokens-in-one-place/tokens-are-defined)', () => {
    const css = readFileSync(TOKEN_FILE, 'utf8');
    expect(css).toMatch(/@theme\s+inline\s*\{/);
    expect(css).toMatch(/--color-primary\s*:\s*var\(--brand\)/);
    expect(css).toMatch(/--color-background\s*:\s*var\(--page\)/);
  });

  it('lists every text-on-background pair with its minimum ratio and meets it @spec(responsive-accessibility/contrast-and-signals/token-pairs-meet-contrast)', () => {
    const pairs = pairsFile.pairs;
    expect(pairs.length).toBeGreaterThan(0);
    for (const { text, background, min } of pairs) {
      expect([4.5, 3], `${text} on ${background}: the minimum is 4.5 (text) or 3 (large text, interface parts)`).toContain(min);
      expect(tokens[text], `token --${text}`).toBeDefined();
      expect(tokens[background], `token --${background}`).toBeDefined();
      const ratio = contrastRatio(tokens[text] ?? '', tokens[background] ?? '');
      expect(ratio, `${text} on ${background}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('puts every color that carries text or an icon into at least one listed pair', () => {
    const listed = new Set(pairsFile.pairs.flatMap((p) => [p.text, p.background]));
    for (const name of ['fg', 'muted-fg', 'brand', 'brand-fg', 'run', 'cf', 'alert-fg', 'error', 'focus']) expect(listed, `--${name}`).toContain(name);
  });
});

describe('raw colors', () => {
  it('finds hexadecimal, rgb, hsl and oklch values and ignores variables @spec(design-system/tokens-in-one-place/no-raw-colors-in-the-screens)', () => {
    expect(findRawColors('color: #fff; a: #2563EB; b: rgb(0 0 0); c: rgba(0,0,0,.1); d: hsl(1 2% 3%); e: oklch(0.5 0 0)')).toHaveLength(6);
    expect(findRawColors('color: var(--fg); className="bg-primary text-white" id="root"')).toEqual([]);
  });

  it('finds none in the screen and component source outside the token file @spec(design-system/tokens-in-one-place/no-raw-colors-in-the-screens)', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(5); // the scan must actually see the source
    expect(files.map((f) => basename(f))).not.toContain('tokens.css');
    const offenders = files.flatMap((f) => findRawColors(readFileSync(f, 'utf8')).map((c) => `${relative(SRC, f)}: ${c}`));
    expect(offenders).toEqual([]);
  });
});
