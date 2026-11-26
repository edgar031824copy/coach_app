import { describe, it, expect } from 'vitest';
import { addDays, isMonday, mondayOf, monthShort, shortDate, todayUtc, validateWeekStart, WEEK_LIMIT_DAYS } from './week.js';

// Task 1.1: week arithmetic on `YYYY-MM-DD` strings, computed with UTC date parts so a daylight-saving change never moves a
// date. These are the functions behind the plan-week scenarios tested at the route (server) and in the client.
describe('mondayOf', () => {
  it.each([
    ['a Monday is its own week start', '2026-11-23', '2026-11-23'],
    ['a Thursday goes back to its Monday', '2026-11-26', '2026-11-23'],
    ['a Sunday belongs to the week before', '2026-11-29', '2026-11-23'],
    ['the next Monday starts the next week', '2026-11-30', '2026-11-30'],
    ['a Friday on 1 January goes back into the old year', '2027-01-01', '2026-12-28'],
    ['a leap day goes back to its Monday', '2024-02-29', '2024-02-26'],
    ['a Friday on 1 March of a leap year goes back over the leap day', '2024-03-01', '2024-02-26'],
  ])('%s', (_name, date, monday) => {
    expect(mondayOf(date)).toBe(monday);
  });
});

describe('addDays', () => {
  it.each([
    ['2026-11-23', 7, '2026-11-30'],
    ['2026-12-28', 7, '2027-01-04'], // a week across the new year
    ['2026-11-23', -7, '2026-11-16'],
    ['2024-02-28', 2, '2024-03-01'], // over a leap day
    ['2026-03-29', 1, '2026-03-30'], // a European daylight-saving change is not a shorter or longer day
    ['2026-10-25', 1, '2026-10-26'],
    ['2026-11-23', 182, '2027-05-24'],
  ])('%s plus %i days is %s', (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });
});

describe('isMonday', () => {
  it('is true for a Monday only', () => {
    expect(isMonday('2026-11-23')).toBe(true);
    for (const d of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) expect(isMonday(d), d).toBe(false);
  });
});

describe('month names and short dates', () => {
  it('uses fixed three-letter English month names, so "Sep" never becomes "Sept"', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => monthShort(`2026-${String(m).padStart(2, '0')}-15`)))
      .toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });

  it('writes the day without a leading zero, then the month', () => {
    expect(shortDate('2026-11-23')).toBe('23 Nov');
    expect(shortDate('2026-09-07')).toBe('7 Sep');
  });
});

describe('todayUtc', () => {
  it('is the UTC calendar date, even when the local date is another', () => {
    expect(todayUtc(new Date('2026-11-29T23:30:00Z'))).toBe('2026-11-29');
    expect(todayUtc(new Date('2026-12-31T00:00:00Z'))).toBe('2026-12-31');
  });
});

describe('validateWeekStart', () => {
  const today = '2026-11-26'; // a Thursday; the current week starts on 2026-11-23
  const REFUSED = 'The week must start on a Monday, within half a year of today.';

  it('uses the Monday of the current week when the key is absent', () => {
    expect(validateWeekStart(undefined, today)).toEqual({ ok: true, value: '2026-11-23' });
    expect(validateWeekStart(undefined, '2026-11-29')).toEqual({ ok: true, value: '2026-11-23' }); // a Sunday
  });

  it('accepts a real Monday', () => {
    expect(validateWeekStart('2026-11-23', today)).toEqual({ ok: true, value: '2026-11-23' });
    expect(validateWeekStart('2026-11-30', today)).toEqual({ ok: true, value: '2026-11-30' });
  });

  it.each([
    ['a Tuesday', '2026-11-24'],
    ['a Sunday', '2026-11-29'],
    ['a day that does not exist', '2026-13-40'],
    ['a 30th of February', '2026-02-30'],
    ['words', 'next monday'],
    ['a timestamp', '2026-11-23T00:00:00Z'],
    ['a date with a time', '2026-11-23 10:00'],
    ['a short date', '2026-1-5'],
    ['an empty string', ''],
    ['null (only an absent key means "this week")', null],
    ['a number', 20261123],
    ['an array', ['2026-11-23']],
    ['an object', { date: '2026-11-23' }],
    ['a boolean', true],
  ])('refuses %s', (_name, value) => {
    expect(validateWeekStart(value, today)).toEqual({ ok: false, message: REFUSED });
  });

  it('accepts exactly 26 weeks before and after the current week and refuses 27', () => {
    expect(WEEK_LIMIT_DAYS).toBe(182);
    expect(validateWeekStart('2027-05-24', today)).toEqual({ ok: true, value: '2027-05-24' }); // +26 weeks
    expect(validateWeekStart('2026-05-25', today)).toEqual({ ok: true, value: '2026-05-25' }); // -26 weeks
    expect(validateWeekStart('2027-05-31', today).ok).toBe(false); // +27 weeks
    expect(validateWeekStart('2026-05-18', today).ok).toBe(false); // -27 weeks
  });

  it('measures the limit from the current week, not from the day', () => {
    // On Sunday 29 November the current week still starts on 23 November.
    expect(validateWeekStart('2027-05-24', '2026-11-29').ok).toBe(true);
    expect(validateWeekStart('2027-05-31', '2026-11-29').ok).toBe(false);
  });
});
