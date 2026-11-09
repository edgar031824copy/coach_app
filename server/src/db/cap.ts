import type { Db } from './types.js';

export const DEFAULT_CALL_LIMIT = 20; // 🔶 specs/cost-cap
const MAX_CALL_LIMIT = 2_147_483_647; // the largest value of the Postgres int column that holds the count

// MAX_COACH_CALLS_PER_DAY: unset means the default; anything that is not a positive whole number in plain
// digits, up to what the int column can hold, stops the server from starting (the caller lets the error crash
// startup). A larger value would pass startup and then fail every request.
export function parseCallLimit(value: string | undefined): number {
  if (value === undefined) return DEFAULT_CALL_LIMIT;
  if (!/^[1-9]\d*$/.test(value) || value.length > 10 || Number(value) > MAX_CALL_LIMIT) {
    throw new Error(
      `MAX_COACH_CALLS_PER_DAY must be a positive whole number up to ${MAX_CALL_LIMIT}, got "${value}".`,
    );
  }
  return Number(value);
}

export interface CallCounter {
  // Resolves to the day's call count after this call, or null when the cap is reached.
  // The count is never refunded: failed and rejected coach calls still count (specs/cost-cap).
  reserveCall(): Promise<number | null>;
}

// One statement checks and increments, so concurrent requests cannot exceed the cap (design.md Decision 5):
// the first call of the UTC day inserts a row; later calls update it only while it is below the limit;
// at the limit nothing is updated and no row comes back.
export function createCallCounter(db: Db, options: { limit: number; now?: () => Date }): CallCounter {
  const now = options.now ?? (() => new Date());
  return {
    async reserveCall() {
      const day = now().toISOString().slice(0, 10); // UTC day, yyyy-mm-dd
      const { rows } = await db.query(
        `insert into coach_call_counts(day, calls) values ($1::date, 1)
         on conflict (day) do update set calls = coach_call_counts.calls + 1
         where coach_call_counts.calls < $2
         returning calls`,
        [day, options.limit],
      );
      return rows[0] ? Number(rows[0].calls) : null;
    },
  };
}
