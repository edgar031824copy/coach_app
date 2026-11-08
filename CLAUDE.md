# coach_app: Virtual Hybrid Coach

A coach for hybrid athletes (running + CrossFit). It builds a combined training plan from an onboarding intake and, later, Garmin data, then **suggests** changes with a plain-language reason. It never applies a change on its own.

- Product source of truth: `prd-coach-app.md`. Epics, their order, and exit criteria are in PRD §7.1. Read it before defining any epic.
- Full development workflow (flow, gates, hooks, reviewers): `docs/workflow.md`. This file is the short version. Read that file when defining an epic, opening a Spec PR, running a gate, or changing the harness; do not load it for ordinary coding tasks.

## Status

- Harness: **partly built.** Built: CI, branch protection, reviewer agents, hooks and deny rules (`.claude/settings.json`), `scripts/phase`, `scripts/trace`. Still planned: `deploy.yml`, `e2e/`, `evals/` (status legend in `docs/workflow.md`).
- Code: not scaffolded. The first task of epic E1 creates the project.
- Active change: `coach-onboarding-first-plan` (E1), approved; state in `docs/.phase`.
- Epic briefs live in `docs/epics/`. E1's brief (`docs/epics/E1-onboarding-first-plan.md`) is drafted and waits for gate G0. The earlier course-style spec and task files were folded into it and removed.

## Stack (decided, see PRD §13)

React + Vite + TypeScript (client, Vercel) · Node + Express + TypeScript (server, Render) · PostgreSQL on Supabase · Anthropic SDK (`claude-sonnet-5-5`) on the server only · Vitest, supertest, `pg-mem`.
Layout: `client/`, `server/`, `openspec/`, `docs/`. Commands will be listed here once the project exists.

## The flow in one screen

One **epic = one OpenSpec change**, on the **expanded path**:

```
Epic brief (docs/epics/) → /opsx:new → /opsx:continue (one artifact at a time) → G1 design gate
→ /opsx:apply (test-first, in PRs) → G2/G3 per PR → /opsx:verify → G4 epic gate → /opsx:archive → G5 merge
```

Gates G0 to G5 are defined in `docs/workflow.md` (section 5). The human approves **G1** (the Spec PR: proposal, specs, design, tasks) and **G5** (every merge). Everything between runs under hard checks (tests, CI) and an independent review.

## Rules that have no exceptions

1. **Naming.** Every change is named `coach-<name>`, with an `epic: En` tag in its `.openspec.yaml`.
2. **Scope freezes at approval.** After the Spec PR merges, `proposal.md`, `design.md`, and `specs/` of that change are not edited. Anything that needs a spec or design edit, anything new, and any fix to archived behavior is a **new change** with its own artifacts.
   - Inside an open change, fixing a defect in code you are writing to satisfy the approved scenarios is normal work.
   - Only typos and obvious compile errors may be fixed without ceremony.
3. **`openspec/specs/` is never edited by hand.** It changes only through sync or archive.
4. **No "done" without a passing check.** A task is done when its tests run and pass, not when a box is ticked. Every spec scenario needs a test tagged with its id (format in `docs/workflow.md`).
5. **Test first** when applying a change (use the superpowers `test-driven-development` skill).
6. **Suggestions only.** The product never auto-applies plan changes (PRD Principle 1). Do not write code that does.
7. **No secrets in the repo.** `ANTHROPIC_API_KEY` and `DATABASE_URL` live in environment variables only.

## Skill precedence

OpenSpec owns the flow. Use superpowers only for discipline inside `/opsx:apply`: `test-driven-development`, `verification-before-completion`, `requesting-code-review`. Do **not** use superpowers `brainstorming`, `writing-plans`, or `executing-plans` for epic work; they duplicate OpenSpec's explore, propose, and tasks. This file takes precedence over any skill.

## Permissions

The owner switches between auto mode and manual approval. In either mode, never without the owner's explicit approval: merging a PR, pushing to `master`, deploying, changing branch protection, or touching secrets.

## Memory and state

Start each task from `docs/.phase` and the active change, not from chat history; `/clear` between tasks (token rules: `docs/workflow.md` §17). No separate memory files. Why a decision was made: `docs/decisions/` (immutable once accepted; change rules in `docs/workflow.md` §7.2). What is true now: `openspec/specs/`. Why and how: the change folder. Where we are: `docs/.phase`. Stable rules and learnings: this file (add lessons under a "Learnings" heading as they appear).

## Learnings

- Default OpenSpec generation assumes scaffolding exists. This repo is greenfield, so each early change must include scaffolding tasks and `openspec/config.yaml` context must say so.
