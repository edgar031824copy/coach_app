import { CoachResponseSchema, type ApiError, type Onboarding, type PlanResponse } from 'shared';
import { CoachOutputError, type CoachClient } from './coach/types.js';
import type { PlanStore } from './db/plan-store.js';
import { logError } from './log.js';
import { isPlanUnreadable, validateCoachResponse } from './validation/coach-response.js';

// Everything the generation flow needs from outside, so tests inject fakes (design.md Decisions 3 and 5).
export interface GenerateDeps {
  coach: CoachClient;
  // Atomic cap reservation (task 3.3): the day's call count after this call, or null when the cap is reached.
  reserveCall: () => Promise<number | null>;
  callLimit: number;
  store: PlanStore;
  now?: () => Date;
  coachTimeoutMs?: number; // 🔶 30 s: a coach that has not answered by then is "unavailable"
}

export type Outcome = { status: 200; body: PlanResponse } | { status: 429 | 502 | 422 | 500; body: ApiError };

export const DEFAULT_COACH_TIMEOUT_MS = 30_000;

const RETRY = 'You can try again.';

// Rejects when the coach has not answered in time, so the timeout holds for any coach implementation.
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('coach timeout')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// validate (done by the caller) -> reserve a cap slot -> call the coach -> validate the response -> save -> respond.
// Failure mapping (specs/plan-generation, distinct failure outcomes): nothing is saved on any failure, and a slot
// reserved before a failure stays counted. Log lines carry error names only, never the athlete's text or a plan.
export async function generatePlan(deps: GenerateDeps, onboarding: Onboarding): Promise<Outcome> {
  const now = deps.now ?? (() => new Date());

  // 1. Reserve a slot before spending anything. A failing reservation spends nothing and counts nothing.
  let calls: number | null;
  try {
    calls = await deps.reserveCall();
  } catch (err) {
    logError('cap reservation failed', err);
    return { status: 500, body: { error: 'server_error', message: 'Something went wrong.' } };
  }
  if (calls === null) {
    return {
      status: 429,
      body: { error: 'daily_limit_reached', message: 'The daily limit of plans is reached. Try again tomorrow.', remainingCallsToday: 0 },
    };
  }
  const remainingCallsToday = Math.max(0, deps.callLimit - calls);
  const fail = (status: 502 | 422 | 500, error: ApiError['error'], message: string): Outcome => ({
    status,
    body: { error, message, remainingCallsToday },
  });

  // 2. Ask the coach. Any error or a missing answer is "unavailable"; a refusal or truncation reported by the client
  //    is an invalid response.
  let raw: unknown;
  try {
    raw = await withTimeout(
      Promise.resolve(deps.coach.generate(onboarding, { today: now().toISOString().slice(0, 10) })),
      deps.coachTimeoutMs ?? DEFAULT_COACH_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof CoachOutputError) {
      return fail(422, 'invalid_coach_response', `The coach's answer could not be used. ${RETRY}`);
    }
    logError('coach call failed', err);
    return fail(502, 'coach_unavailable', `The coach is not available right now. ${RETRY}`);
  }

  // 3. Check the answer: shape first, then every rule. An unreadable paste wins over other violations.
  const parsed = CoachResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, 'invalid_coach_response', `The coach's answer was not in the expected form. ${RETRY}`);
  }
  const violations = validateCoachResponse(onboarding, parsed.data);
  if (isPlanUnreadable(violations)) {
    const message = violations.find((v) => v.rule === 'plan-unreadable')?.message ?? 'No running sessions found in your pasted plan.';
    return fail(422, 'plan_unreadable', message);
  }
  if (violations.length > 0) {
    return fail(422, 'invalid_coach_response', `The coach's plan did not pass our checks. ${RETRY}`);
  }

  // 4. Save, then answer. A failed save leaves nothing behind, and the reserved slot still counts.
  try {
    const record = await deps.store.save(parsed.data.plan, onboarding);
    return { status: 200, body: { ...record, remainingCallsToday } };
  } catch (err) {
    logError('saving the plan failed', err);
    return fail(500, 'server_error', 'Something went wrong.');
  }
}
