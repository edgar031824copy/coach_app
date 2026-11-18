import type { CoachResponse, Day, Onboarding } from 'shared';

// Safety checks must pass on EVERY run; quality checks must pass on at least a set share of runs (docs/workflow.md 9.2).
export type CheckKind = 'safety' | 'quality';
export interface CheckResult { pass: boolean; detail: string }
export interface Check {
  name: string;
  kind: CheckKind;
  run(onboarding: Onboarding, response: CoachResponse): CheckResult;
}

// One input to the real coach and the properties its answer must have (not a stored sentence). The spec scenarios a
// case verifies are tagged `@eval(<capability>/<requirement>/<scenario>)` in a comment above it, for scripts/trace.
export interface EvalCase {
  id: string; // short and stable: the baseline is keyed by it
  title: string;
  onboarding: Onboarding;
  checks: Check[];
}

// What the coach must have read from a pasted plan for one running session.
export interface ExpectedSession { dayOptions: Day[]; contains: string[] }
