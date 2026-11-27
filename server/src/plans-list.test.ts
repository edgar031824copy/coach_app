import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { ApiErrorSchema, PlansResponseSchema } from 'shared';
import type { CoachClient } from './coach/types.js';
import { appHarness, ORIGIN } from '../test/app-harness.js';
import { responseWith, session } from '../test/fixtures.js';

// Task 1.4 (coach-plan-history): GET /api/plans.
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};
let n = 0;
let coachCalls = 0;
const coach: CoachClient = {
  async generate() {
    coachCalls += 1;
    n += 1;
    const r = responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] });
    return { ...r, plan: { ...r.plan, recommendations: [`plan ${n}`] } };
  },
};
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());
const list = () => request(h.app).get('/api/plans');

describe('GET /api/plans', () => {
  it('lists every plan by week, oldest first, each with all its fields @spec(stored-plans/listing-the-stored-plans/all-plans-in-week-order)', async () => {
    h = await appHarness({ coach });
    await h.post({ ...body, weekStart: '2026-11-30' });
    await h.post({ ...body, weekStart: '2026-11-16' });
    await h.post({ ...body, weekStart: '2026-11-23' });
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const { plans } = PlansResponseSchema.parse(res.body);
    expect(plans.map((p) => p.weekStart)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    for (const p of plans) expect(Object.keys(p).sort()).toEqual(['createdAt', 'id', 'onboarding', 'plan', 'weekStart']);
    // the same record GET /api/plan gives for the newest made (week 23 was made last)
    expect(plans[1]).toEqual((await h.get()).body);
  });

  it('returns an empty list when nothing is stored @spec(stored-plans/listing-the-stored-plans/no-plan-yet)', async () => {
    h = await appHarness({ coach });
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ plans: [] });
  });

  it('does not call the coach, change the count or change anything stored @spec(stored-plans/listing-the-stored-plans/reading-does-not-call-the-coach-or-count)', async () => {
    h = await appHarness({ coach });
    await h.post({ ...body, weekStart: '2026-11-16' });
    coachCalls = 0;
    const calls = await h.calls();
    const rows = await h.rows('select * from plans order by id');
    for (let i = 0; i < 3; i++) expect((await list()).status).toBe(200);
    expect(coachCalls).toBe(0);
    expect(await h.calls()).toBe(calls);
    expect(await h.rows('select * from plans order by id')).toEqual(rows);
  });

  it('lists a rebuilt week once, with the newer plan @spec(stored-plans/listing-the-stored-plans/a-rebuilt-week-is-listed-once)', async () => {
    h = await appHarness({ coach });
    await h.post({ ...body, weekStart: '2026-11-23' });
    const second = await h.post({ ...body, weekStart: '2026-11-23' });
    const { plans } = PlansResponseSchema.parse((await list()).body);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe(second.body.id);
    expect(plans[0]?.plan.recommendations).toEqual(second.body.plan.recommendations);
  });

  it('answers a 500 server_error that carries no detail when the store fails @spec(stored-plans/listing-the-stored-plans/a-store-failure)', async () => {
    h = await appHarness({
      coach,
      store: {
        async save() { throw new Error('unused'); },
        async latest() { throw new Error('unused'); },
        async list() { throw new Error('database unreachable: secret detail'); },
        async delete() { throw new Error('unused'); },
      },
    });
    const res = await list();
    expect(res.status).toBe(500);
    expect(ApiErrorSchema.parse(res.body)).toEqual({ error: 'server_error', message: 'Something went wrong.' });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('gives CORS headers to the client origin only, and keeps GET allowed on the preflight', async () => {
    h = await appHarness({ coach });
    const ok = await request(h.app).get('/api/plans').set('Origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const other = await request(h.app).get('/api/plans').set('Origin', 'https://evil.example.com');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    const pre = await request(h.app).options('/api/plans').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'GET');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-methods']).toMatch(/\bGET\b/);
    const preOther = await request(h.app).options('/api/plans').set('Origin', 'https://evil.example.com').set('Access-Control-Request-Method', 'GET');
    expect(preOther.status).toBe(403);
  });
});
