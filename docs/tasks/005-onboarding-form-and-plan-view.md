---
id: TASK-005
title: "Vite client: onboarding form and plan view"
milestone: "Milestone 3: Athlete UI"
priority: 3
estimate: 5
blockedBy: [TASK-004]
blocks: [TASK-006]
areas:
  - client
  - ui
parent: null
---

## Summary

Create the `client/` package (React + TypeScript + Vite + Vitest) and build the single page: the onboarding form, per-field errors, a loading state, the 7-day plan view with combined-load notes, an error state with retry, and showing the saved plan on reload.

## Scope

### In scope

- `client/` scaffold with Vite, React, TypeScript, Vitest, React Testing Library, and `client/.env.example` with `VITE_API_URL`.
- Form fields: goal, running level, CrossFit level, injuries, available days per discipline, and an optional "My current running plan" text box with a live character counter (4,000 max). Helper text says running days become optional when a plan is pasted.
- Submit to `POST ${VITE_API_URL}/api/plan`; show per-field errors from a 400; show an error message with a retry button on a 502 or a network failure.
- Loading state with a "waking up the coach" message, and a request timeout longer than the server's 30 s coach timeout (for example 90 s) to survive a Render cold start.
- Plan view: one block per day, each session with discipline, description, intensity; the combined-load note visible on days that have one; sessions with `source: "athlete"` carry a "from your plan" label so the athlete can check what the coach read.
- On load, call `GET /api/plan` and show the saved plan instead of the form when one exists.
- Lightweight required-field checks in the client; the server's errors are always displayed too.
- Default styles only (spec review S3).
- Vite dev proxy or `VITE_API_URL` pointing at the local server for development.

### Out of scope

- Regenerate or edit plan, login, history, Garmin, deployment (TASK-006).

## Deliverables

- `client/` package with `dev`, `build`, and `test` scripts
- `client/src/App.tsx` and its components
- Component tests for the states below

## Acceptance Criteria

- [ ] Submitting a valid form (fetch mocked) shows the 7-day plan, with a combined-load note on every both-disciplines day.
- [ ] Submitting with an empty goal, or with no day selected in either discipline, shows an error next to the field; a 400 from the server also shows its per-field errors.
- [ ] When the API responds 502, an error message and a retry button appear, and no plan is shown.
- [ ] When the API responds 429 (daily limit reached), a message says the daily limit was reached and to try again tomorrow, with no retry button.
- [ ] Reloading the page with a saved plan shows that plan without the form and without calling `POST`.
- [ ] While waiting for the response, the loading message is visible and the submit button is disabled.
- [ ] Submitting with a pasted running plan and no running days is accepted; the returned plan shows the running sessions labeled "from your plan" and the CrossFit sessions without that label.
- [ ] Pasting more than 4,000 characters shows an error next to the box and sends no request.

## Test Plan

- `npm test` (inside `client/`) runs component tests with a mocked `fetch` for each case above.
- Manual end-to-end check: run `server/` and `client/` locally with a real key and a database, fill the form, see the plan, reload, see the same plan; then break the key and confirm the error and retry appear.

## Context

- Spec §3 flow, §4 criteria 1 to 3, §6 "Frontend" and cold-start notes: [`../spec-rebanada.md`](../spec-rebanada.md).
- API contract from TASK-004; the client keeps its own copy of the `Onboarding` and `Plan` types from TASK-002.

## Definition of Ready

- [x] Hidden assumptions from prior discussion are written down.
- [x] Required files, docs, and dependencies are explicitly referenced.
- [x] A coding agent could begin execution without additional planning context.

## Notes

This is the largest task. If it runs long in class, split the scaffold plus form from the plan view and error states.
