import { describe, it, expect } from 'vitest';
import type { ApiError } from 'shared';
import type { ApiFailure } from './api.js';
import { describeFailure } from './failure-message.js';

const api = (error: ApiError['error'], extra: Partial<ApiError> = {}): ApiFailure => ({ kind: 'api', error: { error, message: 'from the server', ...extra } });

describe('describeFailure', () => {
  it('offers a retry when the coach is unavailable, and says nothing was saved', () => {
    const n = describeFailure(api('coach_unavailable', { remainingCallsToday: 5 }));
    expect(n.canRetry).toBe(true);
    expect(n.message).toMatch(/coach/i);
    expect(n.message).toMatch(/nothing was saved/i);
    expect(n.limitNote).toBeNull();
  });

  it('offers a retry for an invalid coach response', () => {
    const n = describeFailure(api('invalid_coach_response', { remainingCallsToday: 5 }));
    expect(n.canRetry).toBe(true);
    expect(n.message).toMatch(/did not pass/i);
    expect(n.message).toMatch(/nothing was saved/i);
  });

  it('gives plan_unreadable a clear message with the server text and no retry', () => {
    const n = describeFailure(api('plan_unreadable', { message: 'No running sessions found for week 2 in your pasted plan.', remainingCallsToday: 5 }));
    expect(n.canRetry).toBe(false);
    expect(n.message).toContain('No running sessions found for week 2 in your pasted plan.');
    expect(n.message).toMatch(/check/i);
  });

  it('says the daily limit is reached, with no retry @spec(cost-cap/daily-cap/cap-reached)', () => {
    const n = describeFailure(api('daily_limit_reached', { remainingCallsToday: 0 }));
    expect(n.canRetry).toBe(false);
    expect(n.message).toMatch(/daily limit reached/i);
  });

  it('shows the error and says no retries remain when the last allowed call failed @spec(cost-cap/last-allowed-call-fails/last-call-fails)', () => {
    for (const code of ['coach_unavailable', 'invalid_coach_response', 'server_error'] as const) {
      const n = describeFailure(api(code, { remainingCallsToday: 0 }));
      expect(n.canRetry, code).toBe(false);
      expect(n.limitNote, code).toBe('No retries remain today.');
      expect(n.message.length, code).toBeGreaterThan(10);
    }
    const unreadable = describeFailure(api('plan_unreadable', { remainingCallsToday: 0 }));
    expect(unreadable.limitNote).toBe('No retries remain today.');
    expect(unreadable.message).not.toMatch(/submit again/i); // it must not tell the athlete to do what the note says is impossible
  });

  it('does not say "no retries" for the daily-limit message itself, which already says it', () => {
    expect(describeFailure(api('daily_limit_reached', { remainingCallsToday: 0 })).limitNote).toBeNull();
  });

  it('points a validation error at the highlighted fields', () => {
    const n = describeFailure(api('validation_error', { fields: { goal: 'Goal is required.' } }));
    expect(n.message).toMatch(/highlighted/i);
    expect(n.canRetry).toBe(false);
    expect(n.limitNote).toBeNull();
  });

  it('allows a retry after a server error, a network failure and a timeout', () => {
    expect(describeFailure(api('server_error')).canRetry).toBe(true);
    expect(describeFailure({ kind: 'network' }).canRetry).toBe(true);
    expect(describeFailure({ kind: 'network' }).message).toMatch(/connection/i);
    expect(describeFailure({ kind: 'timeout' }).canRetry).toBe(true);
    expect(describeFailure({ kind: 'timeout' }).message).toMatch(/too long/i);
  });
});
