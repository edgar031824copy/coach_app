import { describe, it, expect } from 'vitest';
import type { PlanRecord } from 'shared';
import { planRecord } from './test-helpers.js';
import { neighbour, nearestAfter, pickStart, without, withPlan } from './plans.js';

// Task 2.1 (coach-plan-history): the pure list helpers behind the stored plans the page holds.
const rec = (id: number, weekStart: string, createdAt = '2026-11-20T10:00:00.000Z'): PlanRecord => ({ ...planRecord(), id, weekStart, createdAt });
const ids = (plans: (PlanRecord | null)[]) => plans.map((p) => p?.id ?? null);
const A = rec(1, '2026-11-09');
const B = rec(2, '2026-11-16');
const C = rec(3, '2026-11-23');
const D = rec(4, '2026-11-30');

describe('pickStart', () => {
  it('opens the plan of the current week even when another plan was made more recently', () => {
    const later = rec(4, '2026-11-30', '2026-11-26T10:00:00.000Z');
    expect(pickStart([A, B, C, later], '2026-11-23')?.id).toBe(3);
  });
  it('opens the plan made most recently when no plan is for the current week', () => {
    const first = rec(1, '2026-11-02', '2026-11-03T10:00:00.000Z');
    const second = rec(2, '2026-11-09', '2026-11-10T10:00:00.000Z');
    expect(pickStart([first, second], '2026-11-23')?.id).toBe(2);
    expect(pickStart([second, first], '2026-11-23')?.id).toBe(2); // whatever the order of the list
  });
  it('compares creation times as moments, not as their position in the list', () => {
    const newerOldWeek = rec(1, '2026-11-02', '2026-11-25T10:00:00.000Z');
    const olderNewWeek = rec(2, '2026-11-09', '2026-11-10T10:00:00.000Z');
    expect(pickStart([newerOldWeek, olderNewWeek], '2026-11-23')?.id).toBe(1);
  });
  it('breaks a tie in creation time with the highest id', () => {
    const t = '2026-11-10T10:00:00.000Z';
    expect(pickStart([rec(5, '2026-11-02', t), rec(9, '2026-11-09', t), rec(7, '2026-11-16', t)], '2026-12-28')?.id).toBe(9);
  });
  it('gives null for an empty list and the only plan for a list of one', () => {
    expect(pickStart([], '2026-11-23')).toBeNull();
    expect(pickStart([A], '2026-11-23')?.id).toBe(1);
  });
});

describe('withPlan', () => {
  it('inserts a new week in its place in week order', () => {
    expect(ids(withPlan([A, C], B))).toEqual([1, 2, 3]);
    expect(ids(withPlan([A, B], D))).toEqual([1, 2, 4]);
    expect(ids(withPlan([B, C], A))).toEqual([1, 2, 3]);
    expect(ids(withPlan([], A))).toEqual([1]);
  });
  it('replaces the plan of the same week and does not add a second one', () => {
    const rebuilt = { ...rec(3, '2026-11-23', '2026-11-27T10:00:00.000Z'), plan: { ...C.plan, recommendations: ['new'] } };
    const result = withPlan([A, B, C, D], rebuilt);
    expect(ids(result)).toEqual([1, 2, 3, 4]);
    expect(result[2]?.plan.recommendations).toEqual(['new']);
  });
  it('does not change the list it was given', () => {
    const list = [A, C];
    withPlan(list, B);
    expect(ids(list)).toEqual([1, 3]);
  });
});

describe('without and nearestAfter', () => {
  it('removes the first, a middle and the last plan', () => {
    expect(ids(without([A, B, C], 1))).toEqual([2, 3]);
    expect(ids(without([A, B, C], 2))).toEqual([1, 3]);
    expect(ids(without([A, B, C], 3))).toEqual([1, 2]);
    expect(ids(without([A, B, C], 99))).toEqual([1, 2, 3]);
  });
  it('chooses the next later plan, else the previous one', () => {
    expect(nearestAfter([A, B, C], 1)?.id).toBe(2);
    expect(nearestAfter([A, B, C], 2)?.id).toBe(3);
    expect(nearestAfter([A, B, C], 3)?.id).toBe(2);
    expect(nearestAfter([A, C], 3)?.id).toBe(1); // weeks without a plan are skipped
  });
  it('gives null when the plan is the only one, or is not in the list', () => {
    expect(nearestAfter([A], 1)).toBeNull();
    expect(nearestAfter([], 1)).toBeNull();
    expect(nearestAfter([A, B], 99)).toBeNull();
  });
});

describe('neighbour', () => {
  it('steps to the earlier and the later plan', () => {
    expect(neighbour([A, B, C], 2, -1)?.id).toBe(1);
    expect(neighbour([A, B, C], 2, 1)?.id).toBe(3);
    expect(neighbour([A, C], 3, -1)?.id).toBe(1);
  });
  it('gives null at the ends and for an unknown plan or an empty list', () => {
    expect(neighbour([A, B, C], 1, -1)).toBeNull();
    expect(neighbour([A, B, C], 3, 1)).toBeNull();
    expect(neighbour([A], 1, 1)).toBeNull();
    expect(neighbour([A, B], 99, 1)).toBeNull();
    expect(neighbour([], 1, 1)).toBeNull();
  });
});
