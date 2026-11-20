// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createPlanStore } from './db/plan-store.js';
import { createFakeCoach } from './coach/fake-coach.js';
import { migratedClient } from '../test/real-db.js';

// scripts/smoke-test checks a deployed stack: the server's health and read path, the client page, CORS, and that the write
// path is routed and refuses an invalid body without a coach call. It must never print a URL or a response body (the CI log
// of this public repository is public). Here it runs against the REAL app and against fake stacks with one deliberate fault.
const SCRIPT = fileURLToPath(new URL('../../scripts/smoke-test', import.meta.url));
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()!(); });

function listen(handler: http.RequestListener): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      closers.push(() => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }));
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

const BODY_MARKER = 'SECRET-BODY-TEXT-0451';
const json = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

// A client page, and a server that behaves like the real one unless a tweak says otherwise.
interface Tweaks {
  health?: (n: number, res: http.ServerResponse) => boolean | void; // return true when it answered
  plan?: (res: http.ServerResponse) => void;
  allowOrigin?: (origin: string | undefined, clientOrigin: string) => string | undefined; // what Access-Control-Allow-Origin says
  preflight?: (origin: string | undefined, res: http.ServerResponse) => boolean | void;
  post?: (res: http.ServerResponse, cors: Record<string, string>) => void;
  clientPage?: (res: http.ServerResponse) => void;
}
async function fakeStack(t: Tweaks = {}) {
  const clientUrl = await listen((_req, res) => {
    if (t.clientPage) return t.clientPage(res);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><html><body><div id="root"></div></body></html>');
  });
  let healthCalls = 0;
  const serverUrl = await listen((req, res) => {
    const origin = req.headers.origin;
    const allow = t.allowOrigin ? t.allowOrigin(origin, clientUrl) : origin === clientUrl ? clientUrl : undefined;
    const cors: Record<string, string> = allow ? { 'access-control-allow-origin': allow } : {};
    if (req.method === 'OPTIONS') {
      if (t.preflight?.(origin, res)) return;
      if (origin !== clientUrl) { res.writeHead(403); return void res.end(); }
      res.writeHead(204, { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS' });
      return void res.end();
    }
    if (req.url === '/health') {
      healthCalls++;
      if (t.health?.(healthCalls, res)) return;
      return json(res, 200, { status: 'ok' }, cors);
    }
    if (req.url === '/api/plan' && req.method === 'GET') {
      if (t.plan) return t.plan(res);
      return json(res, 200, null, cors);
    }
    if (req.url === '/api/plan' && req.method === 'POST') {
      if (t.post) return t.post(res, cors);
      return json(res, 400, { error: 'validation_error', message: 'Check the form.', fields: { goal: 'Goal is required.' } }, cors);
    }
    res.writeHead(404);
    res.end();
  });
  return { clientUrl, serverUrl };
}

interface Run { status: number | null; out: string }
function runSmoke(env: Record<string, string | undefined>): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, SMOKE_RETRY_DELAY_MS: '20', SMOKE_HEALTH_ATTEMPTS: '3', ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (status) => resolve({ status, out }));
  });
}
const smoke = async (t: Tweaks = {}) => {
  const { clientUrl, serverUrl } = await fakeStack(t);
  const run = await runSmoke({ SERVER_URL: serverUrl, CLIENT_URL: clientUrl });
  return { ...run, clientUrl, serverUrl };
};

