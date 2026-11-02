---
id: TASK-002
title: Schemas and onboarding validation
milestone: "Milestone 1: Server and contracts"
priority: 2
estimate: 3
blockedBy: [TASK-001]
blocks: [TASK-003, TASK-004]
areas:
  - contracts
  - validation
parent: null
---

## Summary

Define the `Onboarding` and `Plan` types as zod schemas and implement `validateOnboarding` as a pure function. This is the contract every later task consumes.

## Scope

### In scope

- `server/src/lib/schemas.ts`: `Day`, `Onboarding` (including optional `existingRunningPlan`), `Session` (with `source`), `Plan`, and `CoachResponse` zod schemas and inferred types, exactly as in the spec's "Plan contract".
- `validateOnboarding(input)`: returns `{ ok: true, value }` or `{ ok: false, errors }` with per-field errors; enforces the goal, the "at least one day available" rule (CrossFit days, running days, or a pasted plan), and the 4,000-character cap on the pasted plan.
- `validatePlan(response, onboarding)`: takes a `CoachResponse` and checks the schema plus the business rules: exactly 7 days (one per `Day`); without a pasted plan, sessions only on the available days of each discipline (R2); with a pasted plan, `understoodRunning` is non-empty and the plan's running sessions are exactly `understoodRunning` with `source: "athlete"`, and the coach added only CrossFit sessions on the available CrossFit days (R2, R4); non-empty `combinedLoadNote` on days with both disciplines.

### Out of scope

- Calling the coach, storing, or any UI.

## Deliverables

- `server/src/lib/schemas.ts`
- `server/src/lib/validate.ts`
- `server/src/lib/validate.test.ts`

## Acceptance Criteria

- [ ] A valid onboarding with running and CrossFit on the same day is accepted; so is one with a pasted running plan and no `runningDays`.
- [ ] An onboarding with an empty `goal` returns an error on `goal`; an onboarding with no CrossFit days, no running days, and no pasted plan returns an error on the days fields; a pasted plan over 4,000 characters returns an error on `existingRunningPlan`.
- [ ] `validatePlan` rejects: a plan with 6 days, a session on a day not available for that discipline, and a both-disciplines day whose `combinedLoadNote` is null or empty.
- [ ] With a pasted plan, `validatePlan` rejects: an empty `understoodRunning`, a running session in the plan that is not in `understoodRunning`, an `understoodRunning` session that is missing from the plan or altered (description, intensity, or day), and a running session with `source: "coach"`.
- [ ] `validatePlan` accepts a correct 7-day plan without a pasted plan, and a correct plan that keeps the pasted plan's running sessions unchanged.

## Test Plan

- `npm test` (inside `server/`) runs `server/src/lib/validate.test.ts` covering each case above (these are the S1 cases from the spec review).
- Tests are pure: no network, no filesystem.

## Context

- Spec §4 criteria 1 and 2, §6 "Plan contract": [`../spec-rebanada.md`](../spec-rebanada.md).
- Spec review S1 lists the minimum test cases: [`../spec-review.md`](../spec-review.md).
- Depends on the server project from TASK-001.

## Definition of Ready

- [x] Hidden assumptions from prior discussion are written down.
- [x] Required files, docs, and dependencies are explicitly referenced.
- [x] A coding agent could begin execution without additional planning context.

## Notes

Write the failing tests first if the team wants TDD; the spec does not mandate it.
