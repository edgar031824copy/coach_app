// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// scripts/package-vercel turns the built client (client/dist) into a Vercel "Build Output API" folder, so the workflow can
// upload a client that was already built and scanned in GitHub Actions (`vercel deploy --prebuilt`).
const SCRIPT = fileURLToPath(new URL('../../scripts/package-vercel', import.meta.url));
const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'pkg-vercel-')); dirs.push(d); return d; };
function dist(files: Record<string, string>) {
  const d = tmp();
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(d, name, '..'), { recursive: true });
    writeFileSync(join(d, name), text);
  }
  return d;
}
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const list = (root: string, sub = ''): string[] =>
  readdirSync(join(root, sub), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(root, join(sub, e.name)) : [join(sub, e.name)])).sort();

describe('scripts/package-vercel', () => {
  it('copies the built files into <out>/static and writes the version-3 config, and leaves the source alone', () => {
    const src = dist({ 'index.html': '<div id="root"></div>', 'assets/app.js': 'x' });
    const out = join(tmp(), '.vercel', 'output');
    const r = run(src, out);
    expect(r.status).toBe(0);
    expect(list(out)).toEqual(['config.json', 'static/assets/app.js', 'static/index.html']);
    expect(readFileSync(join(out, 'static/index.html'), 'utf8')).toBe('<div id="root"></div>');
    expect(JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'))).toEqual({ version: 3 });
    expect(list(src)).toEqual(['assets/app.js', 'index.html']);
  });

  it('replaces an older output instead of mixing with it', () => {
    const src = dist({ 'index.html': 'new' });
    const out = join(tmp(), 'output');
    mkdirSync(join(out, 'static'), { recursive: true });
    writeFileSync(join(out, 'static', 'stale.js'), 'old');
    expect(run(src, out).status).toBe(0);
    expect(existsSync(join(out, 'static', 'stale.js'))).toBe(false);
  });

  it('exits 2 and writes nothing when the folder is missing, empty, or has no index.html', () => {
    for (const src of [join(tmp(), 'nope'), dist({}), dist({ 'app.js': 'x' })]) {
      const out = join(tmp(), 'output');
      const r = run(src, out);
      expect(r.status).toBe(2);
      expect(existsSync(out)).toBe(false);
    }
  });

  it('exits 2 when the arguments are missing', () => {
    expect(run().status).toBe(2);
    expect(run(dist({ 'index.html': 'x' })).status).toBe(2);
  });
});
