# Epic E1: Onboarding and first plan

**PRD:** `prd-coach-app.md` §7.1 (E1), items M2 and M3, use case UC1. **Status:** brief updated with the owner's G0 answers and two `design-reviewer` rounds; not yet through gate G0. **OpenSpec change:** `coach-onboarding-first-plan` (to be created with `/opsx:new`).

This brief is the Definition of Ready document for E1 (see `docs/workflow.md` §6). It was built from the earlier draft spec and task plan, which are now retired. Numbers marked 🔶 are proposals to adjust after the first runs.

## 1. Problem and user

Hybrid athletes (running + CrossFit) get a running plan and a box programming that never see each other, so nobody adds up the combined load. A new athlete often already follows a multi-week running plan toward a race (for example 12 weeks), and a coach has to work with it instead of replacing it. **User:** the hybrid athlete using the app for the first time who has no combined plan yet, with or without a running plan they already follow (today the author; later athletes from their box). E1 is the cold-start path (no Garmin data, PRD Principle 3); once Garmin data exists (E2, E3), plans can also use real training history, but the onboarding stays, because Garmin does not know goals, availability, or injuries.

## 2. Outcome

An athlete fills an onboarding form (optionally pasting their running plan, which may span many weeks) and gets a **one-week** plan that combines running and CrossFit, saved and shown day by day, with **no Garmin data and no login**. The plan is built one week at a time: for each following week the athlete presses "Plan next week" and the app builds that week from the saved onboarding. The plan is a proposal; nothing is applied automatically.

## 3. Requirements and scenarios

Scenario ids follow `<capability>/<requirement>/<scenario>` and will be tagged in tests. Capability ids (fixed before the Spec PR): `onboarding` (R1), `plan-generation` (R2), `running-plan-import` (R3), `plan-storage` (R4), `cost-cap` (R5), `deploy` (R6), `safety` (R7).

**R1. Onboarding validation** (the coach is not called on invalid input)
- WHEN goal, levels, and days are valid THEN the onboarding is accepted.
- WHEN the goal is empty THEN a per-field error is returned and the coach is not called.
- WHEN no CrossFit days, no running days, and no pasted plan are given THEN an error on the days fields is returned and the coach is not called.
- WHEN a running plan is pasted THEN `runningDays` is optional. WHEN a running plan is pasted and `crossfitDays` is empty THEN the onboarding is accepted and the coach adds no CrossFit sessions.
- WHEN a level is not one of beginner, intermediate, advanced, or a day is not one of mon to sun, or a day is listed twice in the same list THEN an error on that field is returned and the coach is not called.
- WHEN `injuries` is empty THEN the onboarding is accepted.
- WHEN the pasted plan is over 4,000 characters 🔶 THEN an error on that field is returned and the coach is not called.
- WHEN the request body is malformed or has an unknown shape THEN a 400 is returned and the coach is not called.
- WHEN the optional `weeklyTraining` is absent THEN the onboarding is accepted; WHEN it holds a value out of range (sessions per week outside 0 to 14 🔶, negative km) THEN an error on that field is returned and the coach is not called.
- WHEN the optional `targetEvent` is absent THEN the onboarding is accepted; WHEN its date is not a valid date, or is before today (UTC; today is allowed) THEN an error on that field is returned and the coach is not called.
- WHEN `pastedPlanWeek` is absent THEN it defaults to 1; WHEN it is not an integer from 1 to 52 🔶 THEN an error on that field is returned and the coach is not called. WHEN `pastedPlanWeek` is given without a pasted plan THEN it is ignored.

**R2. Plan generation**
- WHEN the onboarding is valid THEN a 7-day plan is returned with one entry per day.
- WHEN the coach response does not have exactly 7 distinct days (mon to sun) THEN it is rejected as invalid.
- WHEN a day has both disciplines THEN `combinedLoadNote` is non-empty.
- WHEN a session has `source: "coach"` THEN it is on a day the athlete declared available for that discipline. (Sessions from a pasted running plan are exempt: they fall on the days that plan allows; see R3.)
- WHEN the athlete gave `weeklyTraining` and there is no pasted plan THEN each discipline's weekly session count in the plan is at most the larger of 1.3 times the stated count and the stated count plus 2 🔶, and running km, when given, follows the same limit 🔶.
- WHEN the athlete gave `targetEvent` THEN it is sent to the coach, which may mention in a recommendation how many weeks remain; it adds no other rule.
- WHEN the coach errors, times out (30 s 🔶), or returns something invalid THEN no plan is saved, an error with a retry option is shown, and nothing partial exists. A retry counts toward the daily cap (R5).

