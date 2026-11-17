// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../scripts/scan-bundle', import.meta.url));
const dirs: string[] = [];
afterEach(() => { while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true }); });

// A fake build output: { 'relative/path': 'file text' }.
function bundle(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-scan-'));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
const scan = (dir: string) => {
  const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout, err: r.stderr };
};

const CLEAN = { 'index.html': '<div id="root"></div><script src="/assets/index.js"></script>', 'assets/index.js': 'console.log("hello", "/api/plan");' };

describe('scripts/scan-bundle', () => {
  it('passes a clean build and says how many files it checked @spec(deploy/no-secrets-and-restricted-origin/no-secret-in-the-repo-or-bundle)', () => {
    const r = scan(bundle(CLEAN));
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/2 files/);
  });

  it('fails a build with a planted key, naming the file and the rule but never the key itself @spec(deploy/no-secrets-and-restricted-origin/no-secret-in-the-repo-or-bundle)', () => {
    const r = scan(bundle({ ...CLEAN, 'assets/index.js': 'const k="sk-ant-api03-PLANTEDFAKEKEY123";' }));
    expect(r.status).toBe(1);
    expect(r.err).toContain('FOUND  assets/index.js:'); // a path relative to the build folder, not an absolute one
    expect(r.err).toContain('sk-ant-');
    expect(r.err).not.toContain('PLANTEDFAKEKEY123');
  });

  it('fails when a secret variable name is in the bundle', () => {
    for (const name of ['ANTHROPIC_API_KEY', 'DATABASE_URL']) {
      const r = scan(bundle({ ...CLEAN, 'assets/index.js': `process.env.${name}` }));
      expect(r.status, name).toBe(1);
      expect(r.err, name).toContain(name);
    }
  });

  it('fails on a database connection string, which would leak a DATABASE_URL value without its name, and never prints it', () => {
    for (const value of ['postgres://appuser:hunter2pw@db.example.com:5432/coach', 'postgresql://appuser:hunter2pw@db.example.com/coach']) {
      const r = scan(bundle({ ...CLEAN, 'assets/index.js': `const u="${value}";` }));
      expect(r.status, value).toBe(1);
      expect(r.err, value).toContain('FOUND  assets/index.js: found a database connection string');
      expect(r.err, value).not.toContain('hunter2pw');
      expect(r.err, value).not.toContain('db.example.com');
    }
  });

  it('looks in every kind of file and every folder, not only .js at the top', () => {
    for (const path of ['assets/deep/er/chunk.js.map', 'assets/style.css', 'index.html', 'a/b/c/d.txt']) {
      const r = scan(bundle({ ...CLEAN, [path]: 'DATABASE_URL' }));
      expect(r.status, path).toBe(1);
      expect(r.err, path).toContain(path);
    }
  });

  it('reports every finding, not just the first', () => {
    const r = scan(bundle({ 'a.js': 'DATABASE_URL', 'b.js': 'sk-ant-x', 'c.js': 'ANTHROPIC_API_KEY and DATABASE_URL' }));
    expect(r.status).toBe(1);
    for (const line of [
      'FOUND  a.js: found the secret name "DATABASE_URL"',
      'FOUND  b.js: found the Anthropic key prefix "sk-ant-"',
      'FOUND  c.js: found the secret name "ANTHROPIC_API_KEY"',
      'FOUND  c.js: found the secret name "DATABASE_URL"', // two rules in one file: both are reported
    ]) expect(r.err).toContain(line);
  });

  it('does not pass when there was nothing to scan (a missing or empty folder is an error, not a clean build)', () => {
    expect(scan(bundle({})).status).toBe(2);
    expect(scan(join(tmpdir(), 'bundle-scan-does-not-exist')).status).toBe(2);
    expect(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status).toBe(2); // no folder given
  });
});
