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

// Source files of the screens and components: everything under `src` except tests and the token file.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return path === TOKEN_FILE ? [] : [path];
  });
}

const tokens = readTokens(readFileSync(TOKEN_FILE, 'utf8'));

describe('design tokens', () => {
  it('defines the colors, type scale, spacing and radii the screens use @spec(design-system/tokens-in-one-place/tokens-are-defined)', () => {
    const colors = ['page', 'card', 'soft', 'fg', 'muted-fg', 'border', 'brand', 'brand-hover', 'brand-fg', 'run', 'run-soft', 'cf', 'cf-soft', 'alert-bg', 'alert-bd', 'alert-fg', 'error', 'focus'];
    for (const name of colors) expect(tokens[name], `color token --${name}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    const css = readFileSync(TOKEN_FILE, 'utf8');
    for (const name of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'spacing', 'shadow-card'])
      expect(css, `--${name}`).toMatch(new RegExp(`--${name}\\s*:`));
  });

  it('maps the tokens into the Tailwind theme so utilities use them @spec(design-system/tokens-in-one-place/tokens-are-defined)', () => {
    const css = readFileSync(TOKEN_FILE, 'utf8');
    const theme = /@theme\s+inline\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(theme).not.toBe('');
    const colorMap: Record<string, string> = {};
    for (const [, name, token] of theme.matchAll(/--color-([a-z-]+)\s*:\s*var\(--([a-z0-9-]+)\)/g)) if (name && token) colorMap[name] = token;
    // The whole map, so a wrong mapping (say crossfit pointing at the running color) fails.
    expect(colorMap).toEqual({
      background: 'page', foreground: 'fg', card: 'card', 'card-foreground': 'fg', popover: 'card', 'popover-foreground': 'fg',
      primary: 'brand', 'primary-hover': 'brand-hover', 'primary-foreground': 'brand-fg',
      secondary: 'soft', 'secondary-foreground': 'fg', muted: 'soft', 'muted-foreground': 'muted-fg', accent: 'soft', 'accent-foreground': 'fg',
      destructive: 'error', border: 'border', input: 'border', ring: 'focus',
      run: 'run', 'run-soft': 'run-soft', crossfit: 'cf', 'crossfit-soft': 'cf-soft',
      alert: 'alert-bg', 'alert-border': 'alert-bd', 'alert-foreground': 'alert-fg', error: 'error',
    });
    for (const token of Object.values(colorMap)) expect(tokens[token], `--${token} is defined`).toBeDefined();
  });

  it('has a hover color for the accent that keeps its text readable @spec(responsive-accessibility/contrast-and-signals/token-pairs-meet-contrast)', () => {
    expect(pairsFile.pairs).toContainEqual(expect.objectContaining({ text: 'brand-fg', background: 'brand-hover', min: 4.5 }));
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

describe('the safety note', () => {
  it('is at least as readable as the weakest text on a day card @spec(plan-presentation/the-safety-note-comes-first/note-first)', () => {
    const note = contrastRatio(tokens['alert-fg'] ?? '', tokens['alert-bg'] ?? '');
    // A day card holds main text (fg) and secondary text (muted-fg) on the card color; the note must beat the weaker one.
    const weakestOnCard = Math.min(contrastRatio(tokens['fg'] ?? '', tokens['card'] ?? ''), contrastRatio(tokens['muted-fg'] ?? '', tokens['card'] ?? ''));
    expect(note).toBeGreaterThanOrEqual(weakestOnCard);
  });
});
