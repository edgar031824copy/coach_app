import { describe, it, expect, afterEach } from 'vitest';
import { currentMonday, nextWeekStart } from './week.js';

const realTz = process.env.TZ;
afterEach(() => {
  if (realTz === undefined) delete process.env.TZ;
  else process.env.TZ = realTz;
});

// Node re-reads TZ when it is assigned. The offset check proves the zone really changed, so a test cannot pass by accident.
function inZone(tz: string, offsetMinutes: number, at: Date, run: () => void) {
  process.env.TZ = tz;
  expect(-at.getTimezoneOffset()).toBe(offsetMinutes);
  run();
}

describe('currentMonday: the Monday of the athlete\'s own calendar week', () => {
  it('gives the Monday of the week for a Thursday', () => {
    expect(currentMonday(new Date(2026, 10, 26, 12, 0))).toBe('2026-11-23'); // 26 Nov 2026 is a Thursday
  });

  it('gives the same day for a Monday and the Monday before for a Sunday', () => {
    expect(currentMonday(new Date(2026, 10, 23, 0, 0))).toBe('2026-11-23');
    expect(currentMonday(new Date(2026, 10, 29, 23, 59))).toBe('2026-11-23');
  });

  it('crosses a month and a year', () => {
    expect(currentMonday(new Date(2026, 11, 2, 9, 0))).toBe('2026-11-30');
    expect(currentMonday(new Date(2027, 0, 1, 9, 0))).toBe('2026-12-28');
  });

  it('follows the local calendar, not UTC: 01:30 on Monday 30 Nov in Madrid is still Sunday in UTC', () => {
    const at = new Date('2026-11-29T23:30:00Z'); // 00:30 Monday in Madrid (UTC+1)
    inZone('Europe/Madrid', 60, at, () => {
      expect(currentMonday(at)).toBe('2026-11-30');
    });
  });

  it('follows the local calendar west of UTC: Sunday evening in Los Angeles is already Monday in UTC', () => {
    const at = new Date('2026-11-30T03:00:00Z'); // 19:00 Sunday 29 Nov in Los Angeles (UTC-8)
    inZone('America/Los_Angeles', -480, at, () => {
      expect(currentMonday(at)).toBe('2026-11-23');
    });
  });
});

describe('nextWeekStart: the week "Plan next week" asks for', () => {
  const now = new Date(2026, 10, 26, 12, 0); // Thursday 26 Nov 2026, current Monday 2026-11-23

  it('is the shown week plus 7 days', () => {
    expect(nextWeekStart('2026-11-23', now)).toBe('2026-11-30');
  });

  it('crosses a month and a year', () => {
    expect(nextWeekStart('2026-11-30', now)).toBe('2026-12-07');
    expect(nextWeekStart('2026-12-28', now)).toBe('2027-01-04');
  });

  it('never plans the past: an old shown week gives the current Monday', () => {
    expect(nextWeekStart('2026-10-26', now)).toBe('2026-11-23'); // four weeks back
    expect(nextWeekStart('2026-11-16', now)).toBe('2026-11-23'); // last week + 7 is this week: the same answer
  });

  it('keeps a future week moving forward', () => {
    expect(nextWeekStart('2026-12-07', now)).toBe('2026-12-14');
  });
});
