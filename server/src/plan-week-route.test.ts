import { describe, it, expect, afterEach } from 'vitest';
import { ApiErrorSchema, PlanRecordSchema, PlanResponseSchema, type Onboarding } from 'shared';
import type { CoachClient } from './coach/types.js';
import { appHarness } from '../test/app-harness.js';
import { responseWith, session } from '../test/fixtures.js';

// Task 1.3 (coach-plan-week-and-delete): POST /api/plan accepts an optional weekStart; GET and POST carry it.
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};
const good = () => responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] });
// A Thursday that is not the real today, so a route that read the real clock instead of the injected one would fail here.
const THURSDAY = () => new Date('2026-09-17T10:00:00Z'); // the current week starts on 2026-09-14

const fakeCoach = () => {
  const seen: Onboarding[] = [];
  const coach: CoachClient = { async generate(onboarding) { seen.push(onboarding); return good(); } };
  return { coach, seen };
};
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(() => h?.cleanup());
const weekInDb = async () => (await h.rows("select to_char(week_start, 'YYYY-MM-DD') as w from plans order by id")).map((r) => r.w);

describe('POST /api/plan: the week', () => {
  it('saves the week it was given and returns it on the answer and on a later GET @spec(plan-week/every-plan-has-a-week/week-is-saved-and-returned)', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    const res = await h.post({ ...body, weekStart: '2026-11-30' });
    expect(res.status).toBe(200);
    expect(PlanResponseSchema.parse(res.body).weekStart).toBe('2026-11-30');
    expect((await h.get()).body.weekStart).toBe('2026-11-30');
    expect(await weekInDb()).toEqual(['2026-11-30']);
  });

  it('returns the plan, its onboarding, its creation time and its week on GET @spec(plan-storage/reload-without-a-coach-call/record-carries-its-week)', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    await h.post({ ...body, weekStart: '2026-11-23' });
    const record = PlanRecordSchema.parse((await h.get()).body);
    expect(Object.keys(record).sort()).toEqual(['createdAt', 'id', 'onboarding', 'plan', 'weekStart']);
    expect(record.weekStart).toBe('2026-11-23');
  });

  it('uses the Monday of the current week when no weekStart is sent, as an old client does @spec(plan-week/every-plan-has-a-week/week-defaults-to-the-current-week)', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    const res = await h.post(body);
    expect(res.status).toBe(200);
    expect(res.body.weekStart).toBe('2026-09-14');
    expect(await weekInDb()).toEqual(['2026-09-14']);
  });

  it('puts a request made late on a Sunday (UTC) in the week that started the Monday before @spec(plan-week/every-plan-has-a-week/a-sunday-belongs-to-the-week-before)', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: () => new Date('2026-11-29T23:30:00Z') });
    expect((await h.post(body)).body.weekStart).toBe('2026-11-23');
  });

  it('refuses a day that is not a Monday: 400 on weekStart, nothing saved, no coach call, no count @spec(plan-week/every-plan-has-a-week/only-a-monday-is-accepted)', async () => {
    const { coach, seen } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    const res = await h.post({ ...body, weekStart: '2026-11-24' }); // a Tuesday
    expect(res.status).toBe(400);
    const error = ApiErrorSchema.parse(res.body);
    expect(error.error).toBe('validation_error');
    expect(Object.keys(error.fields ?? {})).toEqual(['weekStart']);
    expect(error.fields?.weekStart).toBe('The week must start on a Monday, within half a year of today.');
    expect(seen).toHaveLength(0);
    expect(await h.plans()).toBe(0);
    expect(await h.calls()).toBe(0);
  });

  it.each([['words', 'next monday'], ['an impossible date', '2026-13-40'], ['a timestamp', '2026-11-23T00:00:00Z'], ['an empty string', ''], ['null', null], ['a number', 20261123], ['an array', ['2026-11-23']]])(
    'refuses %s the same way @spec(plan-week/every-plan-has-a-week/a-value-that-is-not-a-date-is-refused)',
    async (_name, value) => {
      const { coach, seen } = fakeCoach();
      h = await appHarness({ coach, now: THURSDAY });
      const res = await h.post({ ...body, weekStart: value });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.fields)).toEqual(['weekStart']);
      expect(seen).toHaveLength(0);
      expect(await h.plans()).toBe(0);
      expect(await h.calls()).toBe(0);
    },
  );

  it('accepts a Monday exactly 26 weeks before or after the current week and refuses 27 @spec(plan-week/every-plan-has-a-week/a-week-far-from-today-is-refused)', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY, limit: 50 });
    for (const week of ['2027-03-15', '2026-03-16']) expect((await h.post({ ...body, weekStart: week })).status, week).toBe(200);
    for (const week of ['2027-03-22', '2026-03-09']) {
      const res = await h.post({ ...body, weekStart: week });
      expect(res.status, week).toBe(400);
      expect(Object.keys(res.body.fields)).toEqual(['weekStart']);
    }
    expect(await h.plans()).toBe(2);
    expect(await h.calls()).toBe(2); // the refusals spent nothing
  });

  it('reports a bad week together with the onboarding\'s own problems', async () => {
    const { coach } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    const res = await h.post({ ...body, goal: '', weekStart: '2026-11-24' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['goal', 'weekStart']);
  });

  it('does not put the week into the saved onboarding or send it to the coach', async () => {
    const { coach, seen } = fakeCoach();
    h = await appHarness({ coach, now: THURSDAY });
    await h.post({ ...body, weekStart: '2026-11-30' });
    expect(seen[0]).not.toHaveProperty('weekStart');
    expect((await h.get()).body.onboarding).not.toHaveProperty('weekStart');
  });
});
