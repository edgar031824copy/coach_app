import { describe, it, expect } from 'vitest';
import type { ZodType } from 'zod';
import {
  DaySchema, LevelSchema, OnboardingSchema, SessionSchema, PlanDaySchema, PlanSchema,
  CoachResponseSchema, PlanRecordSchema, PlanResponseSchema, ApiErrorSchema,
} from './index.js';

const session = { discipline: 'running', description: 'Easy 5 km', intensity: 'easy', source: 'athlete' };
const planDay = { day: 'mon', sessions: [session], combinedLoadNote: null };
const plan = { days: [planDay], recommendations: ['Sleep'], safetyNote: null };
const onboarding = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'], existingRunningPlan: null, pastedPlanWeek: null,
  weeklyTraining: null, targetEvent: null,
};
const record = { id: 1, plan, onboarding, createdAt: '2026-11-08T10:00:00.000Z' };

// One accepted and one rejected sample per schema.
const cases: [string, ZodType, unknown, unknown][] = [
  ['Day', DaySchema, 'mon', 'monday'],
  ['Level', LevelSchema, 'advanced', 'expert'],
  ['Onboarding', OnboardingSchema, onboarding, { ...onboarding, runningDays: ['funday'] }],
  ['Session', SessionSchema, session, { ...session, source: 'robot' }],
  ['PlanDay', PlanDaySchema, planDay, { ...planDay, sessions: 'none' }],
  ['Plan', PlanSchema, plan, { ...plan, recommendations: 'Sleep' }],
  ['CoachResponse', CoachResponseSchema,
    { understoodRunning: [{ dayOptions: ['mon'], description: 'Easy 5 km' }], painReported: false, plan },
    { understoodRunning: [], plan }],
  ['PlanRecord', PlanRecordSchema, record, { ...record, id: 'one' }],
  ['PlanResponse', PlanResponseSchema, { ...record, remainingCallsToday: 19 }, record],
  ['ApiError', ApiErrorSchema,
    { error: 'validation_error', message: 'Bad', fields: { goal: 'required' }, remainingCallsToday: 3 },
    { error: 'teapot', message: 'Bad' }],
];

describe('shared schemas', () => {
  it.each(cases)('%s accepts a valid sample', (_name, schema, good) => {
    expect(schema.safeParse(good).success).toBe(true);
  });
  it.each(cases)('%s rejects an invalid sample', (_name, schema, _good, bad) => {
    expect(schema.safeParse(bad).success).toBe(false);
  });

  it('Onboarding treats absent optional fields as null', () => {
    const minimal = {
      goal: onboarding.goal, runningLevel: onboarding.runningLevel, crossfitLevel: onboarding.crossfitLevel,
      injuries: '', runningDays: ['mon'], crossfitDays: [],
    };
    const parsed = OnboardingSchema.parse(minimal);
    expect(parsed.existingRunningPlan).toBeNull();
    expect(parsed.pastedPlanWeek).toBeNull();
    expect(parsed.weeklyTraining).toBeNull();
    expect(parsed.targetEvent).toBeNull();
  });
});
