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

// Every day with both a running and a CrossFit session needs a non-empty note, whatever the source of each.
export function validateCombinedLoadNote(_onboarding: Onboarding, response: CoachResponse): Violation[] {
  const violations: Violation[] = [];
  for (const { day, sessions, combinedLoadNote } of response.plan.days) {
    const both = sessions.some((s) => s.discipline === 'running') && sessions.some((s) => s.discipline === 'crossfit');
    if (both && (combinedLoadNote === null || combinedLoadNote.trim() === '')) {
      violations.push({ rule: 'combined-load-note', message: `${day} has both a running and a CrossFit session but no combined-load note.` });
    }
  }
  return violations;
}

// The most sessions a discipline may have in a week, from the stated weekly count: the larger of 1.3 times the
// count (rounded down) and the count plus 2 (🔶 specs/plan-generation). Integer math, so no float surprises.
export function weeklySessionLimit(stated: number): number {
  return Math.max(Math.floor((13 * stated) / 10), stated + 2);
}

// Only when the athlete stated their weekly training and no running plan was pasted (a pasted plan is the athlete's
// own, and is never limited). Each discipline is checked on its own. Running km is input to the coach, not validated.
export function validateVolumeGuard(onboarding: Onboarding, response: CoachResponse): Violation[] {
  if (onboarding.weeklyTraining === null || onboarding.existingRunningPlan !== null) return [];
  const violations: Violation[] = [];
  const stated = {
    running: onboarding.weeklyTraining.runningSessions,
    crossfit: onboarding.weeklyTraining.crossfitSessions,
  };
  for (const discipline of ['running', 'crossfit'] as const) {
    const planned = response.plan.days.reduce((n, d) => n + d.sessions.filter((s) => s.discipline === discipline).length, 0);
    const limit = weeklySessionLimit(stated[discipline]);
    if (planned > limit) {
      violations.push({ rule: 'volume-guard', message: `The plan has ${planned} ${discipline} sessions; at most ${limit} are allowed for a stated ${stated[discipline]} a week.` });
    }
  }
  return violations;
}

// All rules, in one pass. Pure: no I/O. Later tasks add the import and safety rules.
export function validateCoachResponse(onboarding: Onboarding, response: CoachResponse): Violation[] {
  return [
    ...validateStructure(onboarding, response),
    ...validateDeclaredDays(onboarding, response),
    ...validateCombinedLoadNote(onboarding, response),
    ...validateVolumeGuard(onboarding, response),
  ];
}
