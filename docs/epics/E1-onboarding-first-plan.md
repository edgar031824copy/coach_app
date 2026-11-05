# Epic E1: Onboarding and first plan

**PRD:** `prd-coach-app.md` §7.1 (E1), items M2 and M3, use case UC1. **Status:** brief drafted, not yet through gate G0. **OpenSpec change:** `coach-onboarding-first-plan` (to be created with `/opsx:new`).

This brief is the Definition of Ready document for E1 (see `docs/workflow.md` §6). It was built from the earlier draft spec and task plan, which are now retired.

## 1. Problem and user

Hybrid athletes (running + CrossFit) get a running plan and a box programming that never see each other, so nobody adds up the combined load. A new athlete often already follows a running plan, and a coach has to work with it instead of replacing it. **User:** the hybrid athlete using the app for the first time who has no combined plan yet, with or without a running plan they already follow (today the author; later athletes from their box).

## 2. Outcome

An athlete fills an onboarding form (optionally pasting their running plan) and gets a one-week plan that combines running and CrossFit, saved and shown day by day, with **no Garmin data and no login**. The plan is a proposal; nothing is applied automatically.

## 3. Requirements and scenarios

Scenario ids follow `<capability>/<requirement>/<scenario>` and will be tagged in tests.

**R1. Onboarding validation** (the coach is not called on invalid input)
- WHEN goal, levels, and days are valid THEN the onboarding is accepted.
- WHEN the goal is empty THEN a per-field error is returned and the coach is not called.
- WHEN no CrossFit days, no running days, and no pasted plan are given THEN an error on the days fields is returned and the coach is not called.
- WHEN a running plan is pasted THEN `runningDays` is optional.
- WHEN the pasted plan is over 4,000 characters THEN an error on that field is returned and the coach is not called.

**R2. Plan generation without a pasted plan**
- WHEN the onboarding is valid THEN a 7-day plan is returned with one entry per day.
- WHEN a day has both disciplines THEN `combinedLoadNote` is non-empty.
- WHEN a session has `source: "coach"` THEN it is on a day the athlete declared available for that discipline. (Sessions from a pasted running plan are exempt: they fall on whatever days that plan says; see R3.)
- WHEN the coach errors, times out (30 s), or returns something invalid THEN no plan is saved, an error with a retry option is shown, and nothing partial exists.

**R3. Pasted running plan kept as is** (PRD Principle 5)
- WHEN a running plan is pasted THEN the plan's running sessions are exactly the sessions the coach reported reading (`understoodRunning`), unchanged, with `source: "athlete"`; the coach adds only CrossFit sessions, only on declared CrossFit days.
- WHEN the coach alters, drops, or adds a running session relative to `understoodRunning` THEN the response is rejected as invalid.
- WHEN a running plan was pasted and `understoodRunning` is empty THEN the response is rejected. WHEN no running plan was pasted THEN `understoodRunning` is empty and the plan contains no `source: "athlete"` sessions.
- WHEN the pasted text contains an instruction aimed at the model THEN it is still sent as delimited data, and any response that breaks the R3 rules (a running session altered, dropped, or added, or a coach session on an undeclared day) is rejected, whatever the input says.
- WHEN the plan is shown THEN sessions with `source: "athlete"` are labeled "from your plan".

**R4. Persistence and reload**
- WHEN a plan passes validation THEN it is saved; WHEN it does not THEN nothing is saved.
- WHEN the page is reloaded and a plan exists THEN the same plan is shown with no new coach call; WHEN none exists THEN `GET /api/plan` returns `null`.

**R5. Cost protection** (there is no login)
- WHEN the daily number of coach calls reaches `MAX_COACH_CALLS_PER_DAY` (default 20) THEN `POST /api/plan` returns 429, the coach is not called, and the client shows a "daily limit reached" message with no retry.
- WHEN a coach call fails THEN it still counts toward the cap; WHEN a new UTC day starts THEN the count resets.

**R6. Deployment** (last task of the epic; E1 is built and run locally until then)
- WHEN a PR merges to `master` and CI is green THEN a GitHub Actions workflow runs in this order: migrate the database, deploy the server, deploy the client, run a smoke test against the live URLs. The providers' own auto-deploy is disabled, and a red CI never deploys.
- WHEN deployed THEN `GET /health` returns `{"status":"ok"}` and the full flow works from the live client URL.
- WHEN the server has been idle THEN the client shows a "waking up the coach" state and its request timeout exceeds the coach's 30 s.
- WHEN built THEN no secret appears in the repo or the client bundle; CORS allows only the client origin.

