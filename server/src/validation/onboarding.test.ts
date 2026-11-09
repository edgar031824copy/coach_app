import { describe, it, expect } from 'vitest';
import { validateOnboarding } from './onboarding.js';

const valid = {
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
};

const withChange = (change: Record<string, unknown>) => ({ ...valid, ...change });

describe('validateOnboarding: required answers', () => {
  it('accepts a valid onboarding @spec(onboarding/required-answers/valid-onboarding-is-accepted)', () => {
    const result = validateOnboarding(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.goal).toBe('Run a half marathon');
      expect(result.value.existingRunningPlan).toBeNull();
    }
  });

  it('rejects an empty goal with an error on the goal @spec(onboarding/required-answers/empty-goal-is-rejected)', () => {
    for (const goal of ['', '   ']) {
      const result = validateOnboarding(withChange({ goal }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.fields)).toEqual(['goal']);
    }
  });

  it('rejects no days and no pasted plan with errors on the days fields @spec(onboarding/required-answers/no-days-and-no-pasted-plan-is-rejected)', () => {
    const result = validateOnboarding(withChange({ runningDays: [], crossfitDays: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fields).sort()).toEqual(['crossfitDays', 'runningDays']);
  });

  it('accepts empty running days when a plan is pasted @spec(onboarding/required-answers/pasted-plan-makes-running-days-optional)', () => {
    const result = validateOnboarding(withChange({ runningDays: [], existingRunningPlan: 'Week 1: Mon 5 km easy' }));
    expect(result.ok).toBe(true);
  });

  it('accepts empty CrossFit days when a plan is pasted @spec(onboarding/required-answers/pasted-plan-without-crossfit-days-is-accepted)', () => {
    // The "no coach-added CrossFit sessions" half of this scenario is checked on the coach response in group 4.
    const result = validateOnboarding(withChange({ crossfitDays: [], existingRunningPlan: 'Week 1: Mon 5 km easy' }));
    expect(result.ok).toBe(true);
  });
});

