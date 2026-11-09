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
