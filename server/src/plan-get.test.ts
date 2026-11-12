import { describe, it, expect, afterEach } from 'vitest';
import { ApiErrorSchema, PlanRecordSchema } from 'shared';
import type { CoachClient } from './coach/types.js';
import type { PlanStore } from './db/plan-store.js';
import { appHarness } from '../test/app-harness.js';
import { responseWith, session } from '../test/fixtures.js';

const body = {
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
};

let coachCalls = 0;
const coach: CoachClient = {
  async generate() {
    coachCalls++;
    return responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] });
  },
};

let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());

describe('GET /api/plan', () => {
  it('returns JSON null before any plan exists, without calling the coach or using the cap @spec(plan-storage/reload-without-a-coach-call/no-plan-yet)', async () => {
    coachCalls = 0;
    h = await appHarness({ coach });
    const res = await h.get();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).toBe('null');
    expect(coachCalls).toBe(0);
    expect(await h.calls()).toBe(0);
  });

  it('shows the same plan after a reload and makes no coach call @spec(plan-storage/reload-without-a-coach-call/reload-shows-the-same-plan)', async () => {
    coachCalls = 0;
    h = await appHarness({ coach });
    const created = await h.post(body);
    expect(coachCalls).toBe(1);
    const callsAfterPost = await h.calls();

    for (let i = 0; i < 3; i++) {
      const res = await h.get(); // "reload" the page
      expect(res.status).toBe(200);
      const record = PlanRecordSchema.parse(res.body);
      const postedRecord = { ...created.body };
      delete postedRecord.remainingCallsToday; // GET does not carry the cap
      expect(record).toEqual(postedRecord);
    }
    expect(coachCalls).toBe(1); // reloading never calls the coach
    expect(await h.calls()).toBe(callsAfterPost); // and never uses the cap
  });

  it('shows the new plan after a second submission and keeps the earlier one stored @spec(plan-storage/submitting-again-replaces-the-shown-plan/second-submission)', async () => {
    h = await appHarness({ coach });
    const first = await h.post(body);
    const second = await h.post({ ...body, goal: 'Run a 10k' });
    expect(second.body.id).not.toBe(first.body.id);
    const shown = await h.get();
    expect(shown.body.id).toBe(second.body.id);
    expect(shown.body.onboarding.goal).toBe('Run a 10k');
    expect(await h.plans()).toBe(2); // the earlier plan is still stored, just not shown
  });

  it('returns 500 server_error as an ApiError when the store fails', async () => {
    const brokenStore: PlanStore = {
      async save() {
        throw new Error('unused');
      },
      async latest() {
        throw new Error('database unreachable: secret detail');
      },
    };
    h = await appHarness({ coach, store: brokenStore });
    const res = await h.get();
    expect(res.status).toBe(500);
    expect(ApiErrorSchema.parse(res.body).error).toBe('server_error');
    expect(res.text).not.toMatch(/secret|unreachable/);
  });
});
