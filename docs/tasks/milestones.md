# Project Milestones

Planning wave: `first-hybrid-plan` (spec: [`../spec-rebanada.md`](../spec-rebanada.md), review: [`../spec-review.md`](../spec-review.md)).

## Milestone 1: Server and contracts

Goal: a running Express project with a passing test, and the shared types and onboarding validation every later task consumes.

Tasks:

- TASK-001 Scaffold server with a passing test
- TASK-002 Schemas and onboarding validation

## Milestone 2: Coach and API

Goal: onboarding in, validated and saved plan out (Postgres), with failures that never leave a partial plan. No UI yet.

Tasks:

- TASK-003 Coach client
- TASK-004 Plan store (Postgres) and API routes

## Milestone 3: Athlete UI

Goal: the athlete completes the full flow in the browser (spec acceptance criteria 1 to 3 visible end to end).

Tasks:

- TASK-005 Vite client: onboarding form and plan view

## Milestone 4: Deploy

Goal: the slice runs on the internet for Demo Day: Vercel (client), Render (server), Supabase (Postgres).

Tasks:

- TASK-006 Deploy to Vercel, Render and Supabase

## Dependency graph

```
TASK-001 -> TASK-002 -> TASK-003 -> TASK-004 -> TASK-005 -> TASK-006
```