**R3. Pasted running plan kept as is** (PRD Principle 5)
- WHEN a running plan is pasted THEN only the rows of week `pastedPlanWeek` are used. The plan's running sessions are exactly the sessions the coach reported reading (`understoodRunning`), unchanged, with `source: "athlete"`; the coach adds only CrossFit sessions, only on declared CrossFit days. "Unchanged" means the same description, compared by exact string equality 🔶, on a day that the paste allows. Intensity is not compared: it is the coach's own label, since pasted plans usually carry none.
- WHEN a pasted row allows several days (for example "Friday/Saturday/Sunday") THEN `understoodRunning` lists them as `dayOptions`, and the plan places the session on exactly one of them.
- WHEN the coach alters, drops, or adds a running session relative to `understoodRunning`, or places one outside its `dayOptions`, THEN the response is rejected as invalid.
- WHEN a running plan was pasted and `understoodRunning` is empty THEN the response is rejected, and the athlete is told the plan could not be read (this also covers a paste with no running sessions in it, or with no rows for the chosen week). WHEN no running plan was pasted THEN `understoodRunning` is empty and the plan contains no `source: "athlete"` sessions.
- WHEN the pasted text contains an instruction aimed at the model THEN it is still sent as delimited data, and any response that breaks the R3 rules is rejected, whatever the input says.
- WHEN the plan is shown THEN sessions with `source: "athlete"` are labeled "from your plan".
- WHEN a plan has `recommendations` THEN each is shown labeled "coach suggestion", and none changes a session: the athlete's sessions stay as pasted. The coach may suggest, for example, easing a session, but never applies it.

*Known limit:* this check compares the coach's output with the coach's own reading of the paste, so it cannot detect a misread. The only guard against a misread (risk R9) is the label above plus one manual run with the author's own plan (§6).

**R4. Persistence, reload, plan view, and next week**
- WHEN a plan passes validation THEN it is saved together with the onboarding it was made from; WHEN it does not THEN nothing is saved.
- WHEN the page is reloaded and a plan exists THEN the same plan is shown with no new coach call; WHEN none exists THEN `GET /api/plan` returns `null`.
- WHEN a plan is shown THEN the 7 days appear in order mon to sun, each with its sessions and, when present, the combined-load note; a day with no sessions is shown as a rest day. WHEN the plan came from a pasted plan THEN the week number is shown.
- WHEN a plan exists and the athlete presses "Plan next week" THEN the form is pre-filled from the saved onboarding with `pastedPlanWeek` plus 1 and the athlete can edit it; submitting goes through R1 to R5 like any other onboarding (one coach call, counted toward the cap), and nothing changes until the athlete submits.
- WHEN the athlete submits the onboarding again THEN a new plan is generated and saved, and the latest plan is the one shown (older plans stay in the table, not shown). This is also how the author starts over.

**R5. Cost protection** (there is no login)
- WHEN the daily number of coach calls reaches `MAX_COACH_CALLS_PER_DAY` (default 20 🔶) THEN `POST /api/plan` returns 429, the coach is not called, and the client shows a "daily limit reached" message with no retry.
- WHEN a coach call fails or its response is rejected by validation THEN it still counts toward the cap; WHEN a new UTC day starts THEN the count resets.
- WHEN two requests arrive at the same time with one call left THEN only one reaches the coach: the count check and the increment happen in one atomic database operation, before the coach is called 🔶.
- WHEN the last allowed call fails THEN the client shows the error and states that no retries remain today.

**R6. Deployment** (last task of the epic; E1 is built and run locally until then)
- WHEN a PR merges to `master` and CI is green THEN a GitHub Actions workflow runs in this order: migrate the database, deploy the server, deploy the client, run a smoke test against the live URLs. The providers' own auto-deploy is disabled, and a red CI never deploys.
- WHEN the migration or the smoke test fails THEN the workflow stops, the client is not deployed (or, after the server deploy, the failure is reported on the commit).
- WHEN deployed THEN `GET /health` returns `{"status":"ok"}` and the full flow works from the live client URL.
- WHEN the server has been idle and a request has had no response after 3 s 🔶 THEN the client shows a "waking up the coach" state, and its request timeout exceeds the coach's 30 s 🔶.
- WHEN built THEN no secret appears in the repo or the client bundle; CORS allows only the client origin.

