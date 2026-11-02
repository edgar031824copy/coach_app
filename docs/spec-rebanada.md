# Minimal slice spec: first hybrid plan from onboarding (with the athlete's own running plan)

Source PRD: [`prd-coach-app.md`](../prd-coach-app.md) (slice = M3, plus the minimum of M2 needed to feed it).

## 1. Problem

Hybrid athletes (running + CrossFit) get a running plan and a box programming that never see each other, so nobody adds up the combined load and overload risk goes unnoticed. On top of that, starting with a coach shouldn't require a data history that a new athlete doesn't have, and many athletes already follow a running plan from a coach or club that a new tool must respect instead of replacing.

## 2. User

The hybrid athlete using the app for the first time who doesn't have a combined plan yet, with or without a running plan they already follow (today: the author, who trains running and CrossFit on the same day; later, athletes from their box).

## 3. The flow, step by step

1. The athlete opens the app and sees the onboarding form (no login; a single athlete).
2. They fill in: goal (free text), current level in running and in CrossFit (beginner / intermediate / advanced), injuries or limitations (free text, optional), the days of the week available for CrossFit, the days available for running, and, optionally, their **existing running plan** pasted as text.
3. They submit the form.
4. The system validates the answers and asks the coach (Anthropic API) for a **one-week** plan that combines running and CrossFit, balancing load across both disciplines, without using any Garmin data. If an existing running plan was pasted, the coach reads it and builds the CrossFit side around it; if not, the coach plans both disciplines.
5. The system validates the coach's response, saves the plan, and shows it day by day. Each session shows discipline, description, and intensity. Sessions that come from the athlete's pasted plan are labeled "from your plan" and appear exactly as understood, so the athlete can see what the coach read. Days with both disciplines carry a plain-language combined-load note, which is also where the coach flags any concern about the load the athlete's plan creates.
6. If the athlete reloads the page, they see the same saved plan, with no new coach call.

Flow rules:

- R1. Garmin or any other external data is never required: the plan is generated from onboarding alone.
- R2. Without a pasted running plan, sessions are only scheduled on the days the athlete declared available for that discipline. With one, the running sessions are the athlete's own (on whatever days that plan says) and `runningDays` is not required; CrossFit sessions only go on the declared CrossFit days.
- R3. The plan is a proposal that is displayed; this slice never modifies or re-applies anything automatically.
- R4. A pasted running plan is never changed: the plan's running sessions are exactly the sessions the coach read from it, and the coach adds only CrossFit sessions and notes. Concerns about the athlete's plan appear as notes, never as edits.

## 4. Acceptance criteria

- [ ] **Plan generated and saved.** Given a valid onboarding with no pasted running plan and no Garmin data, submitting shows a 7-day plan whose sessions fall only on the available days of each discipline (R2), every day with both disciplines has a non-empty combined-load note, and reloading the page shows the same plan without a second coach call.
- [ ] **Existing running plan kept as is.** Given a valid onboarding with a pasted running plan, the shown plan contains exactly the running sessions the coach read from it, unchanged and labeled "from your plan" (R4), plus CrossFit sessions only on the available CrossFit days, with a non-empty combined-load note on every day that has both disciplines. If the coach's plan alters, drops, or adds running sessions relative to what it read, the response is rejected.
- [ ] **Bad input or coach failure never produces a plan.** If the goal is missing, no day is available (no CrossFit days, no running days, and no pasted plan), or the pasted plan is over 4,000 characters, the form shows a per-field error, the coach is not called, and nothing is saved. If the coach call fails (error or timeout) or returns something that doesn't match the plan format or R4, an error message with a retry option is shown and no plan is saved.

## 5. Out of scope

- Garmin: OAuth, sync, and load or recovery metrics (M1, M4).
- Adjustment suggestions, comparing actual load against the plan, and accept/modify/ignore (M4, M5).
- Actual-vs-planned week view and plan history (M6, S1).
- Adaptive onboarding with follow-up questions; here the form is fixed.
- Plans longer than one week, manual plan editing, regenerating the plan.
- Changing or adapting the athlete's pasted running plan (later, only as a suggestion the athlete can accept); pasting the box's CrossFit programming; file upload (PDF, spreadsheet, image) of a plan; a confirm-or-correct step on how the plan was read.
- Login and social sign-in, multiple athletes, per-athlete usage quotas or credits, bring-your-own API key, box/dashboard, payments, nutrition, other wearables (see PRD S4, S5, C8, C3). The app uses the author's own API key, limited by a daily cap.

## 6. Technical decisions

Decided for this slice (can change before Monday):