describe('validateOnboarding: field validation', () => {
  it.each(['runningLevel', 'crossfitLevel'])(
    'rejects an invalid %s with an error on that field @spec(onboarding/field-validation/invalid-level-is-rejected)',
    (field) => {
      const result = validateOnboarding(withChange({ [field]: 'expert' }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.fields)).toEqual([field]);
    },
  );

  it.each(['runningDays', 'crossfitDays'])(
    'rejects an invalid day in %s with an error on that field @spec(onboarding/field-validation/invalid-day-is-rejected)',
    (field) => {
      const result = validateOnboarding(withChange({ [field]: ['mon', 'funday'] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.fields)).toEqual([field]);
    },
  );

  it.each(['runningDays', 'crossfitDays'])(
    'rejects a day listed twice in %s with an error on that field @spec(onboarding/field-validation/duplicate-day-is-rejected)',
    (field) => {
      const result = validateOnboarding(withChange({ [field]: ['mon', 'mon'] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.fields)).toEqual([field]);
    },
  );

  it('accepts empty injuries @spec(onboarding/field-validation/empty-injuries-is-accepted)', () => {
    expect(validateOnboarding(withChange({ injuries: '' })).ok).toBe(true);
  });

  it('allows the same day in running and CrossFit lists (they are separate lists)', () => {
    expect(validateOnboarding(withChange({ runningDays: ['mon'], crossfitDays: ['mon'] })).ok).toBe(true);
  });

  it('reports every bad field at once', () => {
    const result = validateOnboarding(withChange({ goal: '', runningLevel: 'x', crossfitDays: ['mon', 'mon'] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fields).sort()).toEqual(['crossfitDays', 'goal', 'runningLevel']);
  });

  it.each([null, 'text', 42, [], undefined])('rejects a body that is not an object (%j) without throwing', (body) => {
    const result = validateOnboarding(body);
    expect(result.ok).toBe(false);
  });
});

// ---- Task 2.2: pasted plan, optional fields, length limits ----

const NOW = () => new Date('2026-11-08T12:00:00Z');
const PLAN = 'Week 1: Mon 5 km easy';
const check = (change: Record<string, unknown>) => validateOnboarding(withChange(change), NOW);
const failedFields = (change: Record<string, unknown>) => {
  const result = check(change);
  expect(result.ok).toBe(false);
  return result.ok ? [] : Object.keys(result.fields);
};

describe('validateOnboarding: pasted running plan input', () => {
  it('rejects a paste over 4,000 characters, accepts exactly 4,000 @spec(onboarding/pasted-running-plan-input/over-length-paste-is-rejected)', () => {
    expect(failedFields({ existingRunningPlan: 'a'.repeat(4001) })).toEqual(['existingRunningPlan']);
    expect(check({ existingRunningPlan: 'a'.repeat(4000) }).ok).toBe(true);
  });

  it('treats a whitespace-only paste as absent, so the days error applies @spec(onboarding/pasted-running-plan-input/whitespace-only-paste-counts-as-absent)', () => {
    const fields = failedFields({ existingRunningPlan: '  \n\t ', runningDays: [], crossfitDays: [] });
    expect(fields.sort()).toEqual(['crossfitDays', 'runningDays']);
  });

  it('saves a trimmed paste, and an empty or whitespace paste as null', () => {
    const padded = check({ existingRunningPlan: `  ${PLAN}\n` });
    expect(padded.ok && padded.value.existingRunningPlan).toBe(PLAN);
    const blank = check({ existingRunningPlan: '   ' });
    expect(blank.ok && blank.value.existingRunningPlan).toBeNull();
  });

  it.each([undefined, null])('uses week 1 when a plan is pasted and the week is %s @spec(onboarding/pasted-running-plan-input/plan-week-defaults-to-1)', (week) => {
    const result = check({ existingRunningPlan: PLAN, pastedPlanWeek: week });
    expect(result.ok && result.value.pastedPlanWeek).toBe(1);
  });

  it.each([0, 53, 1.5, -1, '3', NaN])('rejects plan week %j when a plan is pasted @spec(onboarding/pasted-running-plan-input/plan-week-out-of-range-is-rejected)', (week) => {
    expect(failedFields({ existingRunningPlan: PLAN, pastedPlanWeek: week })).toEqual(['pastedPlanWeek']);
  });

  it.each([1, 52])('accepts plan week %i', (week) => {
    expect(check({ existingRunningPlan: PLAN, pastedPlanWeek: week }).ok).toBe(true);
  });

  it('ignores a plan week when no plan is pasted, and saves null @spec(onboarding/pasted-running-plan-input/plan-week-without-a-paste-is-ignored)', () => {
    for (const week of [5, 99]) {
      const result = check({ pastedPlanWeek: week });
      expect(result.ok && result.value.pastedPlanWeek).toBeNull();
    }
  });
});

describe('validateOnboarding: optional context fields', () => {
  const training = { runningSessions: 3, crossfitSessions: 2, runningKm: 25 };

  it('accepts absent optional fields and saves them as null @spec(onboarding/optional-context-fields/optional-fields-absent)', () => {
    const result = check({});
    expect(result.ok && [result.value.weeklyTraining, result.value.targetEvent]).toEqual([null, null]);
  });

  it('accepts valid weekly training, including 0 and 14 sessions and no km', () => {
    expect(check({ weeklyTraining: training }).ok).toBe(true);
    expect(check({ weeklyTraining: { runningSessions: 0, crossfitSessions: 14, runningKm: null } }).ok).toBe(true);
  });

  it.each([
    { ...training, runningSessions: 15 },
    { ...training, crossfitSessions: -1 },
    { ...training, runningKm: -5 },
  ])('rejects out-of-range weekly training %j @spec(onboarding/optional-context-fields/weekly-training-out-of-range)', (weeklyTraining) => {
    expect(failedFields({ weeklyTraining })).toEqual(['weeklyTraining']);
  });

  it.each([
    { ...training, runningSessions: '3' },
    { ...training, runningKm: '25' },
    'abc',
    [],
  ])('rejects weekly training of the wrong type %j', (weeklyTraining) => {
    expect(failedFields({ weeklyTraining })).toEqual(['weeklyTraining']);
  });

  it.each([{ ...training, runningSessions: 2.5 }, { ...training, crossfitSessions: 1.1 }])(
    'rejects a session count that is not a whole number %j @spec(onboarding/optional-context-fields/weekly-training-is-not-a-whole-number)',
    (weeklyTraining) => {
      expect(failedFields({ weeklyTraining })).toEqual(['weeklyTraining']);
    },
  );

  it.each(['2026-02-30', '2026-13-01', 'tomorrow', '08/11/2026', ''])(
    'rejects the invalid event date "%s" @spec(onboarding/optional-context-fields/invalid-event-date)',
    (date) => {
      expect(failedFields({ targetEvent: { name: 'Half', date } })).toEqual(['targetEvent']);
    },
  );

  it('rejects an event date before today in UTC @spec(onboarding/optional-context-fields/past-event-date)', () => {
    expect(failedFields({ targetEvent: { name: 'Half', date: '2026-11-07' } })).toEqual(['targetEvent']);
  });

  it('allows an event date of today in UTC, even late in the day @spec(onboarding/optional-context-fields/event-date-today-is-allowed)', () => {
    expect(check({ targetEvent: { name: 'Half', date: '2026-11-08' } }).ok).toBe(true);
    const lateEvening = () => new Date('2026-11-08T23:59:59Z');
    expect(validateOnboarding(withChange({ targetEvent: { name: 'Half', date: '2026-11-08' } }), lateEvening).ok).toBe(true);
  });
});

describe('validateOnboarding: free-text length limits', () => {
  it('rejects a goal over 500 characters, accepts exactly 500 @spec(onboarding/free-text-length-limits/goal-too-long)', () => {
    expect(failedFields({ goal: 'g'.repeat(501) })).toEqual(['goal']);
    expect(check({ goal: 'g'.repeat(500) }).ok).toBe(true);
  });

  it('rejects injuries over 2,000 characters, accepts exactly 2,000 @spec(onboarding/free-text-length-limits/injuries-too-long)', () => {
    expect(failedFields({ injuries: 'i'.repeat(2001) })).toEqual(['injuries']);
    expect(check({ injuries: 'i'.repeat(2000) }).ok).toBe(true);
  });

  it('rejects an event name over 200 characters, accepts exactly 200 @spec(onboarding/free-text-length-limits/event-name-too-long)', () => {
    expect(failedFields({ targetEvent: { name: 'n'.repeat(201), date: '2026-12-01' } })).toEqual(['targetEvent']);
    expect(check({ targetEvent: { name: 'n'.repeat(200), date: '2026-12-01' } }).ok).toBe(true);
  });
});
