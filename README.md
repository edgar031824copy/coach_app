# coach_app: Virtual Hybrid Coach

A virtual coach for hybrid athletes (running + CrossFit). It builds a combined training plan from an onboarding intake and, later, Garmin data. It then **suggests** changes with a plain-language reason. It never applies a change on its own.

> **Status:** epic E1 (onboarding and first plan) is built and being deployed. It generates a one-week combined running and CrossFit plan from an onboarding form, optionally keeping the athlete's own pasted running plan unchanged, and shows it. The interface is deliberately plain; a design pass is planned (PRD 1.6, epic E1b).

## The idea

Running plans and box programming do not see each other, so the athlete holds both halves "by feel". That is how overload injuries happen. This coach looks at both disciplines together and explains why it suggests backing off or pushing, instead of showing only a readiness score.

The riskiest assumption is that an LLM coach beats a simple threshold rule. It is tested at a validation checkpoint (20 rated suggestions or 6 weeks).

## Stack and layout

React + Vite + TypeScript (Vercel) · Node + Express + TypeScript (Render) · PostgreSQL on Supabase · Anthropic SDK (`claude-sonnet-5-5`, server only) · Vitest, supertest, Playwright. Database tests run against real Postgres.

`client/` the app · `server/` the API, the coach, migrations · `shared/` the schemas and rules both sides use · `e2e/` browser tests · `evals/` the golden-set runner for the real model · `openspec/` specs and the active change · `docs/` process, decisions, epics.

## Run it locally

You need Node 22 or newer and a local Postgres.

```bash
npm ci
createdb coach_app_dev
npm run migrate:dev -w server   # applies server/migrations to coach_app_dev
npm run dev -w server           # API on :3000 with the free fake coach; restarts when you change the code
npm run dev -w client           # the app on :5173; /api is proxied to :3000
```

- **Real coach:** `COACH_MODE=real npm run dev -w server`, with `ANTHROPIC_API_KEY` in a root `.env` (git-ignored, see `.env.example`). This spends real credits.
- **Another database:** set `DEV_DATABASE_URL`. The dev scripts deliberately ignore the `DATABASE_URL` in `.env`, so a local run can never reach a production database by accident.
- **Production migrations** run in the deploy workflow with `npm run migrate -w server`, which needs `DATABASE_URL` in the environment and never reads `.env`.

Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit and component tests; a local Postgres database `coach_app_test` is needed), `npm run e2e -w e2e` (browser tests; first run `npx playwright install chromium`). The evaluations that call the real model are run by hand: `npm run evals -w evals` (`docs/workflow.md` section 9.2).

## Where things are

| What | Where |
|---|---|
| Product requirements, epics, exit criteria | [`prd-coach-app.md`](prd-coach-app.md) (epics in §7.1) |
| Development workflow, gates G0 to G5 | [`docs/workflow.md`](docs/workflow.md) |
| Why a decision was made | [`docs/decisions/`](docs/decisions/) (ADRs) |
| First epic brief | [`docs/epics/E1-onboarding-first-plan.md`](docs/epics/E1-onboarding-first-plan.md) |
| PRD history | [`docs/prd-changelog.md`](docs/prd-changelog.md) |
| What is true now (behavior specs) | `openspec/specs/` |
| Rules for AI agents working in this repo | [`CLAUDE.md`](CLAUDE.md) |

## How work happens

One **epic = one [OpenSpec](https://github.com/Fission-AI/OpenSpec) change**, named `coach-<name>`:

```
Epic brief → /opsx:new → /opsx:continue → G1 design gate (Spec PR)
→ /opsx:apply (test first) → G2/G3 per PR → /opsx:verify → G4 epic gate → /opsx:archive → G5 merge
```

The owner approves the Spec PR (G1) and every merge (G5). Everything in between runs under tests, CI, and independent review. Scope freezes once the Spec PR merges; additions are new changes.

## Secrets

`ANTHROPIC_API_KEY` and `DATABASE_URL` live in environment variables only. Nothing secret is committed.
