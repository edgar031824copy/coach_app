import { describe, it, expect } from 'vitest';
import type { CoachResponse, Day } from 'shared';
import { validateCoachResponse } from './coach-response.js';
import { ALL_DAYS, PASTE, onboardingWith, responseWith, session } from '../../test/fixtures.js';

const rules = (violations: { rule: string }[]) => violations.map((v) => v.rule);
const run = (c: 'coach' | 'athlete' = 'coach') => session('running', c);
const cf = (c: 'coach' | 'athlete' = 'coach') => session('crossfit', c);

describe('seven-day plan (structure)', () => {
  it('accepts one entry for each of mon to sun @spec(plan-generation/seven-day-plan/valid-onboarding-gives-seven-days)', () => {
    const onboarding = onboardingWith({ runningDays: ['mon', 'wed'], crossfitDays: ['tue'] });
    const response = responseWith({ mon: [run()], tue: [cf()], wed: [run()] });
    expect(validateCoachResponse(onboarding, response)).toEqual([]);
  });

  it('rejects a response with six days @spec(plan-generation/seven-day-plan/six-days-is-rejected)', () => {
    const response = responseWith({ mon: [run()] });
    response.plan.days = response.plan.days.filter((d) => d.day !== 'sun');
    expect(rules(validateCoachResponse(onboardingWith(), response))).toContain('seven-days');
  });

  it('rejects the same day listed twice, with seven or eight entries @spec(plan-generation/seven-day-plan/duplicate-days-is-rejected)', () => {
    const seven = responseWith({ mon: [run()] });
    seven.plan.days[6] = { day: 'mon', sessions: [], combinedLoadNote: null }; // sun replaced by a second mon
    expect(rules(validateCoachResponse(onboardingWith(), seven))).toContain('seven-days');

    const eight = responseWith({ mon: [run()] });
    eight.plan.days.push({ day: 'mon', sessions: [], combinedLoadNote: null });
    expect(rules(validateCoachResponse(onboardingWith(), eight))).toContain('seven-days');
  });

  it('rejects an empty plan', () => {
    const response = responseWith();
    response.plan.days = [];
    expect(rules(validateCoachResponse(onboardingWith(), response))).toContain('seven-days');
  });
});

