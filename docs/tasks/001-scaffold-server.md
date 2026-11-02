---
id: TASK-001
title: Scaffold server with a passing test
milestone: "Milestone 1: Server and contracts"
priority: 2
estimate: 1
blockedBy: []
blocks: [TASK-002]
areas:
  - setup
  - server
parent: null
---

## Summary

Create the repo layout and the `server/` package: Node + Express + TypeScript with Vitest and supertest, a `GET /health` route, and a passing test. Time box: about 1 hour.

## Scope

### In scope

- Root `.gitignore` (`node_modules`, `dist`, `.env*` except `.env.example`) and a root `README.md` with the setup and test commands.
- `server/` package: Express app in `src/app.ts` (exported, not listening), `src/index.ts` (starts listening on `PORT`), `GET /health` returning `{ "status": "ok" }`.
- Vitest + supertest configured; one test that hits `/health`.
- `server/.env.example` listing `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CLIENT_ORIGIN`, `PORT` (no real values).
- `build` and `start` scripts that work for a Render deploy later.

### Out of scope

- Any product code (schemas, coach, store, routes beyond `/health`).
- The `client/` package.
- Deployment.

## Deliverables

- `server/package.json` with `dev`, `build`, `start`, and `test` scripts.
- `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/app.ts`, `server/src/index.ts`, `server/src/app.test.ts`.
- Root `.gitignore`, `README.md`, and `server/.env.example`.

## Acceptance Criteria

- [ ] `cd server && npm install && npm test` exits 0 on a clean clone and reports at least one passing test.
- [ ] `npm run dev` starts the server and `curl localhost:$PORT/health` returns `{"status":"ok"}`.
- [ ] `.env` files (except `.env.example`) are git-ignored.

## Test Plan

- Run `npm test` and confirm the `/health` test passes.
- Run `npm run build && npm start` and confirm `/health` answers from the compiled output.
- Run `git status` after creating `server/.env` and confirm it does not show as untracked.

## Context

- Spec §6 (technical decisions): [`../spec-rebanada.md`](../spec-rebanada.md).
- Spec review S2: this task is what proves the test command works; if it fails, fix the spec before continuing.
- Verify the installed Node version against the dependencies chosen (spec review, coherence section).

## Definition of Ready

- [x] Hidden assumptions from prior discussion are written down.
- [x] Required files, docs, and dependencies are explicitly referenced.
- [x] A coding agent could begin execution without additional planning context.

## Notes

Exporting the Express app separately from the code that listens is what lets supertest test routes without opening a port. Keep that split.
