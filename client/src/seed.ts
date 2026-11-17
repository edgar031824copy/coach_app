import type { Onboarding } from 'shared';

// The form values for "Plan next week" (design.md Decision 7): the saved onboarding with the plan week plus 1.
// A null week stays null (no plan was pasted). Week 53 is not clamped: the form shows the shared validator's own
// field error and the athlete edits it. Returns a new object; the saved one is never changed.
export function nextWeekSeed(saved: Onboarding): Onboarding {
  return { ...saved, pastedPlanWeek: saved.pastedPlanWeek === null ? null : saved.pastedPlanWeek + 1 };
}