describe('smoke test: a healthy stack', () => {
  it('passes every step against the real app (real Postgres, real CORS, the fake coach), and prints no URL or body', async () => {
    const db = await migratedClient();
    closers.push(() => db.cleanup());
    const clientUrl = await listen((_req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<div id="root"></div>'); });
    let coachCalls = 0;
    const coach = createFakeCoach();
    const serverUrl = await listen(createApp({
      coach: { generate: (...a) => { coachCalls++; return coach.generate(...a); } },
      reserveCall: async () => 1, callLimit: 20, store: createPlanStore(db.client), clientOrigin: clientUrl,
    }));
    const r = await runSmoke({ SERVER_URL: serverUrl, CLIENT_URL: clientUrl });
    expect(r.status, r.out).toBe(0);
    expect(r.out.match(/PASS/g)?.length).toBeGreaterThanOrEqual(6);
    expect(r.out).not.toMatch(/FAIL/);
    expect(coachCalls).toBe(0); // the invalid POST never reached the coach
    expect(r.out).not.toContain('127.0.0.1');
    expect(r.out).not.toContain(String((new URL(serverUrl)).port));
  });

  it('passes the fake stack, which is the baseline for every fault below', async () => {
    const r = await smoke();
    expect(r.status, r.out).toBe(0);
  });

  it('retries the health check while the new server is still starting, then passes', async () => {
    const r = await smoke({ health: (n, res) => { if (n < 3) { res.writeHead(503); res.end(); return true; } } });
    expect(r.status, r.out).toBe(0);
  });
});

describe('smoke test: each fault fails its own step', () => {
  const faultCases: [string, Tweaks, RegExp][] = [
    ['health says something other than ok', { health: (_n, res) => (json(res, 200, { status: 'down' }), true) }, /FAIL .*health/i],
    ['health keeps failing', { health: (_n, res) => (res.writeHead(500), res.end(), true) }, /FAIL .*health/i],
    ['the read path errors', { plan: (res) => json(res, 500, { error: 'server_error' }) }, /FAIL .*read path/i],
    ['the read path answers something that is not a plan', { plan: (res) => json(res, 200, { hello: 'world' }) }, /FAIL .*read path/i],
    ['the client page is missing', { clientPage: (res) => (res.writeHead(404), res.end()) }, /FAIL .*client page/i],
    ['the client page is not the app', { clientPage: (res) => (res.writeHead(200, { 'content-type': 'text/html' }), res.end('<h1>Welcome to nginx</h1>')) }, /FAIL .*client page/i],
    ['the client origin gets no CORS permission', { allowOrigin: () => undefined }, /FAIL .*CORS.*client origin/i],
    ['any origin is allowed (a wildcard)', { allowOrigin: () => '*' }, /FAIL .*CORS.*other origin/i],
    ['another origin passes the preflight', { preflight: (_o, res) => (res.writeHead(204, { 'access-control-allow-origin': 'https://smoke-test-other-origin.invalid' }), res.end(), true) }, /FAIL .*CORS.*other origin/i],
    ['the read path answers 500 with an empty body', { plan: (res) => json(res, 500, null) }, /FAIL .*read path/i],
    ['only the GET request lacks CORS permission', { plan: (res) => json(res, 200, null) }, /FAIL .*CORS.*client origin/i],
    ['the preflight of the client origin fails with 500', { preflight: (o, res) => { if (o?.includes('invalid')) return; res.writeHead(500, { 'access-control-allow-origin': o!, 'access-control-allow-methods': 'POST' }); res.end(); return true; } }, /FAIL .*CORS.*client origin/i],
    ['the preflight of the client origin has no allow-origin', { preflight: (o, res) => { if (o?.includes('invalid')) return; res.writeHead(204, { 'access-control-allow-methods': 'POST' }); res.end(); return true; } }, /FAIL .*CORS.*client origin/i],
    ['the preflight does not allow POST', { preflight: (o, res) => { if (o?.includes('invalid')) return; res.writeHead(204, { 'access-control-allow-origin': o!, 'access-control-allow-methods': 'GET' }); res.end(); return true; } }, /FAIL .*CORS.*client origin/i],
    ['an invalid POST is answered 200 with a validation error body', { post: (res, cors) => json(res, 200, { error: 'validation_error' }, cors) }, /FAIL .*invalid POST/i],
    ['an invalid POST is accepted', { post: (res, cors) => json(res, 200, { id: 1 }, cors) }, /FAIL .*invalid POST/i],
    ['an invalid POST reaches the coach (502 instead of 400)', { post: (res, cors) => json(res, 502, { error: 'coach_unavailable' }, cors) }, /FAIL .*invalid POST/i],
    ['the 400 is not a validation error', { post: (res, cors) => json(res, 400, { error: 'server_error' }, cors) }, /FAIL .*invalid POST/i],
    ['the 400 says a call was used', { post: (res, cors) => json(res, 400, { error: 'validation_error', remainingCallsToday: 19 }, cors) }, /FAIL .*invalid POST/i],
    ['the 400 has no CORS header for the client origin', { post: (res) => json(res, 400, { error: 'validation_error' }) }, /FAIL .*invalid POST/i],
  ];
  for (const [name, tweaks, expected] of faultCases) {
    it(`fails when ${name}`, async () => {
      const r = await smoke(tweaks);
      expect(r.status, r.out).toBe(1);
      expect(r.out).toMatch(expected);
    });
  }

  it('turns a connection that drops mid-run into a failed step with an error code, without crashing or printing the address', async () => {
    const r = await smoke({ plan: (res) => { res.socket?.destroy(); } });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/FAIL .*read path.*\(/i);
    expect(r.out).toMatch(/PASS .*health/i);
    expect(r.out).not.toContain('127.0.0.1');
    expect(r.out).not.toMatch(/at (async )?\w+.*\.js:\d+/); // no stack trace
  });

  it('stops after a failed health check (nothing else is meaningful) and says what it skipped', async () => {
    const r = await smoke({ health: (_n, res) => (res.writeHead(500), res.end(), true) });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/skipped/i);
    expect(r.out).not.toMatch(/PASS .*CORS/i);
  });

  it('reports every failing step, not only the first, when the server is up', async () => {
    const r = await smoke({ plan: (res) => json(res, 500, {}), post: (res, cors) => json(res, 200, {}, cors) });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/FAIL .*read path/i);
    expect(r.out).toMatch(/FAIL .*invalid POST/i);
    expect(r.out).toMatch(/PASS .*health/i);
  });
});

