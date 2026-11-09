import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { ApiErrorSchema, type CoachResponse } from 'shared';
import { createApp } from './app.js';
import type { CoachClient } from './coach/types.js';

// A spy coach that must never be called, and an in-memory cap count that must not change.
let coachCalls: number;
let capCount: number;
const spyCoach: CoachClient = {
  async generate(): Promise<CoachResponse> {
    coachCalls++;
    throw new Error('the coach must not be called for an invalid request');
  },
};
const reserveCall = async () => ++capCount;

const valid = {
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
};

const post = (body: unknown) =>
  request(createApp({ coach: spyCoach, reserveCall })).post('/api/plan').send(body as object);

beforeEach(() => {
  coachCalls = 0;
  capCount = 0;
});

describe('POST /api/plan: validation (task 2.3)', () => {
  const invalidBodies: [string, unknown][] = [
    ['empty goal', { ...valid, goal: '' }],
    ['no days and no paste', { ...valid, runningDays: [], crossfitDays: [] }],
    ['invalid level', { ...valid, runningLevel: 'expert' }],
    ['duplicate day', { ...valid, runningDays: ['mon', 'mon'] }],
    ['paste over the limit', { ...valid, existingRunningPlan: 'a'.repeat(4001) }],
    ['plan week out of range', { ...valid, existingRunningPlan: 'Week 1: Mon 5 km', pastedPlanWeek: 60 }],
    ['past event date', { ...valid, targetEvent: { name: 'Half', date: '2000-01-01' } }],
    ['goal too long', { ...valid, goal: 'g'.repeat(501) }],
  ];

  it.each(invalidBodies)(
    'rejects %s with 400 validation_error and per-field messages @spec(onboarding/invalid-input-never-reaches-the-coach/rejected-onboarding-makes-no-coach-call)',
    async (_name, body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      const error = ApiErrorSchema.parse(res.body);
      expect(error.error).toBe('validation_error');
      expect(Object.keys(error.fields ?? {}).length).toBeGreaterThan(0);
      expect(error.remainingCallsToday).toBeUndefined(); // no call was used
      expect(coachCalls).toBe(0);
      expect(capCount).toBe(0);
    },
  );

  it('rejects an unparseable JSON body with 400 and no coach call @spec(onboarding/field-validation/malformed-body-is-rejected)', async () => {
    const res = await request(createApp({ coach: spyCoach, reserveCall }))
      .post('/api/plan')
      .set('Content-Type', 'application/json')
      .send('{"goal": "run", ');
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(res.body).error).toBe('validation_error');
    expect(coachCalls).toBe(0);
    expect(capCount).toBe(0);
  });

  it.each([['a JSON string', '"text"'], ['a JSON array', '[]'], ['an unknown shape', '{"foo":1}'], ['no body', '']])(
    'rejects %s with 400 and no coach call @spec(onboarding/field-validation/malformed-body-is-rejected)',
    async (_name, raw) => {
      const res = await request(createApp({ coach: spyCoach, reserveCall }))
        .post('/api/plan')
        .set('Content-Type', 'application/json')
        .send(raw);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(res.body).error).toBe('validation_error');
      expect(coachCalls).toBe(0);
      expect(capCount).toBe(0);
    },
  );

  it('rejects a body over 16 KB with 413 and no coach call @spec(onboarding/free-text-length-limits/request-body-too-large)', async () => {
    const res = await post({ ...valid, injuries: 'x'.repeat(17 * 1024) });
    expect(res.status).toBe(413);
    const error = ApiErrorSchema.parse(res.body);
    expect(error.error).toBe('validation_error');
    expect(error.remainingCallsToday).toBeUndefined();
    expect(coachCalls).toBe(0);
    expect(capCount).toBe(0);
  });

  it('answers an unsupported charset with a 415 ApiError, not Express HTML or a stack trace', async () => {
    const res = await request(createApp({ coach: spyCoach, reserveCall }))
      .post('/api/plan')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{}');
    expect(res.status).toBe(415);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(ApiErrorSchema.parse(res.body).error).toBe('validation_error');
    expect(res.text).not.toMatch(/at .*\.(js|ts)/); // no stack trace
    expect(coachCalls).toBe(0);
  });

  it('accepts a body just under 16 KB into validation (then the 2,000-character injuries limit applies)', async () => {
    const res = await post({ ...valid, injuries: 'x'.repeat(10 * 1024) });
    expect(res.status).toBe(400); // validation error on injuries, not a 413
    expect(Object.keys(ApiErrorSchema.parse(res.body).fields ?? {})).toEqual(['injuries']);
  });
});
