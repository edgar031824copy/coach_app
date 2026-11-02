---
id: TASK-004
title: Plan store (Postgres) and API routes
milestone: "Milestone 2: Coach and API"
priority: 2
estimate: 3
blockedBy: [TASK-002, TASK-003]
blocks: [TASK-005]
areas:
  - api
  - storage
  - database
parent: null
---

## Summary

Add the Postgres plan store and the `POST /api/plan` and `GET /api/plan` routes, wiring validation, the coach, and storage together so a plan is saved only after it passes validation.

## Scope

### In scope

- A `plans` table: `id` (serial primary key), `plan` (`jsonb`, not null), `created_at` (`timestamptz`, default now). The SQL lives in `server/migrations/001_create_plans.sql` and is applied by a small script (`npm run migrate`) that reads `DATABASE_URL`.
- `server/src/lib/planStore.ts` with a `PlanStore` interface and a `pg`-based implementation: `readPlan()` returns the latest `Plan` or `null`; `savePlan(plan)` inserts a row. SSL is enabled when `DATABASE_URL` points at Supabase.
- `POST /api/plan`: validate onboarding (400 with per-field errors, coach not called), call `generatePlan`, on success save and return the plan (200), on coach failure return 502 with the error kind and save nothing.
- `GET /api/plan`: return the saved plan or `null`, never calling the coach.
- CORS limited to `CLIENT_ORIGIN`.
- A daily cap on coach calls (spec §6, "Constraints"): a `coach_calls(id, called_at)` table in the same migration; before calling the coach, count today's rows (UTC day) and answer 429 if the count has reached `MAX_COACH_CALLS_PER_DAY` (default 20); record a row for every coach call that is made, including failed ones, because failed calls can still cost money.
- Route logic built from injected dependencies (coach and store) so tests can fake both.

### Out of scope

- UI, regenerating or editing a plan, multiple athletes, auth.

## Deliverables

- `server/migrations/001_create_plans.sql` (creates `plans` and `coach_calls`) and the `migrate` script
- `server/src/lib/planStore.ts`, `server/src/lib/planStore.test.ts`
- `server/src/routes/plan.ts` and `server/src/routes/plan.test.ts`

## Acceptance Criteria

- [ ] `POST /api/plan` with a valid onboarding and a fake coach returning a correct plan responds 200 with the plan, and a following `GET /api/plan` returns the same plan with zero additional coach calls.
- [ ] `POST` with a missing goal, or with no available day, responds 400 with per-field errors, the fake coach is never called, and no row is inserted.
- [ ] `POST` when the fake coach fails (`api_error`, `timeout`, or `invalid_response`) responds 502 and no row is inserted.
- [ ] `POST` with a pasted running plan and a fake coach that keeps its running sessions unchanged responds 200 and the saved plan marks those sessions `source: "athlete"`; with a fake coach that alters them it responds 502 and no row is inserted.
- [ ] `POST` with a pasted plan over 4,000 characters responds 400 with an error on `existingRunningPlan`, and the fake coach is never called.
- [ ] `GET` with nothing saved returns `null`; with two saved plans it returns the most recent.
- [ ] A request from an origin other than `CLIENT_ORIGIN` gets no CORS allow header.
- [ ] With the cap set to 2, the third `POST` of the day responds 429, the fake coach is not called for it, and no row is inserted in `plans`; calls that fail at the coach still count toward the cap; a new UTC day resets the count.

## Test Plan

- `npm test` (inside `server/`) runs the store tests against `pg-mem` and the route tests with supertest, a fake coach, and a fake in-memory store.
- Manual check against a real Supabase database: run `npm run migrate`, start the server with a real key, `curl -X POST` a valid onboarding, then `curl` the `GET` and check the row in Supabase.

## Context

- Spec §4 criteria 1 to 3, §6 "Database" and "Minimal architecture" pieces 3 and 4: [`../spec-rebanada.md`](../spec-rebanada.md).
- Uses `validateOnboarding` and types from TASK-002 and `generatePlan` from TASK-003.
- Spec review "verify" items: confirm `pg-mem` supports the `jsonb` and `timestamptz` usage here; if not, test the store against a local Postgres instead.

## Definition of Ready

- [x] Hidden assumptions from prior discussion are written down.
- [x] Required files, docs, and dependencies are explicitly referenced.
- [x] A coding agent could begin execution without additional planning context.

## Notes

Use the Supabase connection string intended for a long-running server, not the one meant for serverless functions; check which the Supabase dashboard recommends for Render before choosing.
