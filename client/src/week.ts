import { addDays, mondayOf } from 'shared';

// The athlete's calendar day as YYYY-MM-DD, from the browser's local date parts (never from UTC: 01:30 on a Monday in
// Madrid is still Sunday in UTC, and the athlete's week is the one on their own calendar).
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// The Monday of the current week on the athlete's calendar: the week a first plan and "New plan" are for.
export const currentMonday = (now: Date): string => mondayOf(localDay(now));

// The week "Plan next week" asks for: the shown plan's week plus 7 days, but never before the current Monday (a plan for
// a week already over is no use). ISO date strings of the same shape compare correctly as text.
export function nextWeekStart(shownWeekStart: string, now: Date): string {
  const next = addDays(shownWeekStart, 7);
  const current = currentMonday(now);
  return next < current ? current : next;
}
