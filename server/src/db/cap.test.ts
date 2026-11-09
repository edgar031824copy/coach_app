import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCallCounter, parseCallLimit, DEFAULT_CALL_LIMIT } from './cap.js';
import { migratedClient } from '../../test/real-db.js';

let db: Awaited<ReturnType<typeof migratedClient>>;
beforeEach(async () => {
  db = await migratedClient();
});
afterEach(() => db.cleanup());

const clockAt = (iso: string) => {
  let current = new Date(iso);
  return { now: () => current, set: (next: string) => (current = new Date(next)) };
};
const storedCounts = async () =>
  (await db.client.query("select day::text as day, calls from coach_call_counts order by day")).rows;

describe('parseCallLimit', () => {
  it('uses 20 when MAX_COACH_CALLS_PER_DAY is not set @spec(cost-cap/daily-cap/default-limit)', () => {
    expect(DEFAULT_CALL_LIMIT).toBe(20);
    expect(parseCallLimit(undefined)).toBe(20);
  });

  it('honors a valid setting, up to the largest value Postgres int accepts', () => {
    expect(parseCallLimit('3')).toBe(3);
    expect(parseCallLimit('100')).toBe(100);
    expect(parseCallLimit('2147483647')).toBe(2147483647);
  });

  // The counter column is an int: a larger limit would pass startup and then fail every request.
  it.each(['2147483648', '99999999999', '9007199254740993'])(
    'refuses a limit too large for the int column: "%s" @spec(cost-cap/daily-cap/invalid-limit-setting)',
    (value) => {
      expect(() => parseCallLimit(value)).toThrow(/MAX_COACH_CALLS_PER_DAY/);
    },
  );

  it.each(['0', '-1', 'abc', '1.5', '', ' 5', '5 ', '5x', '1e3', '+5', '007'])(
    'refuses a setting that is not a positive integer: "%s" @spec(cost-cap/daily-cap/invalid-limit-setting)',
    (value) => {
      expect(() => parseCallLimit(value)).toThrow(/MAX_COACH_CALLS_PER_DAY/);
    },
  );
});

describe('call counter', () => {
  it('counts up to the limit, then returns null and never goes past it @spec(cost-cap/daily-cap/default-limit)', async () => {
    const clock = clockAt('2026-11-08T12:00:00Z');
    const counter = createCallCounter(db.client, { limit: parseCallLimit(undefined), now: clock.now });
    for (let i = 1; i <= 20; i++) expect(await counter.reserveCall()).toBe(i);
    expect(await counter.reserveCall()).toBeNull(); // the 21st is denied
    expect(await counter.reserveCall()).toBeNull();
    expect(await storedCounts()).toEqual([{ day: '2026-11-08', calls: 20 }]);
  });

  it('honors a configured limit', async () => {
    const counter = createCallCounter(db.client, { limit: parseCallLimit('3'), now: clockAt('2026-11-08T12:00:00Z').now });
    expect([await counter.reserveCall(), await counter.reserveCall(), await counter.reserveCall(), await counter.reserveCall()])
      .toEqual([1, 2, 3, null]);
  });

  it('starts from zero on a new UTC day @spec(cost-cap/what-counts-toward-the-cap/new-day-resets-the-count)', async () => {
    const clock = clockAt('2026-11-08T12:00:00Z');
    const counter = createCallCounter(db.client, { limit: 2, now: clock.now });
    await counter.reserveCall();
    await counter.reserveCall();
    expect(await counter.reserveCall()).toBeNull(); // day one is full
    clock.set('2026-11-09T08:00:00Z');
    expect(await counter.reserveCall()).toBe(1); // new day, count is zero again
    expect(await storedCounts()).toEqual([
      { day: '2026-11-08', calls: 2 },
      { day: '2026-11-09', calls: 1 },
    ]);
  });

  it('switches day at midnight UTC, not local time @spec(cost-cap/what-counts-toward-the-cap/new-day-resets-the-count)', async () => {
    const clock = clockAt('2026-11-08T23:59:59Z');
    const counter = createCallCounter(db.client, { limit: 1, now: clock.now });
    expect(await counter.reserveCall()).toBe(1);
    expect(await counter.reserveCall()).toBeNull();
    clock.set('2026-11-09T00:00:00Z');
    expect(await counter.reserveCall()).toBe(1);
  });
});

// Task 3.4: the atomic upsert holds under real concurrency (several connections, same database).
// A loop of 20 rounds, each on its own UTC day so every round is a fresh race.
describe('call counter under concurrency', () => {
  const daysFrom = (start: string, n: number) =>
    Array.from({ length: n }, (_, i) => new Date(Date.parse(start) + i * 86_400_000));

  it('lets only one of two simultaneous requests through when one call is left, 20 times @spec(cost-cap/cap-holds-under-concurrency/two-requests-with-one-call-left)', async () => {
    // At the endpoint the loser gets 429 daily_limit_reached (task 5.1); here the counter returns null.
    const pool = db.pool(4);
    for (const day of daysFrom('2026-12-01T12:00:00Z', 20)) {
      const counter = createCallCounter(pool, { limit: 3, now: () => day });
      await counter.reserveCall();
      await counter.reserveCall(); // two used, one left
      const results = await Promise.all([counter.reserveCall(), counter.reserveCall()]);
      expect(results.filter((r) => r !== null)).toEqual([3]);
      expect(results.filter((r) => r === null)).toHaveLength(1);
    }
    const { rows } = await db.client.query('select max(calls)::int as most from coach_call_counts');
    expect(rows[0]?.most).toBe(3);
  });

  it('lets exactly one of two through when both race to create the first row of the day, 20 times', async () => {
    const pool = db.pool(4);
    for (const day of daysFrom('2027-01-01T12:00:00Z', 20)) {
      const counter = createCallCounter(pool, { limit: 1, now: () => day });
      const results = await Promise.all([counter.reserveCall(), counter.reserveCall()]);
      expect(results.filter((r) => r === 1)).toHaveLength(1);
      expect(results.filter((r) => r === null)).toHaveLength(1);
    }
  });

  it('never exceeds the limit with many simultaneous requests', async () => {
    const pool = db.pool(12);
    const counter = createCallCounter(pool, { limit: 5, now: () => new Date('2027-02-01T12:00:00Z') });
    const results = await Promise.all(Array.from({ length: 12 }, () => counter.reserveCall()));
    expect(results.filter((r) => r !== null).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(results.filter((r) => r === null)).toHaveLength(7);
    expect((await db.client.query('select calls from coach_call_counts')).rows).toEqual([{ calls: 5 }]);
  });
});
