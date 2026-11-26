# coach_app: Virtual Hybrid Coach

A coach for hybrid athletes (running + CrossFit). It builds a combined training plan from an onboarding intake and, later, Garmin data, then **suggests** changes with a plain-language reason. It never applies a change on its own.

- Product source of truth: `prd-coach-app.md`. Epics, their order, and exit criteria are in PRD §7.1. Read it before defining any epic.
- Full development workflow (flow, gates, hooks, reviewers): `docs/workflow.md`. This file is the short version. Read that file when defining an epic, opening a Spec PR, running a gate, or changing the harness; do not load it for ordinary coding tasks.

## Status

- Harness: **built.** CI, branch protection, reviewer agents, hooks and deny rules (`.claude/settings.json`), `scripts/phase`, `scripts/trace`, the deploy workflow (`.github/workflows/deploy.yml`), Playwright `e2e/` and the `evals/` runner (status legend in `docs/workflow.md`).
- Code: epic E1 (`coach-onboarding-first-plan`), epic E1b (`coach-ui-foundation`, the UI foundation: two views, plan view, form, design system) and the follow-up change `coach-plan-week-and-delete` (every plan has a week; delete a plan; `epic: E1b`) are built, deployed and archived (PRD 1.8 on `master`). Their requirements are in `openspec/specs/` (15 capabilities); the design system is documented in `docs/design-system.md`, the manual checks in `docs/e1b-manual-checks.md` and `docs/plan-week-and-delete-manual-checks.md`.
- Active change: none. Next: a small follow-up change (no new epic, `epic: E1b`) that makes the stored plans visible and consistent: the owner found deleting confusing because several plans are stored but only the newest shows. Direction discussed: one plan per calendar week (rebuilding a week replaces it, with a warning; a migration merges today's duplicates, which needs the owner's approval) plus a way to see and move between the stored weeks. Then E1c (plan quality) and the spikes X1 and X2. State in `docs/.phase`.
- Epic briefs live in `docs/epics/`. Each epic's brief passes G0 before its change starts.

## Stack (decided, see PRD §13)

React + Vite + TypeScript (client, Vercel) · Node + Express + TypeScript (server, Render) · PostgreSQL on Supabase · Anthropic SDK (`claude-sonnet-5-5`) on the server only · Vitest, supertest, `pg-mem`.
Layout: `client/`, `server/`, `shared/` (Zod schemas and the onboarding validation both sides use), `e2e/` (Playwright), `evals/` (real-model checks), `scripts/`, `openspec/`, `docs/`.
Commands (from the repo root): `npm run typecheck`, `npm run lint`, `npm test`, `npm run e2e -w e2e`. Local server: `npm run dev -w server` (fake coach, local database); migrations: `npm run migrate:dev -w server`. Real-model checks, run by the owner and never in CI: `npm run evals -w evals`, `npm run plan-check -w server`. Details: `README.md`.

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
- The repository is public, so CI logs are public. Scripts and workflows print step names, status words and codes only, never a URL, host, header, key or response body. Live URLs, keys and the database string are GitHub secrets.
- The root `.env` holds production values. Do not run a script that loads it unless the owner asks; local `dev` and `migrate:dev` use a local database and the fake coach on purpose.
- Never write the owner's personal training data (their own plan, sessions, paces) into the repo, a PR or a test. A made-up key in a test needs `gitleaks:allow` on its line, or the secret scan fails.
- For hosting setup, write down the order up front: the server address and the client address depend on each other, so create both projects first, then set each side's variables.
- Layout and focus bugs are invisible to jsdom tests. Look at the real page (screenshot or Playwright with touch emulation) and let Playwright measure sizes and tab through the ring. E1b found, that way, a missing reset, 37 px day buttons and no focus ring on inputs.
- Tailwind 4: never use `outline-none` with `focus-visible:outline-2` (it sets the outline style to none and no ring is drawn); a unit test forbids it.
- Before starting the next branch, check that the previous PR is really merged (`gh pr view <n>`), not only that the owner said so.
- Local development needs its own database: `createdb coach_app_dev` then `npm run migrate:dev -w server` (README). Without it the dev server answers a generic 500.
