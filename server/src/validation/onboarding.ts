import { DaySchema, LevelSchema, OnboardingSchema, type Onboarding } from 'shared';

export type ValidationResult = { ok: true; value: Onboarding } | { ok: false; fields: Record<string, string> };

// Pure function, no I/O (design.md Decision 4). Reports every bad field at once.
// Task 2.1: required answers and field rules. Paste and optional-field limits arrive in task 2.2.
export function validateOnboarding(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, fields: { body: 'The request body must be a JSON object.' } };
  }
  const input = body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  if (typeof input.goal !== 'string' || input.goal.trim() === '') fields.goal = 'Goal is required.';

  for (const name of ['runningLevel', 'crossfitLevel'] as const) {
    if (!LevelSchema.safeParse(input[name]).success) {
      fields[name] = `${name} must be beginner, intermediate, or advanced.`;
    }
  }

  if (typeof input.injuries !== 'string') fields.injuries = 'Injuries must be text (it may be empty).';

  for (const name of ['runningDays', 'crossfitDays'] as const) {
    const days = input[name];
    if (!Array.isArray(days) || !days.every((d) => DaySchema.safeParse(d).success)) {
      fields[name] = `${name} must be a list of days from mon to sun.`;
    } else if (new Set(days).size !== days.length) {
      fields[name] = `${name} lists a day more than once.`;
    }
  }

  const hasPastedPlan = typeof input.existingRunningPlan === 'string' && input.existingRunningPlan.trim() !== '';
  const noDays = !fields.runningDays && !fields.crossfitDays &&
    (input.runningDays as unknown[]).length === 0 && (input.crossfitDays as unknown[]).length === 0;
  if (noDays && !hasPastedPlan) {
    const message = 'Pick at least one training day, or paste a running plan.';
    fields.runningDays = message;
    fields.crossfitDays = message;
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  // Remaining fields (paste, week, weeklyTraining, targetEvent): structural check only until task 2.2.
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'body')] = 'This value is not valid.';
    return { ok: false, fields };
  }
  return { ok: true, value: parsed.data };
}
