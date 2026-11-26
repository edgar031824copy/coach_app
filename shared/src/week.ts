// Calendar weeks for plans (E1b follow-up: coach-plan-week-and-delete, design Decision 3b). A week is named by its Monday, as a
// `YYYY-MM-DD` string with no time zone. All arithmetic uses UTC date parts, so a daylight-saving change never makes a day
// shorter or longer. The server calls these with the UTC date, the client with the athlete's own calendar date.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // fixed: Intl says "Sept" in some engines

/** A plan may be for a week at most this many days (26 weeks) before or after the current week. */
export const WEEK_LIMIT_DAYS = 182;

export const WEEK_REFUSED = 'The week must start on a Monday, within half a year of today.';

// Midnight UTC of a real calendar date, or null for anything else (a wrong shape, 2026-13-40, 2026-02-30).
function toTime(date: string): number | null {
  const m = ISO_DATE.exec(date);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const time = Date.UTC(year, month - 1, day);
  const back = new Date(time);
  return back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === day ? time : null;
}

function mustParse(date: string): number {
  const time = toTime(date);
  if (time === null) throw new Error(`Not a calendar date: ${date}`);
  return time;
}

const fromTime = (time: number): string => new Date(time).toISOString().slice(0, 10);

/** The Monday of the week that contains `date` (a Sunday belongs to the week before). */
export function mondayOf(date: string): string {
  const time = mustParse(date);
  const sinceMonday = (new Date(time).getUTCDay() + 6) % 7; // Monday 0 ... Sunday 6
  return fromTime(time - sinceMonday * DAY_MS);
}

export function addDays(date: string, days: number): string {
  return fromTime(mustParse(date) + days * DAY_MS);
}

export function isMonday(date: string): boolean {
  return new Date(mustParse(date)).getUTCDay() === 1;
}

export const monthShort = (date: string): string => MONTHS[new Date(mustParse(date)).getUTCMonth()] as string;

/** "23 Nov": the day without a leading zero, then the three-letter month. */
export const shortDate = (date: string): string => `${new Date(mustParse(date)).getUTCDate()} ${monthShort(date)}`;

/** The UTC calendar date of an instant. */
export const todayUtc = (now: Date): string => now.toISOString().slice(0, 10);

export type WeekResult = { ok: true; value: string } | { ok: false; message: string };

// `weekStart` of a plan request. Only an absent key means "the current week"; null, an empty string, a timestamp or any
// other shape is refused, as is a day that is not a Monday or lies more than 26 weeks from the current week.
export function validateWeekStart(value: unknown, today: string): WeekResult {
  const currentMonday = mondayOf(today);
  if (value === undefined) return { ok: true, value: currentMonday };
  if (typeof value !== 'string') return { ok: false, message: WEEK_REFUSED };
  const time = toTime(value);
  if (time === null || !isMonday(value)) return { ok: false, message: WEEK_REFUSED };
  if (Math.abs(time - mustParse(currentMonday)) / DAY_MS > WEEK_LIMIT_DAYS) return { ok: false, message: WEEK_REFUSED };
  return { ok: true, value };
}
