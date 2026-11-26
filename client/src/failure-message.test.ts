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

  it('does not claim nothing was saved after a timeout: the server may still have finished and saved the plan', () => {
    const { message } = describeFailure({ kind: 'timeout' });
    expect(message).not.toMatch(/nothing was saved/i);
    expect(message).toMatch(/may still have been saved/i);
    expect(message).toMatch(/reload/i); // and says how to find out
  });
});

describe('describeFailure: wording', () => {
  const all: ApiFailure[] = [
    { kind: 'network' }, { kind: 'timeout' },
    ...(['validation_error', 'daily_limit_reached', 'plan_unreadable', 'coach_unavailable', 'invalid_coach_response', 'server_error'] as const).map((code) => api(code, { remainingCallsToday: 5, message: 'No running sessions found for week 2 in your pasted plan.' })),
  ];

  it('says what happened in plain sentence-case words, without an apology or an exclamation', () => {
    for (const failure of all) {
      const { message } = describeFailure(failure);
      expect(message, message).toMatch(/^[A-Z]/);
      expect(message, message).not.toMatch(/sorry|apolog|oops|unfortunately|!/i);
    }
  });

  it('tells the athlete to reload the page after a timeout, since the plan may be saved @spec(messages-and-states/failures/timeout-keeps-its-hint)', () => {
    const { message } = describeFailure({ kind: 'timeout' });
    expect(message).toMatch(/may still have been saved/i);
    expect(message).toMatch(/reload the page/i);
  });
});

// Task 1.4 (coach-plan-week-and-delete): a plan that no longer exists has its own, plain message and no retry.
describe('describeFailure: not_found', () => {
  it('says the plan was not found, with no retry and no limit note', () => {
    expect(describeFailure(api('not_found'))).toEqual({ message: 'The plan was not found.', canRetry: false, limitNote: null });
  });
});

// Task 2.2 (coach-plan-week-and-delete): a refused week is explained in words, with no retry (the same week would be
// refused again). Any other validation error keeps the E1 message.
describe('describeFailure: a refused week', () => {
  const REFUSED = 'That week is too far from today. Use New plan to start from this week.';
  const TODAY = 'Some answers need fixing. Check the highlighted fields.';

  it('explains a validation error whose only field is weekStart, with no retry @spec(plan-week/the-client-asks-for-the-right-week/a-week-that-is-too-far-away-is-explained)', () => {
    const n = describeFailure(api('validation_error', { fields: { weekStart: 'The week must start on a Monday, within half a year of today.' } }));
    expect(n).toEqual({ message: REFUSED, canRetry: false, limitNote: null });
  });

  it('keeps the E1 message when other fields are named as well', () => {
    expect(describeFailure(api('validation_error', { fields: { weekStart: 'x', goal: 'Goal is required.' } })).message).toBe(TODAY);
  });

  it('keeps the E1 message for any other single field or for no fields', () => {
    expect(describeFailure(api('validation_error', { fields: { goal: 'Goal is required.' } })).message).toBe(TODAY);
    expect(describeFailure(api('validation_error', { fields: {} })).message).toBe(TODAY);
    expect(describeFailure(api('validation_error')).message).toBe(TODAY);
  });
});
