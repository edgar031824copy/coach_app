import type { CoachResponse, Day, Onboarding } from 'shared';

// One broken rule. `rule` is a stable id (tests and later mapping to errors use it); `message` is for logs and the
// retry text, and never quotes the athlete's text (design.md section 9: no injuries, paste, or plan in logs).
export type Violation = { rule: string; message: string };

const ALL_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// Structure: exactly seven distinct days, and at least one rest day (design.md Decision 4).
// The rest-day exception: every day of the final plan carries a pasted (athlete) session, whatever `dayOptions`
// allowed. A coach that fills the days the athlete's own sessions left empty gets no exception.
export function validateStructure(onboarding: Onboarding, response: CoachResponse): Violation[] {
  const days = response.plan.days;
  const seen = new Set(days.map((d) => d.day));
  const hasSevenDistinct = days.length === 7 && seen.size === 7 && ALL_DAYS.every((d) => seen.has(d));
  if (!hasSevenDistinct) {
    return [{ rule: 'seven-days', message: `The plan must have exactly one entry for each of mon to sun (got ${days.length} entries, ${seen.size} distinct days).` }];
  }

  const hasRestDay = days.some((d) => d.sessions.length === 0);
  const pastedSessionsFillTheWeek = days.every((d) => d.sessions.some((s) => s.source === 'athlete'));
  if (!hasRestDay && !pastedSessionsFillTheWeek) {
    const why = onboarding.existingRunningPlan === null ? 'no running plan was pasted' : 'the pasted sessions leave a day free';
    return [{ rule: 'rest-day', message: `The plan needs at least one rest day (every day has a session and ${why}).` }];
  }
  return [];
}

// A coach session goes only on a day the athlete declared for that discipline.
// Athlete (pasted) sessions are exempt: they follow the pasted plan.
export function validateDeclaredDays(onboarding: Onboarding, response: CoachResponse): Violation[] {
  const violations: Violation[] = [];
  for (const { day, sessions } of response.plan.days) {
    for (const discipline of ['running', 'crossfit'] as const) {
      const declared = discipline === 'running' ? onboarding.runningDays : onboarding.crossfitDays;
      const offending = sessions.some((s) => s.source === 'coach' && s.discipline === discipline);
      if (offending && !declared.includes(day)) {
        violations.push({ rule: 'declared-days', message: `A coach ${discipline} session is on ${day}, which the athlete did not declare for ${discipline}.` });
      }
    }
  }
  return violations;
}

// All rules, in one pass. Pure: no I/O. Later tasks add the combined-load note, volume guard, import and safety rules.
export function validateCoachResponse(onboarding: Onboarding, response: CoachResponse): Violation[] {
  return [...validateStructure(onboarding, response), ...validateDeclaredDays(onboarding, response)];
}