describe('smoke test: configuration and privacy', () => {
  it('exits 2 when a URL is missing or not an http(s) URL', async () => {
    expect((await runSmoke({ CLIENT_URL: 'http://127.0.0.1:1' })).status).toBe(2);
    expect((await runSmoke({ SERVER_URL: 'http://127.0.0.1:1' })).status).toBe(2);
    expect((await runSmoke({ SERVER_URL: 'ftp://x', CLIENT_URL: 'http://127.0.0.1:1' })).status).toBe(2);
    expect((await runSmoke({ SERVER_URL: 'not a url', CLIENT_URL: 'http://127.0.0.1:1' })).status).toBe(2);
  });

  it('fails without printing the address when the server cannot be reached', async () => {
    const clientUrl = await listen((_req, res) => (res.writeHead(200), res.end('<div id="root"></div>')));
    const r = await runSmoke({ SERVER_URL: 'http://127.0.0.1:1', CLIENT_URL: clientUrl });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/FAIL .*health/i);
    expect(r.out).not.toContain('127.0.0.1');
    expect(r.out).not.toContain(':1');
  });

  it('never prints a response body, whatever the status', async () => {
    const leaky = (res: http.ServerResponse, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'validation_error', message: BODY_MARKER, status: 'ok', hello: BODY_MARKER })); };
    for (const tweaks of [
      { health: (_n: number, res: http.ServerResponse) => (leaky(res, 500), true) },
      { plan: (res: http.ServerResponse) => leaky(res, 500) },
      { post: (res: http.ServerResponse) => leaky(res, 200) },
      { clientPage: (res: http.ServerResponse) => leaky(res, 404) },
    ] satisfies Tweaks[]) {
      const r = await smoke(tweaks);
      expect(r.out).not.toContain(BODY_MARKER);
    }
  });
});
