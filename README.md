# coach_app: Virtual Hybrid Coach

A virtual coach for hybrid athletes (running + CrossFit). It builds a combined training plan from an onboarding intake and, later, Garmin data. It then **suggests** changes with a plain-language reason. It never applies a change on its own.

> **Status:** pre-build. The product is specified and the process is designed, but no application code exists yet. Epic E1 creates the project.

## The idea

Running plans and box programming do not see each other, so the athlete holds both halves "by feel". That is how overload injuries happen. This coach looks at both disciplines together and explains why it suggests backing off or pushing, instead of showing only a readiness score.

The riskiest assumption is that an LLM coach beats a simple threshold rule. It is tested at a validation checkpoint (20 rated suggestions or 6 weeks).

## Planned stack

React + Vite + TypeScript (Vercel) · Node + Express + TypeScript (Render) · PostgreSQL on Supabase · Anthropic SDK (`claude-sonnet-5-5`, server only) · Vitest, supertest, `pg-mem`.

Planned layout: `client/`, `server/`, `openspec/`, `docs/`. Run and test commands will be added here once the project exists.

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