- **Frontend:** React + TypeScript, built with Vite, one page with the form and the plan. Deployed on Vercel (Hobby plan, non-commercial use only).
- **Backend:** Node + Express + TypeScript, exposing `POST /api/plan`, `GET /api/plan`, and `GET /health`. Deployed on Render (free web service).
- **Database:** PostgreSQL on Supabase (free plan), used as a plain Postgres through `DATABASE_URL` and the `pg` driver; no Supabase client library. One table, `plans(id, plan jsonb, created_at)`; the latest row is the athlete's plan.
- **Coach:** official Anthropic SDK, model `claude-sonnet-5-5`, with structured output validated against a schema (zod) before saving. Server-side only.
- **Tests:** Vitest in both packages; supertest for the API. Every test uses a fake coach client; no test calls the real API. The Postgres store is tested with an in-memory Postgres (`pg-mem`). Commands: `npm test` inside `server/` and inside `client/`.
- **Repo layout:** one repo, two independent packages: `server/` and `client/`, plus `docs/`.
- **Environment variables:** server: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CLIENT_ORIGIN` (for CORS); client: `VITE_API_URL`. Nothing secret in the repo; `.env.example` files document them.

Deployment choices and their known limits:

- Render free web services spin down after 15 minutes without traffic and take about a minute to wake up, so the client shows a "waking up the coach" loading state and uses a request timeout longer than the coach's 30 s. Before a demo, open `/health` to wake the service (an uptime pinger is optional).
- Supabase free projects pause after one week of inactivity; open the project before the demo.
- Render and Supabase should be created in the same region.

Minimal architecture (input to output):

1. **Form** (`client/`, React): collects the onboarding and sends it to `POST /api/plan`; on load it asks `GET /api/plan` for a saved plan.
2. **Onboarding validator** (`server/`, `validateOnboarding`): pure function; returns per-field errors or the cleaned onboarding. Stops the flow before calling the coach (criterion 3).
3. **Coach client** (`generatePlan`): builds the hybrid-coach prompt from the onboarding (the pasted plan goes in as clearly delimited data), calls Anthropic, and validates the response against the schema and the business rules, including R4: the coach returns both `understoodRunning` (the running sessions it read from the pasted plan) and the `plan`, and code checks that the plan's running sessions are identical to `understoodRunning`. Injected as a dependency so it can be faked in tests.
4. **Plan store** (`planStore`, Postgres): saves a plan only after it passed validation (criteria 2 and 3); `GET /api/plan` returns the latest saved plan or `null`.

Plan contract (what the tasks consume; the server is authoritative, the client keeps a copy of the types):

```ts
Onboarding = {
  goal: string,                       // required, non-empty
  runningLevel: "beginner" | "intermediate" | "advanced",
  crossfitLevel: "beginner" | "intermediate" | "advanced",
  injuries: string,                   // may be empty
  runningDays: Day[],                 // Day = "mon".."sun"; may be empty if existingRunningPlan is given
  crossfitDays: Day[],
  existingRunningPlan: string | null, // pasted text, at most 4,000 characters
}
// Validation: goal non-empty; at least one day available, i.e. crossfitDays, runningDays,
// or an existingRunningPlan must be non-empty; existingRunningPlan within the length cap.
Session = { discipline: "running" | "crossfit", description: string,
            intensity: "easy" | "moderate" | "hard",
            source: "athlete" | "coach" }   // "athlete" only for sessions read from the pasted plan
Plan = {
  days: [{                            // exactly 7, one per Day
    day: Day,
    sessions: Session[],
    combinedLoadNote: string | null   // required and non-empty if the day has both disciplines
  }]
}
CoachResponse = {
  understoodRunning: [{ day: Day, description: string, intensity: ... }],  // empty if no pasted plan
  plan: Plan
}
// R4 check: if existingRunningPlan is given, understoodRunning is non-empty and the plan's running
// sessions are exactly understoodRunning (source "athlete"); the coach adds only crossfit sessions.
```

Constraints: `ANTHROPIC_API_KEY` and `DATABASE_URL` only on the server (never in the client or the repo); injuries are personal health data, so nothing beyond the onboarding is sent to the model and the database is not publicly readable (no Supabase public API usage); CORS allows only `CLIENT_ORIGIN`; the coach call timeout is 30 s. Because there is no login, the deployed API is open, so the server enforces a daily cap on coach calls (`MAX_COACH_CALLS_PER_DAY`, default 20; past it, `POST /api/plan` answers 429 and the coach is not called), and a spend limit is set on the Anthropic account. The pasted running plan is untrusted text: it is sent to the model as delimited data with an instruction to treat it as data, the coach has no tools, and its output is accepted only after schema and R4 validation, so a malicious or confusing paste can at worst produce a rejected response.

Open questions:

- What is the minimum set of onboarding answers needed to generate a plan? (Today: goal + at least one available day.)
- One combined view or one view per discipline? (Today: a single view per day.)
- Which load metric will be used later for CrossFit, which Garmin doesn't score well? (Doesn't affect this slice.)