**R7. Pain and injury safety** (PRD Principle 6, UC4; decided at G0)
- The coach decides whether `injuries` (or any other text field) reports a current pain, symptoms, or an injury, and reports it as `painReported: true` in its response. Text that is ambiguous or mixes past and current issues (for example "old knee issue, sore today") counts as current.
- WHEN the coach reports `painReported: true` THEN `safetyNote` is non-null: it says plainly that the coach is not a clinician, does not diagnose or name a likely injury, and recommends seeing a qualified professional; the plan does not propose training through the pain; and, when a running plan was pasted, it says those sessions are the athlete's own plan and should be checked with the professional. A response with `painReported: true` and a null `safetyNote` is rejected as invalid (tested with the fake coach).
- WHEN `painReported` is false THEN `safetyNote` is null.
- *Prompt requirement, not a runtime check:* the coach must not diagnose or name a likely injury, and must not propose training through pain. This is verified by the evaluation scenarios (§6), which run locally against the real model.

## 4. Out of scope

Garmin (E2); load model, suggestions, plan view with history, and validation-checkpoint logging (E3 to E6); login, multiple athletes, per-athlete quotas, bring-your-own key, billing (E7 and later); changing or adapting the athlete's pasted plan; adjusting a plan from actual training load; pasting the box's CrossFit programming; file upload (the paste is text, for example copied from a spreadsheet); a confirm-or-correct step on how the plan was read; plans longer than one week, or generating weeks ahead of time or automatically; manual plan editing; regenerating the same week with feedback; weight, age, sleep, stress, and a PAR-Q screen (revisit with the load model, E3); an adaptive, model-written questionnaire (a fixed form is used).

## 5. Design inputs (to be refined in `design.md`)

**Stack (PRD §13):** React + Vite + TypeScript (client, Vercel); Node + Express + TypeScript (server, Render); PostgreSQL on Supabase via `DATABASE_URL` and `pg`; Anthropic SDK, model `claude-sonnet-5-5`, server-side only; Vitest in both packages, supertest, `pg-mem`. Layout: `client/` and `server/`.

**Architecture:** form (client) → `POST /api/plan` → onboarding validator (pure function) → coach client (injected dependency) → plan validator → store (Postgres) → plan view. `GET /api/plan` returns the latest saved plan or `null`. "Plan next week" is a client convenience over the same endpoint.

**Contract:**

```ts
Onboarding = { goal: string, runningLevel: Level, crossfitLevel: Level, injuries: string,
               runningDays: Day[], crossfitDays: Day[], existingRunningPlan: string | null,
               pastedPlanWeek: number | null,                      // default 1; only with a pasted plan
               weeklyTraining: { runningSessions: number, crossfitSessions: number, runningKm: number | null } | null,
               targetEvent: { name: string, date: string } | null }   // date: ISO yyyy-mm-dd, UTC
Session   = { discipline: "running" | "crossfit", description: string,
              intensity: "easy" | "moderate" | "hard", source: "athlete" | "coach" }   // intensity is the coach's label
Plan      = { days: [{ day: Day, sessions: Session[], combinedLoadNote: string | null }],  // exactly 7
              recommendations: string[], safetyNote: string | null }
CoachResponse = { understoodRunning: { dayOptions: Day[], description: string }[],
                  painReported: boolean, plan: Plan }
// Level = beginner | intermediate | advanced; Day = mon..sun
```

**Tables:** `plans(id, plan jsonb, onboarding jsonb, created_at)` and `coach_calls(id, called_at)`.

**Constraints:** secrets only on the server; injuries are health data, so send the model only what it needs and keep the database off any public API; the pasted plan is untrusted text, sent as delimited data to a model with no tools, and its output is accepted only after schema and R3 validation. With no login, `GET /api/plan` is open to anyone who has the URL and returns the latest plan including the safety note and the saved onboarding: accepted risk for E1, mitigated by keeping the deployed URL private (PRD R11), and revisited with E7.

**Greenfield note:** this repo has no code yet, so the first task of the change scaffolds the server with a passing test before anything else (see `CLAUDE.md` learnings).

## 6. Test strategy

