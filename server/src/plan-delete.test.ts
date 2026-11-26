import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { ApiErrorSchema, type Onboarding } from 'shared';
import type { CoachClient } from './coach/types.js';
import { appHarness, ORIGIN } from '../test/app-harness.js';
import { responseWith, session } from '../test/fixtures.js';

// Task 1.4 (coach-plan-week-and-delete): DELETE /api/plan/:id, and CORS for it.
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};
const good = (note: string) => () => ({ ...responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] }), plan: { ...responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] }).plan, recommendations: [note] } });
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());

// A coach whose plans can be told apart, and a record of how often it was asked.
function setup() {
  let n = 0;
  const seen: Onboarding[] = [];
  const coach: CoachClient = { async generate(onboarding) { seen.push(onboarding); n += 1; return good(`plan ${n}`)(); } };
  return { coach, seen };
}
const make = async () => Number((await h.post(body)).body.id);
const ids = async () => (await h.rows('select id from plans order by id')).map((r) => Number(r.id));

describe('DELETE /api/plan/:id', () => {
  it('answers 204 with no body and removes the plan @spec(plan-deletion/deleting-a-plan/a-stored-plan-is-deleted)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const id = await make();
    const res = await h.del(id);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await h.plans()).toBe(0);
  });

  it('never returns a deleted plan again: the next newest is the latest, then null @spec(plan-deletion/deleting-a-plan/a-deleted-plan-never-comes-back)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const older = await make();
    const newest = await make();
    expect((await h.get()).body.id).toBe(newest);
    expect((await h.del(newest)).status).toBe(204);
    expect((await h.get()).body.id).toBe(older);
    expect((await h.del(older)).status).toBe(204);
    expect((await h.get()).body).toBeNull();
  });

  it('leaves the other plans stored with the same content @spec(plan-deletion/deleting-a-plan/other-plans-stay)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const [a, b, c] = [await make(), await make(), await make()];
    const before = await h.rows('select id, plan, onboarding, created_at, week_start from plans where id <> ' + b + ' order by id');
    expect((await h.del(b)).status).toBe(204);
    expect(await ids()).toEqual([a, c]);
    expect(await h.rows('select id, plan, onboarding, created_at, week_start from plans order by id')).toEqual(before);
  });

  it('answers 404 not_found for an unknown id and for one already deleted, changing nothing @spec(plan-deletion/deleting-a-plan/unknown-plan)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const id = await make();
    const unknown = await h.del(id + 1000);
    expect(unknown.status).toBe(404);
    expect(ApiErrorSchema.parse(unknown.body).error).toBe('not_found');
    expect(await ids()).toEqual([id]);
    expect((await h.del(id)).status).toBe(204);
    const again = await h.del(id);
    expect(again.status).toBe(404);
    expect(ApiErrorSchema.parse(again.body).error).toBe('not_found');
  });

  it.each(['abc', '0', '-3', '1.5', '01', '99999999999999999999', '9007199254740992', '1e3', '%20', '0x10'])(
    'answers 400 validation_error for the id "%s", changing nothing @spec(plan-deletion/deleting-a-plan/id-is-not-a-whole-number)',
    async (id) => {
      const { coach } = setup();
      h = await appHarness({ coach });
      const stored = await make();
      const res = await h.del(id);
      expect(res.status, id).toBe(400);
      expect(ApiErrorSchema.parse(res.body).error).toBe('validation_error');
      expect(await ids()).toEqual([stored]);
    },
  );

  it('treats the largest safe whole number as a valid id that is simply not stored', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    expect((await h.del('9007199254740991')).status).toBe(404); // a 404, not a 400 and not a 500
  });

  it('answers 204 to one of two simultaneous deletions and 404 to the other @spec(plan-deletion/deleting-a-plan/two-deletions-at-once)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const keep = await make();
    const id = await make();
    const statuses = (await Promise.all([h.del(id), h.del(id)])).map((r) => r.status).sort();
    expect(statuses).toEqual([204, 404]);
    expect(await ids()).toEqual([keep]);
  });

  it('does not call the coach and does not change the day\'s call count @spec(plan-deletion/deleting-a-plan/cap-and-coach-are-untouched)', async () => {
    const { coach, seen } = setup();
    h = await appHarness({ coach, limit: 5 });
    const id = await make();
    const callsBefore = await h.calls();
    expect(callsBefore).toBe(1);
    expect((await h.del(id)).status).toBe(204);
    expect((await h.del(id)).status).toBe(404);
    expect(await h.calls()).toBe(callsBefore); // neither spent nor refunded
    expect(seen).toHaveLength(1); // the coach was asked once, by the POST
  });

  it('turns a store failure into the usual 500 without any detail', async () => {
    const { coach } = setup();
    h = await appHarness({ coach, store: { async save() { throw new Error('unused'); }, async latest() { return null; }, async delete() { throw new Error('database unreachable: secret detail'); } } });
    const res = await h.del(1);
    expect(res.status).toBe(500);
    expect(ApiErrorSchema.parse(res.body)).toEqual({ error: 'server_error', message: 'Something went wrong.' });
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('CORS for DELETE', () => {
  it('answers a preflight from the client origin with DELETE allowed, and refuses one from another origin @spec(plan-deletion/deleting-a-plan/only-the-client-origin-may-delete)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const ok = await request(h.app).options('/api/plan/5').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'DELETE');
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-methods']).toMatch(/\bDELETE\b/);
    const other = await request(h.app).options('/api/plan/5').set('Origin', 'https://evil.example.com').set('Access-Control-Request-Method', 'DELETE');
    expect(other.status).toBe(403);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('gives a DELETE from another origin no permission header', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const res = await request(h.app).delete('/api/plan/5').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still lists GET and POST', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const ok = await request(h.app).options('/api/plan').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-methods']).toMatch(/GET/);
    expect(ok.headers['access-control-allow-methods']).toMatch(/POST/);
  });
});
