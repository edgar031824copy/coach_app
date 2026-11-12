import { describe, it, expect, afterEach } from 'vitest';
import { ApiErrorSchema, PlanResponseSchema, type Onboarding } from 'shared';
import { CoachOutputError, type CoachClient, type CoachContext } from './coach/types.js';
import type { PlanStore } from './db/plan-store.js';
import { appHarness, NOW } from '../test/app-harness.js';
import { PASTE, responseWith, session } from '../test/fixtures.js';

const body = {
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
};
const good = () => responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] });

// A coach that records what it was asked and answers with whatever the test gives it.
const fakeCoach = (answer: () => unknown | Promise<unknown>) => {
  const seen: { onboarding: Onboarding; context: CoachContext }[] = [];
  const coach: CoachClient = {
    async generate(onboarding, context) {
      seen.push({ onboarding, context });
      return answer();
    },
  };
  return { coach, seen };
};

let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());

describe('POST /api/plan: success', () => {
  it('returns a PlanResponse with seven days in order, saves it, and counts the call @spec(plan-generation/seven-day-plan/valid-onboarding-gives-seven-days) @spec(plan-storage/save-only-valid-plans/valid-plan-is-saved-with-its-onboarding)', async () => {
    const { coach, seen } = fakeCoach(good);
    h = await appHarness({ coach, limit: 20 });
    const res = await h.post(body);
    expect(res.status).toBe(200);
    const plan = PlanResponseSchema.parse(res.body);
    expect(plan.plan.days.map((d) => d.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(plan.remainingCallsToday).toBe(19);
    expect(plan.onboarding.goal).toBe('Run a half marathon');
    expect(seen).toHaveLength(1); // control case: a valid body does call the coach
    expect(await h.plans()).toBe(1);
    expect(await h.calls()).toBe(1); // and does use one cap slot
    expect(await h.latestId()).toBe(plan.id); // the saved row is the one returned
  });

  it('sends the target event and today\'s UTC date to the coach @spec(plan-generation/target-event-as-context/event-is-sent-to-the-coach)', async () => {
    const { coach, seen } = fakeCoach(good);
    h = await appHarness({ coach });
    await h.post({ ...body, targetEvent: { name: 'City Half', date: '2026-12-06' } });
    expect(seen[0]?.onboarding.targetEvent).toEqual({ name: 'City Half', date: '2026-12-06' });
    expect(seen[0]?.context.today).toBe('2026-11-10');
    expect(NOW.toISOString().slice(0, 10)).toBe('2026-11-10');
  });

  it('counts down remainingCallsToday with each call', async () => {
    const { coach } = fakeCoach(good);
    h = await appHarness({ coach, limit: 3 });
    expect((await h.post(body)).body.remainingCallsToday).toBe(2);
    expect((await h.post(body)).body.remainingCallsToday).toBe(1);
    expect((await h.post(body)).body.remainingCallsToday).toBe(0);
  });
});

describe('POST /api/plan: failures', () => {
  const failed = async (res: { status: number; body: unknown }, status: number, error: string) => {
    expect(res.status).toBe(status);
    const parsed = ApiErrorSchema.parse(res.body);
    expect(parsed.error).toBe(error);
    expect(await h.plans()).toBe(0); // no partial plan exists in storage
    return parsed;
  };

  it('returns 502 coach_unavailable when the coach fails, with a retry message, and the call still counts @spec(plan-generation/distinct-failure-outcomes/coach-error) @spec(cost-cap/what-counts-toward-the-cap/failed-call-counts) @spec(plan-generation/distinct-failure-outcomes/no-partial-plan)', async () => {
    const { coach } = fakeCoach(() => {
      throw new Error('network down');
    });
    h = await appHarness({ coach, limit: 5 });
    const error = await failed(await h.post(body), 502, 'coach_unavailable');
    expect(error.message).toMatch(/try again/i);
    expect(error.remainingCallsToday).toBe(4);
    expect(await h.calls()).toBe(1);
  });

  it('returns 502 coach_unavailable when the coach does not answer within the coach timeout @spec(plan-generation/distinct-failure-outcomes/coach-timeout)', async () => {
    const { coach } = fakeCoach(() => new Promise(() => undefined)); // never answers
    h = await appHarness({ coach, coachTimeoutMs: 50 });
    const started = Date.now();
    await failed(await h.post(body), 502, 'coach_unavailable');
    expect(Date.now() - started).toBeLessThan(5000);
    expect(await h.calls()).toBe(1);
  });

  it('returns 422 invalid_coach_response when the response fails validation, and the call counts @spec(plan-generation/distinct-failure-outcomes/invalid-coach-response) @spec(cost-cap/what-counts-toward-the-cap/rejected-response-counts) @spec(plan-storage/save-only-valid-plans/invalid-plan-is-not-saved)', async () => {
    const sixDays = good();
    sixDays.plan.days = sixDays.plan.days.slice(0, 6);
    const { coach } = fakeCoach(() => sixDays);
    h = await appHarness({ coach, limit: 5 });
    const error = await failed(await h.post(body), 422, 'invalid_coach_response');
    expect(error.message).toMatch(/try again/i);
    expect(error.remainingCallsToday).toBe(4);
    expect(await h.calls()).toBe(1);
  });

  it.each([
    ['a response that does not match the shape', () => ({ plan: 'nonsense' })],
    ['a truncated response (cut-off JSON text)', () => '{"understoodRunning": [], "painReported": false, "plan": {"days": [{"day": "mon", "sessi'],
    ['a null response', () => null],
    ['a refusal reported by the coach client', () => { throw new CoachOutputError('the model refused'); }],
    ['running out of output space reported by the coach client', () => { throw new CoachOutputError('max_tokens reached'); }],
  ])('returns 422 invalid_coach_response for %s @spec(plan-generation/distinct-failure-outcomes/malformed-coach-output)', async (_name, answer) => {
    const { coach } = fakeCoach(answer);
    h = await appHarness({ coach });
    await failed(await h.post(body), 422, 'invalid_coach_response');
    expect(await h.calls()).toBe(1);
  });

  it('returns 422 plan_unreadable when a plan was pasted and the coach read no running sessions, naming the week', async () => {
    const { coach } = fakeCoach(() => responseWith({ tue: [session('crossfit')] }, { understoodRunning: [] }));
    h = await appHarness({ coach });
    const error = await failed(
      await h.post({ ...body, runningDays: [], existingRunningPlan: PASTE, pastedPlanWeek: 13 }),
      422,
      'plan_unreadable',
    );
    expect(error.message).toBe('No running sessions found for week 13 in your pasted plan.');
    expect(await h.calls()).toBe(1);
  });

  it('lets plan_unreadable win when the response is also invalid @spec(plan-generation/distinct-failure-outcomes/unreadable-and-invalid-at-once)', async () => {
    const broken = responseWith({ tue: [session('crossfit')] }, { understoodRunning: [] });
    broken.plan.days = broken.plan.days.slice(0, 6); // also breaks the seven-day rule
    const { coach } = fakeCoach(() => broken);
    h = await appHarness({ coach });
    await failed(await h.post({ ...body, runningDays: [], existingRunningPlan: PASTE }), 422, 'plan_unreadable');
  });

  it('returns 429 daily_limit_reached at the cap, without calling the coach, and counts nothing more @spec(cost-cap/daily-cap/cap-reached)', async () => {
    const { coach, seen } = fakeCoach(good);
    h = await appHarness({ coach, limit: 1 });
    expect((await h.post(body)).status).toBe(200);
    const res = await h.post(body);
    expect(res.status).toBe(429);
    const error = ApiErrorSchema.parse(res.body);
    expect(error.error).toBe('daily_limit_reached');
    expect(error.remainingCallsToday).toBe(0);
    expect(seen).toHaveLength(1); // the coach was called only for the first request
    expect(await h.plans()).toBe(1);
    expect(await h.calls()).toBe(1);
  });

  it('returns 500 server_error when the cap reservation throws: no coach call, nothing saved, no remainingCallsToday', async () => {
    const { coach, seen } = fakeCoach(good);
    h = await appHarness({
      coach,
      reserveCall: async () => {
        throw new Error('database unreachable');
      },
    });
    const error = await failed(await h.post(body), 500, 'server_error');
    expect(error.remainingCallsToday).toBeUndefined();
    expect(seen).toHaveLength(0);
  });

  it('returns 500 server_error when saving fails, saves nothing, and the reserved call still counts', async () => {
    const { coach } = fakeCoach(good);
    const brokenStore: PlanStore = {
      async save() {
        throw new Error('disk full');
      },
      async latest() {
        return null;
      },
    };
    h = await appHarness({ coach, limit: 5, store: brokenStore });
    const error = await failed(await h.post(body), 500, 'server_error');
    expect(error.remainingCallsToday).toBe(4);
    expect(await h.calls()).toBe(1);
  });

  it('does not leak the athlete\'s text or internals in error messages', async () => {
    const { coach } = fakeCoach(() => {
      throw new Error('secret injuries text: my left knee hurts');
    });
    h = await appHarness({ coach });
    const res = await h.post({ ...body, injuries: 'my left knee hurts' });
    expect(JSON.stringify(res.body)).not.toMatch(/knee|secret|network/i);
  });
});
