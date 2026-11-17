import { describe, it, expect } from 'vitest';
import { nextWeekSeed } from './seed.js';
import { onboarding } from './test-helpers.js';

const pasted = { ...onboarding, existingRunningPlan: 'Week 3: Mon 5 km easy' };

describe('nextWeekSeed: the form values for "Plan next week"', () => {
  it('adds one to the saved week @spec(plan-storage/plan-next-week/form-is-pre-filled)', () => {
    expect(nextWeekSeed({ ...pasted, pastedPlanWeek: 3 }).pastedPlanWeek).toBe(4);
  });

  it('gives week 2 when the plan was saved with the default week 1 @spec(plan-storage/plan-next-week/pasted-plan-with-the-default-week)', () => {
    expect(nextWeekSeed({ ...pasted, pastedPlanWeek: 1 }).pastedPlanWeek).toBe(2);
  });

  it('keeps the week null when there is no pasted plan @spec(plan-storage/plan-next-week/no-pasted-plan)', () => {
    expect(nextWeekSeed({ ...onboarding, pastedPlanWeek: null }).pastedPlanWeek).toBeNull();
  });

  it('gives week 53 after week 52, which the form then rejects @spec(plan-storage/plan-next-week/week-past-the-maximum)', () => {
    expect(nextWeekSeed({ ...pasted, pastedPlanWeek: 52 }).pastedPlanWeek).toBe(53);
  });

  it('keeps everything else as saved and does not change the saved object', () => {
    const saved = { ...pasted, pastedPlanWeek: 3, goal: 'Finish a 10k', injuries: 'sore knee' };
    const copy = structuredClone(saved);
    const seed = nextWeekSeed(saved);
    expect({ ...seed, pastedPlanWeek: 3 }).toEqual(saved);
    expect(saved).toEqual(copy);
  });
});
