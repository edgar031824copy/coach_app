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

// Pasted-plan rules (specs/running-plan-import). The server never parses the paste: the coach reports what it read
// (`understoodRunning`) and these rules check the plan against that report, so pasted sessions stay exactly as written.
// A misread paste cannot be detected here (known limit, design.md Decision 6).
export function validateImportRules(onboarding: Onboarding, response: CoachResponse): Violation[] {
  const understood = response.understoodRunning;
  const placed = response.plan.days.flatMap((d) => d.sessions.map((s) => ({ ...s, day: d.day })));
  const athlete = placed.filter((s) => s.source === 'athlete');

  if (onboarding.existingRunningPlan === null) {
    // No paste: nothing was read, and nothing in the plan may claim to come from the athlete.
    if (understood.length === 0 && athlete.length === 0) return [];
    return [{ rule: 'import-without-paste', message: 'No running plan was pasted, so there must be no understood running sessions and no athlete sessions.' }];
  }

  const violations: Violation[] = [];
  if (understood.length === 0) {
    const week = onboarding.pastedPlanWeek ?? 1;
    violations.push({ rule: 'plan-unreadable', message: `No running sessions found for week ${week} in your pasted plan.` });
  }

  // With a pasted plan the coach adds only CrossFit sessions (their days are checked by the declared-days rule).
  if (placed.some((s) => s.source === 'coach' && s.discipline === 'running')) {
    violations.push({ rule: 'coach-running-with-paste', message: 'The coach added a running session to a pasted plan; it may add only CrossFit sessions.' });
  }

  // Every athlete session must be one the coach said it read, on a day that row allows, matched one to one.
  const matched = maxMatching(
    athlete.length,
    understood.length,
    (a, e) => {
      const s = athlete[a]!;
      const u = understood[e]!;
      return s.discipline === 'running' && s.description === u.description && u.dayOptions.includes(s.day);
    },
  );
  if (athlete.length !== understood.length || matched !== athlete.length) {
    const why =
      athlete.length > understood.length
        ? 'The plan has more athlete sessions than the coach reported reading.'
        : athlete.length < understood.length
          ? 'A session from the pasted plan is missing from the plan.'
          : 'A pasted running session was changed or placed on a day its row does not allow.';
    violations.push({ rule: 'pasted-sessions', message: why });
  }
  return violations;
}

// `plan_unreadable` wins over `invalid_coach_response` when both apply (design.md Decision 4).
export function isPlanUnreadable(violations: Violation[]): boolean {
  return violations.some((v) => v.rule === 'plan-unreadable');
}

// Size of a largest one-to-one pairing between `left` sessions and `right` entries (augmenting paths). A greedy
// first-come match can fail when an entry is more restricted than another with the same description.
function maxMatching(left: number, right: number, compatible: (l: number, r: number) => boolean): number {
  const owner: number[] = Array(right).fill(-1);
  const tryAssign = (l: number, seen: boolean[]): boolean => {
    for (let r = 0; r < right; r++) {
      if (!compatible(l, r) || seen[r]) continue;
      seen[r] = true;
      if (owner[r] === -1 || tryAssign(owner[r]!, seen)) {
        owner[r] = l;
        return true;
      }
    }
    return false;
  };
  let count = 0;
  for (let l = 0; l < left; l++) if (tryAssign(l, Array(right).fill(false))) count++;
  return count;
}

// Safety note (PRD Principle 6): pain reported needs a note that says something; no pain means no note at all.
// Whether the note's wording is right (not a clinician, no diagnosis, see a professional) is model judgment,
// checked by the local evals, not here.
export function validateSafety(_onboarding: Onboarding, response: CoachResponse): Violation[] {
  const note = response.plan.safetyNote;
  if (response.painReported) {
    return note === null || note.trim() === ''
      ? [{ rule: 'safety-note-missing', message: 'Pain was reported, so the plan needs a safety note.' }]
      : [];
  }
  return note === null ? [] : [{ rule: 'safety-note-without-pain', message: 'No pain was reported, so the safety note must be null.' }];
}

// All rules, in one pass. Pure: no I/O.
export function validateCoachResponse(onboarding: Onboarding, response: CoachResponse): Violation[] {
  return [
    ...validateStructure(onboarding, response),
    ...validateDeclaredDays(onboarding, response),
    ...validateCombinedLoadNote(onboarding, response),
    ...validateVolumeGuard(onboarding, response),
    ...validateImportRules(onboarding, response),
    ...validateSafety(onboarding, response),
  ];
}