## 4. Out of scope

Garmin (E2); load model, suggestions, plan view, and validation-checkpoint logging (E3 to E6); login, multiple athletes, per-athlete quotas, bring-your-own key, billing (E7 and later); changing or adapting the athlete's pasted plan; pasting the box's CrossFit programming; file upload; a confirm-or-correct step on how the plan was read; plans longer than one week; manual plan editing; regenerating the plan.

## 5. Design inputs (to be refined in `design.md`)

**Stack (PRD §13):** React + Vite + TypeScript (client, Vercel); Node + Express + TypeScript (server, Render); PostgreSQL on Supabase via `DATABASE_URL` and `pg`; Anthropic SDK, model `claude-sonnet-5-5`, server-side only; Vitest in both packages, supertest, `pg-mem`. Layout: `client/` and `server/`.

**Architecture:** form (client) → `POST /api/plan` → onboarding validator (pure function) → coach client (injected dependency) → plan validator → store (Postgres) → plan view. `GET /api/plan` returns the latest saved plan or `null`.

**Contract:**

```ts
Onboarding = { goal: string, runningLevel: Level, crossfitLevel: Level, injuries: string,
               runningDays: Day[], crossfitDays: Day[], existingRunningPlan: string | null }
Session   = { discipline: "running" | "crossfit", description: string,
              intensity: "easy" | "moderate" | "hard", source: "athlete" | "coach" }
Plan      = { days: [{ day: Day, sessions: Session[], combinedLoadNote: string | null }] }  // exactly 7
CoachResponse = { understoodRunning: { day: Day, description: string, intensity: ... }[], plan: Plan }
// Level = beginner | intermediate | advanced; Day = mon..sun
```

**Tables:** `plans(id, plan jsonb, created_at)` and `coach_calls(id, called_at)`.

**Constraints:** secrets only on the server; injuries are health data, so send the model only what it needs and keep the database off any public API; the pasted plan is untrusted text, sent as delimited data to a model with no tools, and its output is accepted only after schema and R3 validation.

**Greenfield note:** this repo has no code yet, so the first task of the change scaffolds the server with a passing test before anything else (see `CLAUDE.md` learnings).

## 6. Test strategy

- Vitest in `server/` and `client/`; supertest for the API; `pg-mem` for the store; a **fake coach client** everywhere, so no test calls the real API.
- Every scenario above gets a test tagged `@spec(<id>)`.
- Required unit cases include: valid onboarding with both disciplines on one day; missing goal; no day; over-length paste; a model response with 6 days; a session on an unavailable day; a response that alters, drops, or adds a running session; a paste that contains an instruction aimed at the model, with a fake coach that obeys it and breaks the R3 rules; a network failure in the client; the cap reached and reset.
- **AI behavior check for E1** (PRD §8.3, check 6): with a pasted running plan, its running sessions come back unchanged. One manual run against the real API with the author's own running plan confirms the model reads a messy plan correctly.

## 7. Risks (PRD §11)

R5 (health data), R6 (LLM cost and outages), R7 (free-tier cold starts and pausing), R9 (misread pasted plan), R11 (open endpoint can spend credits).

## 8. Dependencies

None. Accounts to be created by the owner (manual): Vercel, Render, Supabase, and a spend limit on the Anthropic account.

## 9. Things to verify during the epic

- Model id `claude-sonnet-5-5` is available to the account, and whether the SDK's structured output is usable (fallback: ask for JSON and validate it).
- `pg-mem` supports the `jsonb` and `timestamptz` usage (fallback: a local Postgres).
- A Render free service can reach Supabase Postgres (connection string type, SSL).
- Node version compatibility with Express, Vite, and Vitest.
- Free-tier limits (read from the providers' docs on 2026-11-01; they change often): Render free web services spin down after 15 minutes and take about a minute to wake; Supabase free projects pause after a week idle; Vercel Hobby is non-commercial only.

## 10. Open questions for gate G0

- Minimum onboarding answers to generate a plan. Proposed: goal plus at least one available day.
- One combined view per day, or one view per discipline. Proposed: one combined view.
- Should E1's coach prompt already carry the PRD Principle 6 rule (no diagnosis; refer pain to a professional)? Proposed: yes, with its evaluation scenarios in E4.
- Default daily cap of 20 coach calls: acceptable?
