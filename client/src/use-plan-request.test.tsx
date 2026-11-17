import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createApi, REQUEST_TIMEOUT_MS } from './api.js';
import { usePlanRequest, WAKING_AFTER_MS } from './use-plan-request.js';
import { delayedFetch, onboarding, planResponse } from './test-helpers.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = (ms: number, status = 200, body: unknown = planResponse) =>
  renderHook(() => usePlanRequest(createApi({ fetchFn: delayedFetch(ms, status, body) })));
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('usePlanRequest: waking state', () => {
  it('shows "waking" after 3 s of silence and not before @spec(deploy/cold-start-experience/server-is-waking-up)', async () => {
    expect(WAKING_AFTER_MS).toBe(3000);
    const { result } = setup(60_000);
    expect(result.current.state.phase).toBe('idle');
    act(() => { void result.current.submit(onboarding); });
    expect(result.current.state.phase).toBe('loading');
    await tick(WAKING_AFTER_MS - 1);
    expect(result.current.state.phase).toBe('loading');
    await tick(1);
    expect(result.current.state.phase).toBe('waking');
  });

  it('shows no timeout error while a cold server wakes and the coach runs (90 s), then the plan @spec(deploy/cold-start-experience/timeout-covers-a-cold-start)', async () => {
    const { result } = setup(90_000);
    act(() => { void result.current.submit(onboarding); });
    await tick(89_999);
    expect(result.current.state.phase).toBe('waking');
    await tick(1);
    expect(result.current.state).toEqual({ phase: 'done', result: { ok: true, value: planResponse } });
  });

  it('never shows "waking" for a quick answer', async () => {
    const { result } = setup(500);
    act(() => { void result.current.submit(onboarding); });
    await tick(500);
    expect(result.current.state.phase).toBe('done');
    await tick(10_000);
    expect(result.current.state.phase).toBe('done'); // the 3 s timer was cleared, it does not flip a finished request
  });

  it('ends in a timeout failure at 120 s', async () => {
    const { result } = setup(10 * 60_000);
    act(() => { void result.current.submit(onboarding); });
    await tick(REQUEST_TIMEOUT_MS);
    expect(result.current.state).toEqual({ phase: 'done', result: { ok: false, failure: { kind: 'timeout' } } });
  });

  it('can be used again after a result', async () => {
    const { result } = setup(100);
    act(() => { void result.current.submit(onboarding); });
    await tick(100);
    expect(result.current.state.phase).toBe('done');
    act(() => { void result.current.submit(onboarding); });
    expect(result.current.state.phase).toBe('loading'); // the old result is gone while the new request runs
    await tick(100);
    expect(result.current.state.phase).toBe('done');
  });
});
