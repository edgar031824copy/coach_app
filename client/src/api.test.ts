import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { PlanRecordSchema } from 'shared';
import { createApi, REQUEST_TIMEOUT_MS } from './api.js';
import { delayedFetch, onboarding, planResponse } from './test-helpers.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Settles when the promise does, and says whether it has yet; lets a test look at the moment before and after a deadline.
const watch = <T>(p: Promise<T>) => {
  const box: { done: boolean; value?: T } = { done: false };
  void p.then((v) => { box.done = true; box.value = v; });
  return box;
};

describe('api: timeout', () => {
  it('has a 120 s timeout that exceeds a cold Render wake (about 60 s) plus the coach timeout (30 s) @spec(deploy/cold-start-experience/timeout-covers-a-cold-start)', async () => {
    expect(REQUEST_TIMEOUT_MS).toBe(120_000);
    const api = createApi({ fetchFn: delayedFetch(60_000 + 30_000, 200, planResponse) });
    const call = watch(api.postPlan(onboarding, "2026-11-23"));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(call.done).toBe(true);
    expect(call.value).toEqual({ ok: true, value: planResponse }); // answered after the full wake plus coach time: no timeout
  });

  it('gives up at 120 s, not before, and reports a timeout', async () => {
    const api = createApi({ fetchFn: delayedFetch(10 * 60_000, 200, planResponse) });
    const call = watch(api.postPlan(onboarding, "2026-11-23"));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(call.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(call.value).toEqual({ ok: false, failure: { kind: 'timeout' } });
  });

  it('applies the same timeout to reading the saved plan', async () => {
    const api = createApi({ fetchFn: delayedFetch(10 * 60_000, 200, null) });
    const call = watch(api.getPlan());
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(call.value).toEqual({ ok: false, failure: { kind: 'timeout' } });
  });
});

describe('api: results', () => {
  beforeEach(() => vi.useRealTimers()); // these answer at once, so no fake clock is needed

  it('posts the onboarding and the week as JSON to /api/plan under the base URL', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(planResponse), { status: 200 }));
    await createApi({ baseUrl: 'https://server.example.com', fetchFn: fetchFn as unknown as typeof fetch }).postPlan(onboarding, '2026-11-23');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://server.example.com/api/plan');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ ...onboarding, weekStart: '2026-11-23' });
  });

  it('returns the typed API error with its fields', async () => {
    const error = { error: 'validation_error', message: 'Check the form.', fields: { goal: 'Goal is required.' } };
    const r = await createApi({ fetchFn: delayedFetch(0, 400, error) }).postPlan(onboarding, "2026-11-23");
    expect(r).toEqual({ ok: false, failure: { kind: 'api', error } });
  });

  it('keeps remainingCallsToday on a failed call', async () => {
    const error = { error: 'coach_unavailable', message: 'Try again.', remainingCallsToday: 3 };
    const r = await createApi({ fetchFn: delayedFetch(0, 502, error) }).postPlan(onboarding, "2026-11-23");
    expect(r).toEqual({ ok: false, failure: { kind: 'api', error } });
  });

  it('reports a network failure when the server cannot be reached', async () => {
    const fetchFn = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await createApi({ fetchFn }).postPlan(onboarding, "2026-11-23")).toEqual({ ok: false, failure: { kind: 'network' } });
  });

  it('treats a response of the wrong shape as a server error instead of trusting it', async () => {
    const r = await createApi({ fetchFn: delayedFetch(0, 200, { nonsense: true }) }).postPlan(onboarding, "2026-11-23");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.failure.kind === 'api' && r.failure.error.error).toBe('server_error');
    const html = (async () => new Response('<html>bad gateway</html>', { status: 502 })) as unknown as typeof fetch;
    const h = await createApi({ fetchFn: html }).postPlan(onboarding, "2026-11-23");
    expect(!h.ok && h.failure.kind === 'api' && h.failure.error.error).toBe('server_error');
  });

  it('reads the saved plan, or null when there is none', async () => {
    const record = PlanRecordSchema.parse(planResponse); // the saved plan has no remainingCallsToday
    expect(await createApi({ fetchFn: delayedFetch(0, 200, record) }).getPlan()).toEqual({ ok: true, value: record });
    expect(await createApi({ fetchFn: delayedFetch(0, 200, null) }).getPlan()).toEqual({ ok: true, value: null });
  });
});

// Task 2.4 (coach-plan-week-and-delete): deleting a plan, whose success answer is an empty 204.
describe('api: deletePlan', () => {
  beforeEach(() => vi.useRealTimers());

  it('sends DELETE to /api/plan/:id under the base URL and accepts the empty 204 answer', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const r = await createApi({ baseUrl: 'https://server.example.com', fetchFn: fetchFn as unknown as typeof fetch }).deletePlan(7);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://server.example.com/api/plan/7');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(r).toEqual({ ok: true, value: undefined });
  });

  it('returns the typed not_found error for a plan that is gone', async () => {
    const error = { error: 'not_found', message: 'No such plan.' };
    expect(await createApi({ fetchFn: delayedFetch(0, 404, error) }).deletePlan(7)).toEqual({ ok: false, failure: { kind: 'api', error } });
  });

  it('returns a network failure, and a timeout when no answer comes in time', async () => {
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await createApi({ fetchFn: down }).deletePlan(7)).toEqual({ ok: false, failure: { kind: 'network' } });
    vi.useFakeTimers();
    const call = watch(createApi({ fetchFn: delayedFetch(10 * 60_000, 204, null) }).deletePlan(7));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(call.value).toEqual({ ok: false, failure: { kind: 'timeout' } });
  });

  it('does not trust a 200 that carries a body: the success answer is empty', async () => {
    const r = await createApi({ fetchFn: delayedFetch(0, 200, { surprise: true }) }).deletePlan(7);
    expect(r.ok).toBe(false);
  });
});
