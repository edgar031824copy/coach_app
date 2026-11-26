import { ApiErrorSchema, PlanRecordSchema, PlanResponseSchema, type ApiError, type Onboarding, type PlanRecord, type PlanResponse } from 'shared';


// A request gives up after 120 s 🔶 (design.md Decision 7): a cold Render wake (about 60 s) plus the coach's own
// 30 s timeout, with margin.
export const REQUEST_TIMEOUT_MS = 120_000;

// Why a call failed, in the three ways the screen treats differently (task 6.4 turns each into a message):
// the server answered with an error, the server could not be reached, or nothing came back in time.
export type ApiFailure = { kind: 'api'; error: ApiError } | { kind: 'network' } | { kind: 'timeout' };
export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: ApiFailure };

export interface ApiOptions {
  baseUrl?: string; // '' (same origin, the dev proxy) unless the client is deployed apart from the server
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// What `call` needs from a schema: a check that never throws. Every Zod schema fits; so does `emptyAnswer`.
type Schema<T> = { safeParse(body: unknown): { success: true; data: T } | { success: false } };
// The success answer of a deletion is an empty 204, so the body must be absent (a 200 with a body is the wrong shape).
const emptyAnswer: Schema<undefined> = { safeParse: (body) => (body === undefined ? { success: true, data: undefined } : { success: false }) };

const unexpected: ApiFailure = { kind: 'api', error: { error: 'server_error', message: 'The server sent an unexpected response.' } };

export function createApi({ baseUrl = '', fetchFn = (...args) => fetch(...args), timeoutMs = REQUEST_TIMEOUT_MS }: ApiOptions = {}) {
  // One request: aborted after `timeoutMs` (covering the body too), the answer checked against the shared schema
  // so a response of the wrong shape is never trusted.
  async function call<T>(path: string, init: RequestInit, schema: Schema<T>): Promise<ApiResult<T>> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const res = await fetchFn(`${baseUrl}${path}`, { ...init, signal: controller.signal });
      const body: unknown = await res.json().catch(() => undefined);
      if (res.ok) {
        const parsed = schema.safeParse(body);
        return parsed.success ? { ok: true, value: parsed.data } : { ok: false, failure: unexpected };
      }
      const error = ApiErrorSchema.safeParse(body);
      return { ok: false, failure: error.success ? { kind: 'api', error: error.data } : unexpected };
    } catch {
      return { ok: false, failure: { kind: timedOut ? 'timeout' : 'network' } };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    // The week is a field beside the onboarding: the Monday the plan is for, chosen by the app and never by the athlete.
    postPlan: (onboarding: Onboarding, weekStart: string): Promise<ApiResult<PlanResponse>> =>
      call('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...onboarding, weekStart }) }, PlanResponseSchema),
    // The latest saved plan, or null before the first one; never calls the coach.
    getPlan: (): Promise<ApiResult<PlanRecord | null>> => call('/api/plan', { method: 'GET' }, PlanRecordSchema.nullable()),
    // Deletes one stored plan by its id. The success answer is an empty 204, so a body is the wrong shape.
    deletePlan: (id: number): Promise<ApiResult<undefined>> => call(`/api/plan/${id}`, { method: 'DELETE' }, emptyAnswer),
  };
}

export type Api = ReturnType<typeof createApi>;