- Vitest in `server/` and `client/`; supertest for the API; `pg-mem` for the store; a **fake coach client** everywhere, so no test calls the real API.
- Every scenario above gets a test tagged `@spec(<id>)`.
- Required unit cases include: valid onboarding with both disciplines on one day; missing goal; no day; invalid level, invalid or duplicate day, malformed body; over-length paste; optional fields absent and out of range; a model response with 6 days or duplicate days; a session on an unavailable day; a response that alters, drops, or adds a running session or places one outside its `dayOptions`; a paste with several weeks and flexible days; a paste that contains an instruction aimed at the model, with a fake coach that obeys it and breaks the R3 rules; `painReported: true` with a null `safetyNote`; a network failure in the client; the cap reached, reset, and two concurrent requests with one call left; a response rejected by validation counting toward the cap; "Plan next week" pre-filling `pastedPlanWeek` plus 1.
- **Evaluation scenarios for E1** (PRD §8.3, run locally against the real model with the default of 1 repeat; see `docs/workflow.md` §9.2). The first three feed the golden set:
  1. A clean pasted running plan: its sessions come back unchanged (check 6, 100%).
  2. A messy pasted plan (mixed formats, abbreviations, flexible days such as "Friday/Saturday/Sunday", several weeks): the chosen week is read correctly, nothing invented or dropped. The author's own plan is the model for this case.
  3. A pasted plan containing an instruction aimed at the model: ignored; R3 still holds.
  4. No pasted plan: the coach adds only sessions on declared days and a combined-load note when both disciplines share a day.
  5. An injuries note describing current pain, and a mixed note ("old knee issue, sore today"): `painReported` true, `safetyNote` set, no diagnosis, no training through the pain (check 4, 100%).
  6. A pasted plan plus a current pain report: the pasted sessions stay unchanged, and `safetyNote` mentions them.
- **Manual check:** one run against the real API with the author's own running plan confirms the model reads a messy plan correctly. This is the only guard against a misread paste (R9).
- Limit for E1: the golden set stays small; the full set of about 30 scenarios arrives with E4.

## 7. Risks (PRD §11)

R5 (health data), R6 (LLM cost and outages), R7 (free-tier cold starts and pausing), R9 (misread pasted plan; see the known limit in R3), R11 (open endpoint can spend credits and exposes the latest plan to anyone with the URL).

## 8. Dependencies

No other epic. The owner creates these accounts by hand (manual), and the deploy task (R6) is blocked until they exist: Vercel, Render, Supabase, and a spend limit on the Anthropic account.

## 9. Things to verify during the epic

- Model id `claude-sonnet-5-5` is available to the account, and whether the SDK's structured output is usable (fallback: ask for JSON and validate it).
- `pg-mem` supports the `jsonb` and `timestamptz` usage (fallback: a local Postgres, which also means a Postgres service container in the CI workflow).
- A Render free service can reach Supabase Postgres (connection string type, SSL).
- Node version compatibility with Express, Vite, and Vitest.
- Free-tier limits (read from the providers' docs on 2026-11-01; they change often): Render free web services spin down after 15 minutes and take about a minute to wake; Supabase free projects pause after a week idle; Vercel Hobby is non-commercial only.
- How a spreadsheet copied as text (tab-separated Week, Day, Training rows) arrives in the paste field, using the author's own plan.

## 10. Decisions at gate G0 (owner, 2026-11-07)

- **Minimum onboarding answers:** goal, both levels, and at least one training day or a pasted plan are required. Optional: `weeklyTraining`, `targetEvent`, and `pastedPlanWeek`. Injuries stay free text. Weight, age, sleep, stress, and a PAR-Q screen are out of scope for E1. The form is fixed, not model-written.
- **View:** one combined view per day.
- **Principle 6 in the first prompt:** yes. R7 and evaluation scenarios 5 and 6 cover it in E1.
- **Daily cap:** 20 per day is accepted as the default 🔶.
- **Plan horizon:** one detailed week at a time, built from the saved onboarding and the athlete's pasted multi-week plan; the athlete asks for each next week ("Plan next week"). The pasted plan stays as is; the coach may add non-binding recommendations. A longer horizon or automatic weeks can be a later change if needed.
- **Left to `design.md`, not blocking G0:** the default `pastedPlanWeek` derived from the race date (weeks remaining); the prompt wording for `safetyNote` and `recommendations`; how the volume rule applies when `runningKm` is null.
