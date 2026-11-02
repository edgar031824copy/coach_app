---
id: TASK-006
title: Deploy to Vercel, Render and Supabase
milestone: "Milestone 4: Deploy"
priority: 3
estimate: 2
blockedBy: [TASK-005]
blocks: []
areas:
  - deploy
parent: null
---

## Summary

Put the slice on the internet for Demo Day: the Postgres database on Supabase, the Express server on Render, and the Vite client on Vercel.

## Scope

### In scope

- Supabase project (free plan) with the `plans` table created by `npm run migrate`.
- Render web service (free plan) from the `server/` directory, same region as Supabase, with `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CLIENT_ORIGIN`, and `MAX_COACH_CALLS_PER_DAY` set as environment variables in the dashboard.
- Vercel project (Hobby plan) from the `client/` directory with `VITE_API_URL` pointing at the Render URL.
- `README.md` section with the deploy steps, the live URLs, and the pre-demo checklist.

### Out of scope

- Custom domain, CI/CD beyond the providers' Git integration, monitoring, paid plans, an uptime pinger (optional).

## Deliverables

- Live client URL and live server URL, recorded in `README.md`.
- Deploy notes in `README.md`.

## Acceptance Criteria

- [ ] `GET <server-url>/health` returns `{"status":"ok"}`.
- [ ] From the live client URL, an athlete completes the flow: submits a valid onboarding and sees a 7-day plan, and reloading the page shows the same plan.
- [ ] No secret appears in the repo or in the client bundle (`ANTHROPIC_API_KEY` and `DATABASE_URL` exist only in Render's environment).
- [ ] `MAX_COACH_CALLS_PER_DAY` is set on Render, and a spend limit is set on the Anthropic account (a manual step by the owner); posting past the cap on the live server returns 429.
- [ ] The README lists the cold-start behavior and the pre-demo checklist: wake Render via `/health`, confirm the Supabase project is not paused.

## Test Plan

- Manual: walk the full flow on the live URLs after a fresh deploy.
- Manual: leave the server idle for over 15 minutes, load the client, and confirm the loading state appears and the request still succeeds after the cold start.
- Search the built client (`client/dist`) for `sk-` and `postgres://` and confirm there are no matches.

## Context

- Spec §6 "Deployment choices and their known limits": [`../spec-rebanada.md`](../spec-rebanada.md).
- Free-tier limits verified from the providers' docs on 2026-11-01: Render free web services spin down after 15 minutes and wake in about a minute; Supabase free projects pause after a week idle; Vercel Hobby is for non-commercial use only. Re-check before relying on them.
- Do not use Render's own free Postgres: it expires 30 days after creation.

## Definition of Ready

- [x] Hidden assumptions from prior discussion are written down.
- [x] Required files, docs, and dependencies are explicitly referenced.
- [x] A coding agent could begin execution without additional planning context.

## Notes

Account creation and entering secrets in the providers' dashboards are manual steps for the athlete; an agent can prepare the config and the README but should not handle the keys.