describe('at least one rest day', () => {
  it('accepts six training days and one rest day @spec(plan-generation/at-least-one-rest-day/six-training-days-and-one-rest-day)', () => {
    const sessions = Object.fromEntries(ALL_DAYS.slice(0, 6).map((d) => [d, [run()]]));
    expect(validateCoachResponse(onboardingWith(), responseWith(sessions))).toEqual([]);
  });

  it('rejects a plan with no rest day when the athlete\'s own sessions leave a day empty and the coach filled it @spec(plan-generation/at-least-one-rest-day/no-rest-day-is-rejected)', () => {
    const onboarding = onboardingWith({ existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const athleteDays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const sessions = {
      ...Object.fromEntries(athleteDays.map((d) => [d, [run('athlete')]])),
      sat: [cf()], // the coach filled the free days
      sun: [cf()],
    };
    expect(rules(validateCoachResponse(onboarding, responseWith(sessions)))).toContain('rest-day');
  });

  it('rejects a coach that fills all seven days when nothing was pasted @spec(plan-generation/at-least-one-rest-day/coach-fills-all-seven-days-without-a-paste)', () => {
    const sessions = Object.fromEntries(ALL_DAYS.map((d) => [d, [run()]]));
    expect(rules(validateCoachResponse(onboardingWith(), responseWith(sessions)))).toContain('rest-day');
  });

  it('accepts no rest day when the pasted plan\'s own sessions cover all seven days @spec(plan-generation/at-least-one-rest-day/pasted-plan-covers-all-seven-days)', () => {
    const onboarding = onboardingWith({ existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const sessions = Object.fromEntries(ALL_DAYS.map((d) => [d, [run('athlete')]]));
    expect(validateCoachResponse(onboarding, responseWith(sessions))).toEqual([]);
  });

  it('still accepts it when the coach adds a CrossFit session on one of those days', () => {
    const onboarding = onboardingWith({ existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const sessions = { ...Object.fromEntries(ALL_DAYS.map((d) => [d, [run('athlete')]])), tue: [run('athlete'), cf()] };
    const found = rules(validateCoachResponse(onboarding, responseWith(sessions)));
    expect(found).not.toContain('rest-day'); // (the shared-day note rule is task 4.2)
  });

  it('does not let a paste excuse a missing rest day when one day has only coach sessions', () => {
    const onboarding = onboardingWith({ existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const sessions = { ...Object.fromEntries(ALL_DAYS.slice(0, 6).map((d) => [d, [run('athlete')]])), sun: [cf()] };
    expect(rules(validateCoachResponse(onboarding, responseWith(sessions)))).toContain('rest-day');
  });

  it('leaves days the athlete did not declare empty @spec(plan-generation/at-least-one-rest-day/undeclared-days-are-rest-days)', () => {
    const onboarding = onboardingWith({ runningDays: ['mon', 'wed', 'fri'], crossfitDays: [] , existingRunningPlan: null });
    const ok = responseWith({ mon: [run()], wed: [run()], fri: [run()] });
    expect(validateCoachResponse(onboarding, ok)).toEqual([]);
    const bad = responseWith({ mon: [run()], wed: [run()], fri: [run()], sat: [run()] });
    expect(rules(validateCoachResponse(onboarding, bad))).toContain('declared-days');
  });
});

describe('coach sessions on declared days only', () => {
  const onboarding = onboardingWith({ runningDays: ['mon', 'wed'], crossfitDays: ['tue', 'thu'] });

  it('rejects a coach running session on a day not declared for running @spec(plan-generation/coach-sessions-on-declared-days-only/coach-session-on-an-undeclared-day-is-rejected)', () => {
    // tue is declared for CrossFit but not for running
    expect(rules(validateCoachResponse(onboarding, responseWith({ tue: [run()] })))).toContain('declared-days');
  });

  it('rejects a coach CrossFit session on a day not declared for CrossFit @spec(plan-generation/coach-sessions-on-declared-days-only/coach-session-on-an-undeclared-day-is-rejected)', () => {
    expect(rules(validateCoachResponse(onboarding, responseWith({ mon: [cf()] })))).toContain('declared-days');
  });

  it('accepts coach sessions on declared days, per discipline', () => {
    const response = responseWith({ mon: [run()], tue: [cf()], wed: [run()], thu: [cf()] });
    expect(validateCoachResponse(onboarding, response)).toEqual([]);
  });

  it('exempts athlete sessions from the declared days', () => {
    const withPaste = onboardingWith({ runningDays: [], crossfitDays: ['tue'], existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const response = responseWith({ mon: [run('athlete')], sat: [run('athlete')], tue: [cf()] });
    expect(validateCoachResponse(withPaste, response)).toEqual([]);
  });

  it('adds no coach CrossFit session when the athlete declared no CrossFit days @spec(onboarding/required-answers/pasted-plan-without-crossfit-days-is-accepted)', () => {
    // The onboarding half of this scenario (accepted) is tested in task 2.1.
    const noCrossfit = onboardingWith({ runningDays: [], crossfitDays: [], existingRunningPlan: PASTE, pastedPlanWeek: 1 });
    const onlyPasted = responseWith({ mon: [run('athlete')], wed: [run('athlete')] });
    expect(validateCoachResponse(noCrossfit, onlyPasted)).toEqual([]);
    const coachAdded: CoachResponse = responseWith({ mon: [run('athlete')], fri: [cf()] });
    expect(rules(validateCoachResponse(noCrossfit, coachAdded))).toContain('declared-days');
  });

  it('names the day and discipline in the message', () => {
    const [violation] = validateCoachResponse(onboarding, responseWith({ mon: [cf()] }));
    expect(violation?.message).toMatch(/mon/);
    expect(violation?.message).toMatch(/crossfit/i);
  });
});
