# Spec review: first hybrid plan from onboarding (with the athlete's own running plan)

Evaluated with `skills/evaluate-spec/SKILL.md` (course repo). Spec: [`docs/spec-rebanada.md`](spec-rebanada.md). Source: [`prd-coach-app.md`](../prd-coach-app.md). No `design.md`, `AGENTS.md`, or `README.md` were found: the project code does not exist yet beyond these documents.

## 1. Grade per wave

| Wave | Grade | Justification |
|---|---|---|
| Wave 1: initial plan from onboarding (M3 + minimum of M2) | **B** | All critical criteria are met except T2 (test cases), which is partial and closes with a written assumption; the other gaps are non-critical. |

## 2. Recommendation

Plan Wave 1 now. There are no other waves in this evaluation: PRD items M1, M4, M5, and M6 (Garmin, load comparison, suggestions, weekly view) are outside the slice and will need their own spec and evaluation.

## 3. Table per lens

(*) = critical.

### Product

| Criterion | Status | Evidence | Minimal fix |
|---|---|---|---|
| P1 (*) Problem and user | Met | Spec §1 and §2 | — |
| P2 (*) Scope | Met | Spec §3, steps 1 to 6 | — |
| P3 (*) Out of scope | Met | Spec §5 (lists Garmin, suggestions, history, login, etc.) | — |
| P4 (*) Business rules | Met | Spec §3, R1 to R4 (R4: the pasted running plan is never changed, concerns appear only as notes); no contradictions with the PRD (Principles 1, 2, and 3) | — |
| P5 Success criterion | Met | Spec §4 (3 criteria); PRD §9 (metrics) for the validation phase | — |
| P6 Pending decisions | Met | Spec §6, "Open questions" (3 questions) | — |

### TDD

| Criterion | Status | Evidence | Minimal fix |
|---|---|---|---|
| T1 (*) Observable acceptance | Met | Spec §4: each criterion describes a visible or checkable result (plan on screen, per-field error, nothing saved) | — |
| T2 (*) Test cases | **Partial** | Spec §4 covers three paths (generation without a pasted plan, a pasted plan kept as is, bad input or coach failure), but doesn't fix concrete input data or the edges (exactly 7 days, a day with both disciplines, a model response with a day outside the available ones, a pasted plan the coach alters, an empty or unreadable paste) | Assumption S1 (below) |
| T3 Runner and command | **Partial** | Spec §6 declares Vitest in both packages (`npm test` inside `server/` and `client/`) and `pg-mem` for the store, but the projects don't exist yet, so the commands haven't been run | Assumption S2 |
| T4 TDD declaration | N/A | The spec doesn't declare TDD as a team practice; it only declares the runner | — |

### Design

| Criterion | Status | Evidence | Minimal fix |
|---|---|---|---|
| D1 (*) Architecture | Met | Spec §6, "Minimal architecture" (form in `client/`, validator, coach client, and Postgres store in `server/`) and the stack bullets (React/Vite, Express, Postgres on Supabase) | — |
| D2 Contracts | Met | Spec §6, "Plan contract" (`Onboarding` and `Plan` types) | — |
| D3 design.md | Missing (low impact) | No `design.md` exists; the UI is a single page with a form and a 7-day list | Minimal styling is enough; doesn't block |
| D4 Constraints | Met | Spec §6, "Constraints" and "Deployment choices and their known limits": secrets server-side only, health data not publicly readable, CORS limited to `CLIENT_ORIGIN`, daily cap on coach calls because there is no login, 30 s coach timeout, Render cold start and Supabase pause handled | — |

## 4. Cross-artifact coherence

- No contradictions between the spec and the PRD: R1 and R3 implement PRD Principles 3 and 1, and the PRD already marks M3 as "with or without Garmin history".
- The PRD leaves the stack undecided ("new repo, new session"); the spec decides it (React + Vite, Express, Postgres on Supabase; Vercel and Render for hosting). This is a new decision made by the spec, not a contradiction. It should be copied into the PRD when it is next updated.
- The free-tier limits in spec §6 come from the providers' own docs, read on 2026-11-01 (Render free web services spin down after 15 minutes and wake in about a minute; Supabase free projects pause after a week idle; Vercel Hobby is non-commercial only). They change often; re-check before the demo.
- **Verify** (technical dependencies the spec takes for granted, with no source checked in this evaluation):
  - That the model identifier `claude-sonnet-5-5` is available to the athlete's account.
  - That the Anthropic SDK supports the structured output we intend to use. If not, the fallback is to ask for JSON and validate it with the schema; criterion 3 already covers that path.
  - That `pg-mem` supports the `jsonb` and `timestamptz` usage in the `plans` table. If not, test the store against a local Postgres.
  - That a Render free service can reach Supabase Postgres (connection string type, SSL) from its region.
  - That the installed Node version works with the chosen Express, Vite, and Vitest versions.
  - Whether a keep-warm pinger is acceptable under Render's terms (optional, not required by the spec).
  - Whether the model reliably reads messy pasted plans into `understoodRunning` and keeps them unchanged. This can only be checked by trying real pasted plans (the author's own) during task 3's manual check; the code-level R4 check rejects failures but cannot make the model succeed.
- References outside the repo: none. The PRD is at `../prd-coach-app.md`, inside the same repo.

## 5. The three most serious gaps

1. **T2: test cases without concrete data.** Without fixed inputs, two different agents could write different tests for the same criterion. It is the only partial critical criterion.
2. **T3: the test commands haven't been run.** Until task 1 creates `server/` (and task 5 creates `client/`), `npm test` is an intention. Low risk, but it is exactly what those tasks must demonstrate.
3. **D3: no `design.md`.** Low impact for a single page, but any UI task decides the styling by eye.

## 6. Proposed assumptions (pending approval)

- **S1.** Concrete test cases are written in the plan's tasks, not in the spec. Minimum required: a valid onboarding with both disciplines on the same day (must produce `combinedLoadNote`), onboarding without a goal, onboarding with no available day, a pasted plan over 4,000 characters, a model response with 6 days, a model response with a session on an unavailable day, a model response that alters, drops, or adds a running session relative to `understoodRunning`, a paste containing an instruction aimed at the model, and a network failure in the client. **Pending approval.**
- **S4.** "Read exactly as understood" means the coach's own reading (`understoodRunning`) is what is checked in code. Whether that reading matches the athlete's text is judged by the athlete from the "from your plan" labels and is not tested automatically; a confirm-or-correct step is out of scope. **Pending approval.**
- **S2.** Task 1 verifies that `npm test` runs and passes in `server/`, and task 5 does the same for `client/`; if either fails, the spec is corrected before continuing. **Pending approval.**
- **S3.** There is no `design.md` in this slice; the UI uses default styles. **Pending approval.**
