import { describe, it, expect } from 'vitest';
import { formatPlanCheckReport, parsePlanCheckArgs } from './plan-check-lib.js';
import { onboardingWith, responseWith, session } from '../../test/fixtures.js';

describe('parsePlanCheckArgs', () => {
  it('needs a file, and defaults to week 1 and CrossFit on Tuesday and Thursday', () => {
    expect(parsePlanCheckArgs(['--file', '/tmp/plan.txt'])).toEqual({ ok: true, options: { file: '/tmp/plan.txt', week: 1, crossfitDays: ['tue', 'thu'] } });
    const missing = parsePlanCheckArgs([]);
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.error).toMatch(/--file/);
  });

  it('reads the week and the CrossFit days', () => {
    expect(parsePlanCheckArgs(['--file', 'p.txt', '--week', '7', '--crossfit', 'mon,fri'])).toEqual({ ok: true, options: { file: 'p.txt', week: 7, crossfitDays: ['mon', 'fri'] } });
  });

  it('allows no CrossFit days at all, written as "none"', () => {
    expect(parsePlanCheckArgs(['--file', 'p.txt', '--crossfit', 'none'])).toMatchObject({ ok: true, options: { crossfitDays: [] } });
  });

  it('refuses a week outside 1 to 52 or not a whole number (the same limits as the form)', () => {
    for (const bad of ['0', '53', '2.5', 'x', '']) {
      const r = parsePlanCheckArgs(['--file', 'p.txt', '--week', bad]);
      expect(r.ok, bad).toBe(false);
      expect(!r.ok && r.error).toMatch(/week/i);
    }
  });

  it('refuses unknown or repeated CrossFit days, and unknown flags', () => {
    expect(parsePlanCheckArgs(['--file', 'p.txt', '--crossfit', 'mon,funday']).ok).toBe(false);
    expect(parsePlanCheckArgs(['--file', 'p.txt', '--crossfit', 'mon,mon']).ok).toBe(false);
    expect(parsePlanCheckArgs(['--file', 'p.txt', '--bogus']).ok).toBe(false);
  });
});

describe('formatPlanCheckReport', () => {
  const onboarding = onboardingWith({ existingRunningPlan: 'x', pastedPlanWeek: 3, runningDays: [], crossfitDays: ['tue'] });
  const athlete = (description: string) => session('running', 'athlete', 'easy', description);
  const response = {
    ...responseWith({ mon: [athlete('7 km easy')], tue: [session('crossfit', 'coach', 'moderate', 'Strength class')], sat: [athlete('17 km long run')] }),
    understoodRunning: [
      { dayOptions: ['mon' as const], description: '7 km easy' },
      { dayOptions: ['fri' as const, 'sat' as const, 'sun' as const], description: '17 km long run' },
    ],
  };
  const report = formatPlanCheckReport({ onboarding, response, violations: [], seconds: 4.2 });

  it('lists what the coach read for the chosen week, with flexible days joined by slashes', () => {
    expect(report).toContain('week 3');
    expect(report).toContain('2 running sessions');
    expect(report).toContain('[mon] 7 km easy');
    expect(report).toContain('[fri/sat/sun] 17 km long run');
  });

  it('shows the plan Monday to Sunday, labeling the athlete\'s sessions and the coach\'s, and rest days', () => {
    expect(report).toMatch(/mon: .*running.*your plan.*"7 km easy"/);
    expect(report).toMatch(/tue: .*crossfit.*coach.*moderate.*"Strength class"/);
    expect(report).toMatch(/wed: rest/);
    expect(report).toMatch(/sat: .*"17 km long run"/);
    expect(report.indexOf('mon:')).toBeLessThan(report.indexOf('sun:'));
  });

  it('says PASS when no rule was broken, and names every broken rule otherwise', () => {
    expect(report).toMatch(/Rule check: PASS/);
    const bad = formatPlanCheckReport({ onboarding, response, violations: [{ rule: 'pasted-sessions', message: 'x' }, { rule: 'rest-day', message: 'y' }], seconds: 1 });
    expect(bad).toMatch(/Rule check: FAIL/);
    expect(bad).toContain('pasted-sessions');
    expect(bad).toContain('rest-day');
  });

  it('tells the athlete what to compare, and shows pain and the safety note state', () => {
    expect(report).toMatch(/compare/i);
    expect(report).toContain('painReported: false');
    expect(report).toContain('safetyNote: none');
  });

  it('says plainly when nothing was read from the paste', () => {
    const empty = formatPlanCheckReport({ onboarding, response: responseWith({}), violations: [{ rule: 'plan-unreadable', message: 'z' }], seconds: 1 });
    expect(empty).toMatch(/0 running sessions/);
    expect(empty).toContain('plan-unreadable');
  });

  it('never prints the pasted text itself, only what the coach read from it', () => {
    const withPaste = onboardingWith({ existingRunningPlan: 'SECRET-PASTED-LINE', pastedPlanWeek: 3, crossfitDays: ['tue'] });
    expect(formatPlanCheckReport({ onboarding: withPaste, response, violations: [], seconds: 1 })).not.toContain('SECRET-PASTED-LINE');
  });
});
