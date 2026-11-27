import { describe, it, expect, afterEach } from 'vitest';
import { PlanResponseSchema, type Onboarding } from 'shared';
import type { CoachClient } from './coach/types.js';
import { appHarness } from '../test/app-harness.js';
import { responseWith, session } from '../test/fixtures.js';

// Task 1.3 (coach-plan-history): POST /api/plan replaces the plan of a stored week and keeps it when a build fails.
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};
const days = { mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] };
const withNote = (note: string) => {
  const r = responseWith(days);
  return { ...r, plan: { ...r.plan, recommendations: [note] } };
};

// A coach whose answers can be told apart (plan 1, plan 2...) and that can be told to fail.
function setup() {
  let n = 0;
  const mode: { next: 'ok' | 'throw' | 'invalid' } = { next: 'ok' };
  const seen: Onboarding[] = [];
  const coach: CoachClient = {
    async generate(onboarding) {
      seen.push(onboarding);
      n += 1;
      if (mode.next === 'throw') throw new Error('coach down');
      if (mode.next === 'invalid') return { plan: { days: 'none' }, summary: 'x' } as never;
      return withNote(`plan ${n}`);
    },
  };
  return { coach, mode, seen };
}
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());
const allRows = () => h.rows('select id, plan, onboarding, created_at, week_start from plans order by id');
const WEEK = '2026-11-23';

describe('POST /api/plan: one plan per week', () => {
  it('replaces the stored plan of the week: same id, new plan and creation time, one row @spec(plan-storage/submitting-again-replaces-the-shown-plan/second-submission)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const first = await h.post({ ...body, weekStart: WEEK });
    const second = await h.post({ ...body, goal: 'Run a 10k', weekStart: WEEK });
    expect(second.status).toBe(200);
    expect(PlanResponseSchema.parse(second.body).id).toBe(first.body.id); // the row and its id stay
    expect(second.body.plan.recommendations).toEqual(['plan 2']);
    expect(Date.parse(second.body.createdAt)).toBeGreaterThanOrEqual(Date.parse(first.body.createdAt));
    expect(await h.plans()).toBe(1); // the number of stored plans is the same
    const shown = await h.get();
    expect(shown.body.id).toBe(first.body.id);
    expect(shown.body.onboarding.goal).toBe('Run a 10k');
    expect(shown.body.plan.recommendations).toEqual(['plan 2']);
    expect(shown.body.createdAt).toBe(second.body.createdAt);
  });

  it('adds a plan for another week and leaves the others stored @spec(plan-storage/submitting-again-replaces-the-shown-plan/a-submission-for-another-week-is-added)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach });
    const a = await h.post({ ...body, weekStart: '2026-11-16' });
    const b = await h.post({ ...body, weekStart: WEEK });
    const before = await allRows();
    const c = await h.post({ ...body, weekStart: '2026-11-30' });
    expect(c.status).toBe(200);
    expect(new Set([a.body.id, b.body.id, c.body.id]).size).toBe(3);
    expect(await h.plans()).toBe(3);
    expect((await allRows()).slice(0, 2)).toEqual(before); // the others are exactly as they were
    expect((await h.get()).body.id).toBe(c.body.id); // GET /api/plan still serves the latest made
  });

  it('adds without a week sent when the current week has no plan, and replaces when it has one (an old client)', async () => {
    const { coach } = setup();
    h = await appHarness({ coach }); // the harness clock is Tuesday 2026-11-10: the week of 2026-11-09
    const first = await h.post(body);
    const second = await h.post(body);
    expect(second.body.id).toBe(first.body.id);
    expect(await h.plans()).toBe(1);
  });

  describe.each([
    ['the coach is unavailable', 'throw', 502, 1],
    ['the coach answers an invalid plan', 'invalid', 422, 1],
  ] as const)('when %s', (_label, mode, status, spent) => {
    it(`keeps the stored plan of that week exactly as it was and spends the call as before @spec(plan-week/one-plan-per-week/a-failed-build-keeps-the-stored-plan)`, async () => {
      const s = setup();
      h = await appHarness({ coach: s.coach });
      await h.post({ ...body, weekStart: WEEK });
      const rows = await allRows();
      const calls = await h.calls();
      s.mode.next = mode;
      const res = await h.post({ ...body, goal: 'Run a 10k', weekStart: WEEK });
      expect(res.status).toBe(status);
      expect(await allRows()).toEqual(rows); // byte for byte: id, plan, onboarding, created_at, week
      expect(await h.calls()).toBe(calls + spent);
      expect((await h.get()).body.plan.recommendations).toEqual(['plan 1']);
    });
  });

  it('keeps the stored plan, calls no coach and spends nothing when the week is refused @spec(plan-week/one-plan-per-week/a-failed-build-keeps-the-stored-plan)', async () => {
    const s = setup();
    h = await appHarness({ coach: s.coach });
    await h.post({ ...body, weekStart: WEEK });
    const rows = await allRows();
    const calls = await h.calls();
    const res = await h.post({ ...body, weekStart: '2026-11-24' }); // a Tuesday
    expect(res.status).toBe(400);
    expect(await allRows()).toEqual(rows);
    expect(s.seen.length).toBe(1);
    expect(await h.calls()).toBe(calls);
  });
});
