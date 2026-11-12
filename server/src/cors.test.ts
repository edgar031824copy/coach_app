import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import type { CoachClient } from './coach/types.js';
import { appHarness, ORIGIN } from '../test/app-harness.js';

const coach: CoachClient = {
  async generate() {
    throw new Error('not used');
  },
};
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());
const ACAO = 'access-control-allow-origin';

describe('CORS allows only the client origin', () => {
  it('allows the client origin and varies the response by origin', async () => {
    h = await appHarness({ coach });
    const res = await request(h.app).get('/api/plan').set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers[ACAO]).toBe(ORIGIN);
    expect(res.headers['vary']).toMatch(/Origin/i);
  });

  it('gives no permission to any other origin @spec(deploy/no-secrets-and-restricted-origin/other-origins-are-refused)', async () => {
    h = await appHarness({ coach });
    for (const origin of ['https://evil.example.com', 'http://app.example.com', 'https://app.example.com.evil.com', 'null']) {
      for (const send of [
        () => request(h.app).get('/api/plan').set('Origin', origin),
        () => request(h.app).post('/api/plan').set('Origin', origin).send({}),
        () => request(h.app).get('/health').set('Origin', origin),
      ]) {
        const res = await send();
        expect(res.headers[ACAO]).toBeUndefined();
      }
    }
  });

  it('refuses a preflight from another origin and answers one from the client origin @spec(deploy/no-secrets-and-restricted-origin/other-origins-are-refused)', async () => {
    h = await appHarness({ coach });
    const other = await request(h.app).options('/api/plan').set('Origin', 'https://evil.example.com').set('Access-Control-Request-Method', 'POST');
    expect(other.status).toBe(403);
    expect(other.headers[ACAO]).toBeUndefined();

    const ok = await request(h.app).options('/api/plan').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
    expect(ok.status).toBe(204);
    expect(ok.headers[ACAO]).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-methods']).toMatch(/POST/);
    expect(ok.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });

  it('never answers with a wildcard', async () => {
    h = await appHarness({ coach });
    const res = await request(h.app).get('/api/plan').set('Origin', ORIGIN);
    expect(res.headers[ACAO]).not.toBe('*');
  });

  it('serves a request without an Origin header normally, with no CORS header', async () => {
    h = await appHarness({ coach });
    const res = await request(h.app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers[ACAO]).toBeUndefined();
  });

  it('lets the client origin read error responses too (so the page can show them)', async () => {
    h = await appHarness({ coach });
    const tooLarge = await request(h.app).post('/api/plan').set('Origin', ORIGIN).send({ injuries: 'x'.repeat(17 * 1024) });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.headers[ACAO]).toBe(ORIGIN);
    const invalid = await request(h.app).post('/api/plan').set('Origin', ORIGIN).send({});
    expect(invalid.status).toBe(400);
    expect(invalid.headers[ACAO]).toBe(ORIGIN);
  });
});
