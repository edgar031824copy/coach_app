import { DaySchema, LevelSchema, OnboardingSchema, type Onboarding } from 'shared';

export type ValidationResult = { ok: true; value: Onboarding } | { ok: false; fields: Record<string, string> };

// Limits are proposals 🔶 (specs/onboarding). The pasted-plan limit was checked against the author's real
// 12-week plan on 2026-11-08: 1,643 characters, so 4,000 leaves about 2.4x headroom.
export const LIMITS = {
  goal: 500,
  injuries: 2000,
  pastedPlan: 4000,
  eventName: 200,
  weekMin: 1,
  weekMax: 52,
  sessionsMax: 14,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isWholeNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

// Pure function, no I/O (design.md Decision 4). Reports every bad field at once.
// `now` is injectable so the event-date rule can be tested with a fixed clock.
export function validateOnboarding(body: unknown, now: () => Date = () => new Date()): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, fields: { body: 'The request body must be a JSON object.' } };
  }
  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  // Required answers and field rules
  if (typeof input.goal !== 'string' || input.goal.trim() === '') fields.goal = 'Goal is required.';
  else if (input.goal.length > LIMITS.goal) fields.goal = `Goal must be at most ${LIMITS.goal} characters.`;

  for (const name of ['runningLevel', 'crossfitLevel'] as const) {
    if (!LevelSchema.safeParse(input[name]).success) {
      fields[name] = `${name} must be beginner, intermediate, or advanced.`;
    }
  }

  if (typeof input.injuries !== 'string') fields.injuries = 'Injuries must be text (it may be empty).';
  else if (input.injuries.length > LIMITS.injuries) {
    fields.injuries = `Injuries must be at most ${LIMITS.injuries} characters.`;
  }

  for (const name of ['runningDays', 'crossfitDays'] as const) {
    const days = input[name];
    if (!Array.isArray(days) || !days.every((d) => DaySchema.safeParse(d).success)) {
      fields[name] = `${name} must be a list of days from mon to sun.`;
    } else if (new Set(days).size !== days.length) {
      fields[name] = `${name} lists a day more than once.`;
    }
  }

  // Pasted plan: trimmed, empty or whitespace counts as absent.
  let existingRunningPlan: string | null = null;
  const rawPlan = input.existingRunningPlan;
  if (rawPlan !== undefined && rawPlan !== null) {
    if (typeof rawPlan !== 'string') fields.existingRunningPlan = 'The pasted plan must be text.';
    else {
      const trimmed = rawPlan.trim();
      if (trimmed.length > LIMITS.pastedPlan) {
        fields.existingRunningPlan = `The pasted plan must be at most ${LIMITS.pastedPlan} characters.`;
      } else if (trimmed !== '') existingRunningPlan = trimmed;
    }
  }
  const hasPastedPlan = existingRunningPlan !== null;

  if (!fields.runningDays && !fields.crossfitDays && !fields.existingRunningPlan && !hasPastedPlan &&
      (input.runningDays as unknown[]).length === 0 && (input.crossfitDays as unknown[]).length === 0) {
    const message = 'Pick at least one training day, or paste a running plan.';
    fields.runningDays = message;
    fields.crossfitDays = message;
  }

  // Plan week: only meaningful with a pasted plan; defaults to 1; ignored (saved as null) without one.
  let pastedPlanWeek: number | null = null;
  if (hasPastedPlan) {
    const week = input.pastedPlanWeek ?? 1;
    if (!isWholeNumber(week) || week < LIMITS.weekMin || week > LIMITS.weekMax) {
      fields.pastedPlanWeek = `The plan week must be a whole number from ${LIMITS.weekMin} to ${LIMITS.weekMax}.`;
    } else pastedPlanWeek = week;
  }

  // weeklyTraining (optional)
  let weeklyTraining: Onboarding['weeklyTraining'] = null;
  const wt = input.weeklyTraining;
  if (wt !== undefined && wt !== null) {
    const t = wt as Record<string, unknown>;
    const km = t?.runningKm ?? null;
    if (typeof wt !== 'object' || Array.isArray(wt) || !isWholeNumber(t.runningSessions) || !isWholeNumber(t.crossfitSessions)) {
      fields.weeklyTraining = 'Weekly training sessions must be whole numbers.';
    } else if (
      t.runningSessions < 0 || t.runningSessions > LIMITS.sessionsMax ||
      t.crossfitSessions < 0 || t.crossfitSessions > LIMITS.sessionsMax ||
      (km !== null && (typeof km !== 'number' || !Number.isFinite(km) || km < 0))
    ) {
      fields.weeklyTraining = `Sessions per week must be from 0 to ${LIMITS.sessionsMax}, and km cannot be negative.`;
    } else {
      weeklyTraining = { runningSessions: t.runningSessions, crossfitSessions: t.crossfitSessions, runningKm: km };
    }
  }

  // targetEvent (optional): valid UTC date, today or later; name length limited.
  let targetEvent: Onboarding['targetEvent'] = null;
  const ev = input.targetEvent;
  if (ev !== undefined && ev !== null) {
    const e = ev as Record<string, unknown>;
    const today = now().toISOString().slice(0, 10);
    if (typeof ev !== 'object' || Array.isArray(ev) || typeof e.name !== 'string' || typeof e.date !== 'string') {
      fields.targetEvent = 'The event needs a name and a date.';
    } else if (e.name.length > LIMITS.eventName) {
      fields.targetEvent = `The event name must be at most ${LIMITS.eventName} characters.`;
    } else if (!isRealIsoDate(e.date)) {
      fields.targetEvent = 'The event date must be a real date (yyyy-mm-dd).';
    } else if (e.date < today) {
      fields.targetEvent = 'The event date cannot be in the past (UTC).';
    } else targetEvent = { name: e.name, date: e.date };
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  const parsed = OnboardingSchema.safeParse({
    goal: input.goal,
    runningLevel: input.runningLevel,
    crossfitLevel: input.crossfitLevel,
    injuries: input.injuries,
    runningDays: input.runningDays,
    crossfitDays: input.crossfitDays,
    existingRunningPlan,
    pastedPlanWeek,
    weeklyTraining,
    targetEvent,
  });
  if (!parsed.success) return { ok: false, fields: { body: 'The onboarding is not valid.' } };
  return { ok: true, value: parsed.data };
}
