// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// scripts/render-deploy starts a deploy of the server on Render and waits until it is live. It talks to Render's API with a
// secret key, and the CI log of this public repository is public: it must print status names only, never the key, the
// service id, the API address or a response body. Here it runs against a fake Render API.
const SCRIPT = fileURLToPath(new URL('../../scripts/render-deploy', import.meta.url));
const KEY = 'rnd_SECRETKEY0451'; // a made-up value for the fake API; gitleaks:allow
const SERVICE = 'srv-secretservice0451';
const BODY_MARKER = 'SECRET-BODY-TEXT-0451';
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()!(); });

interface Seen { method: string; url: string; auth?: string; body: string }
type Handler = (seen: Seen, n: number, res: http.ServerResponse) => void;
async function fakeRender(handler: Handler) {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const s = { method: req.method!, url: req.url!, auth: req.headers.authorization, body };
      seen.push(s);
      handler(s, seen.length, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  closers.push(() => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}
const send = (res: http.ServerResponse, status: number, body?: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
// POST answers with a deploy id; each GET answers with the next status of the list, repeating the last one.
const statuses = (list: string[]): Handler => (s, _n, res) => {
  if (s.method === 'POST') return send(res, 201, { id: 'dep-1', status: 'created', marker: BODY_MARKER });
  const polls = (statuses as unknown as { n: number }).n++;
  send(res, 200, { id: 'dep-1', status: list[Math.min(polls, list.length - 1)], marker: BODY_MARKER });
};

function run(env: Record<string, string | undefined>): Promise<{ code: number; out: string }> {
  (statuses as unknown as { n: number }).n = 0;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: { PATH: process.env.PATH, RENDER_POLL_MS: '20', RENDER_DEPLOY_TIMEOUT_MS: '3000', ...env } as NodeJS.ProcessEnv,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}
const base = (api: string, more: Record<string, string> = {}) => ({ RENDER_API_KEY: KEY, RENDER_SERVICE_ID: SERVICE, RENDER_API_BASE: api, ...more });
const noSecrets = (out: string, api: string) => {
  for (const secret of [KEY, SERVICE, BODY_MARKER, api, new URL(api).host]) expect(out).not.toContain(secret);
};

describe('scripts/render-deploy', () => {
  it('starts a deploy of the given commit with the bearer key, waits until it is live, and exits 0', async () => {
    const api = await fakeRender(statuses(['created', 'build_in_progress', 'update_in_progress', 'live']));
    const r = await run(base(api.base, { COMMIT_SHA: 'abc123def' }));
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/live/);
    const post = api.seen[0]!;
    expect(post.method).toBe('POST');
    expect(post.url).toBe(`/v1/services/${SERVICE}/deploys`);
    expect(post.auth).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(post.body)).toEqual({ commitId: 'abc123def' });
    expect(api.seen[1]).toMatchObject({ method: 'GET', url: `/v1/services/${SERVICE}/deploys/dep-1`, auth: `Bearer ${KEY}` });
    expect(api.seen.length).toBe(5); // one POST, then four polls: it stopped as soon as the deploy was live
    noSecrets(r.out, api.base);
  });

  it('deploys the latest commit when none is given (no commitId in the request)', async () => {
    const api = await fakeRender(statuses(['live']));
    expect((await run(base(api.base))).code).toBe(0);
    expect(JSON.parse(api.seen[0]!.body)).toEqual({});
  });

  it.each(['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated'])('exits 1 and names the status when the deploy ends as %s', async (status) => {
    const api = await fakeRender(statuses(['build_in_progress', status]));
    const r = await run(base(api.base));
    expect(r.code).toBe(1);
    expect(r.out).toContain(`ended as ${status}`); // it stopped on the failure, it did not wait for the timeout
    noSecrets(r.out, api.base);
  });

  it('exits 1 on a timeout when the deploy never gets live', async () => {
    const api = await fakeRender(statuses(['build_in_progress']));
    const r = await run(base(api.base, { RENDER_DEPLOY_TIMEOUT_MS: '300' }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/did not (become|get) live/i);
    noSecrets(r.out, api.base);
  });

  it('finds the new deploy in the list when Render answers 202 with no body', async () => {
    const api = await fakeRender((s, _n, res) => {
      if (s.method === 'POST') return send(res, 202);
      if (s.url.startsWith(`/v1/services/${SERVICE}/deploys?`)) return send(res, 200, [{ deploy: { id: 'dep-9', status: 'created', commit: { id: 'abc123def' } } }]);
      send(res, 200, { id: 'dep-9', status: 'live' });
    });
    const r = await run(base(api.base, { COMMIT_SHA: 'abc123def' }));
    expect(r.code).toBe(0);
    expect(api.seen.some((s) => s.url === `/v1/services/${SERVICE}/deploys/dep-9`)).toBe(true);
  });

  it('uses the deploy of this commit from the list, not just the newest one, and fails when none matches', async () => {
    const list = (items: unknown[]): Handler => (s, _n, res) => {
      if (s.method === 'POST') return send(res, 202);
      if (s.url.startsWith(`/v1/services/${SERVICE}/deploys?`)) return send(res, 200, items);
      send(res, 200, { status: 'live' });
    };
    const mixed = [{ deploy: { id: 'dep-other', commit: { id: 'zzz999' } } }, { deploy: { id: 'dep-mine', commit: { id: 'abc123def' } } }];
    const api = await fakeRender(list(mixed));
    expect((await run(base(api.base, { COMMIT_SHA: 'abc123def' }))).code).toBe(0);
    expect(api.seen.some((s) => s.url.endsWith('/deploys/dep-mine'))).toBe(true);
    expect(api.seen.some((s) => s.url.endsWith('/deploys/dep-other'))).toBe(false);
    const none = await fakeRender(list([mixed[0]]));
    const r = await run(base(none.base, { COMMIT_SHA: 'abc123def' }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/could not be found/);
  });

  it('keeps waiting through a failed or garbled poll answer instead of failing the deploy', async () => {
    let polls = 0;
    const api = await fakeRender((s, _n, res) => {
      if (s.method === 'POST') return send(res, 201, { id: 'dep-1' });
      polls++;
      if (polls === 1) return send(res, 500, { marker: BODY_MARKER });
      if (polls === 2) { res.writeHead(200); return void res.end('not json'); }
      send(res, 200, { status: 'live' });
    });
    const r = await run(base(api.base));
    expect(r.code).toBe(0);
    noSecrets(r.out, api.base);
  });

  it('exits 1 with only the status code when Render refuses the request (bad key)', async () => {
    const api = await fakeRender((_s, _n, res) => send(res, 401, { message: BODY_MARKER }));
    const r = await run(base(api.base));
    expect(r.code).toBe(1);
    expect(r.out).toContain('401');
    noSecrets(r.out, api.base);
  });

  it('exits 1 without printing the address when Render cannot be reached', async () => {
    const r = await run(base('http://127.0.0.1:1'));
    expect(r.code).toBe(1);
    expect(r.out).not.toContain('127.0.0.1');
    expect(r.out).not.toContain(KEY);
  });

  it.each(['RENDER_API_KEY', 'RENDER_SERVICE_ID'])('exits 2 when %s is missing, without calling Render', async (missing) => {
    const api = await fakeRender(statuses(['live']));
    const r = await run({ ...base(api.base), [missing]: undefined });
    expect(r.code).toBe(2);
    expect(r.out).toContain(missing);
    expect(api.seen).toEqual([]);
  });
});
