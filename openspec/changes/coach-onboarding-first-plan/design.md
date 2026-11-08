## Context

Greenfield: no application code exists. Motivation is in `proposal.md` (Why) and behavior is in `specs/`. This document is only the how. Constraints that shape it:

- Stack is decided (ADR 0005, hosting ADR 0006, deploy ADR 0004, no login and a daily cap ADR 0003; all still "Proposed"): React + Vite + TypeScript client on Vercel, Node + Express + TypeScript server on Render, PostgreSQL on Supabase, `claude-sonnet-5-5` called from the server only.
- Free tiers: Render sleeps after 15 minutes idle and takes about a minute to wake; Supabase pauses after a week idle (figures read on 2026-11-01).
- No login, so the server is the only guard on cost. Tests never call the real model.
- The brief's design inputs (`docs/epics/E1-onboarding-first-plan.md` §5) are the starting point; this design supersedes them where they differ.

## Goals / Non-Goals

**Goals:**
- Every rule in `specs/` is enforced by pure, deterministic functions that unit tests can reach without a model or a database.
- The coach is one replaceable dependency, so tests use a fake.
- A failure at any step leaves no partial plan and gives the client a distinct error.

**Non-Goals:**
- Streaming responses, background jobs, caching, or a retry loop on the server.
- Parsing the pasted plan on the server (see Decision 6).
- Any automatic rollback on deploy.

## Decisions

### 1. Two packages, one shared contract
`server/` and `client/` are separate npm packages, plus a `shared/` folder with the TypeScript types and Zod schemas for the onboarding, coach response, and API errors. Server and client import the same schema, so the form and the API cannot disagree.
*Alternatives:* hand-written validators in each package (drift); OpenAPI code generation (more tooling than a two-endpoint API needs).
*ADR:* stays inside this change. If later epics keep Zod as the validation layer, record it then.
*Linking and builds:* a root `package.json` with npm workspaces (`shared/`, `server/`, `client/`). Render builds from the repo root (`npm ci && npm run build -w server`, start `node server/dist/index.js`); the client is built in GitHub Actions and deployed prebuilt to Vercel, so Vercel never needs `shared/`. `shared/` compiles to `dist` (its `package.json` `main` points there) and the server's build script builds `shared` first, so `node server/dist/index.js` never loads raw TypeScript. CI runs a clean build from a fresh checkout with those same commands and starts the server from the result. Not yet verified: how Render's free tier handles npm workspaces; the first deploy shows it. `shared/` and `evals/` are new top-level folders beyond the layout line in `CLAUDE.md` (`evals/` is already named in `docs/workflow.md` §9.2); the owner accepts them, and `CLAUDE.md` gets the updated layout line in a small `process` PR.

### 2. Contract

```ts
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Level = "beginner" | "intermediate" | "advanced";

type Onboarding = {
  goal: string;
  runningLevel: Level;
  crossfitLevel: Level;
  injuries: string;                          // may be empty
  runningDays: Day[];
  crossfitDays: Day[];
  existingRunningPlan: string | null;        // trimmed; empty counts as null; max 4000 chars
  pastedPlanWeek: number | null;             // 1..52; null and absent are the same
  weeklyTraining: { runningSessions: number; crossfitSessions: number; runningKm: number | null } | null;
  targetEvent: { name: string; date: string } | null;   // date: ISO yyyy-mm-dd, UTC
};

type Session = {
  discipline: "running" | "crossfit";
  description: string;
  intensity: "easy" | "moderate" | "hard";   // the coach's label, never compared for pasted sessions
  source: "athlete" | "coach";
};
type PlanDay = { day: Day; sessions: Session[]; combinedLoadNote: string | null };
type Plan = { days: PlanDay[]; recommendations: string[]; safetyNote: string | null };   // 7 days

type CoachResponse = {
  understoodRunning: { dayOptions: Day[]; description: string }[];
  painReported: boolean;
  plan: Plan;
};

type PlanRecord = { id: number; plan: Plan; onboarding: Onboarding; createdAt: string };

type ApiError = { error: "validation_error" | "daily_limit_reached" | "coach_unavailable"
                       | "invalid_coach_response" | "plan_unreadable" | "server_error";
                  message: string; fields?: Record<string, string> };
```

**Endpoints**

| Call | Success | Errors |
|---|---|---|
| `POST /api/plan` (body: `Onboarding`) | 200 `PlanRecord` | 400 `validation_error` (with `fields`; also a malformed JSON body); 413 `validation_error` for a body over 16 KB 🔶; 429 `daily_limit_reached`; 502 `coach_unavailable`; 422 `invalid_coach_response`; 422 `plan_unreadable`; 500 `server_error` |
| `GET /api/plan` | 200 `PlanRecord`, or 200 with JSON `null` | 500 `server_error` |
| `GET /health` | 200 `{"status":"ok"}` | none |

Status codes are proposals 🔶. `GET /api/plan` never calls the coach. The body-size and JSON-parse errors are raised by middleware before the validator and mapped to the same `ApiError` shape.

### 3. The coach is an injected interface
`CoachClient.generate(onboarding): Promise<CoachResponse>`. The real one calls the Anthropic SDK; tests use a fake that returns canned responses, including hostile ones (altered session, obeying an injected instruction).

Real client settings: model from `COACH_MODEL` (default `claude-sonnet-5-5`); structured output through `output_config.format` with a JSON schema derived from the Zod schema (fallback: ask for JSON and validate, per brief §9); `output_config.effort` set explicitly to `medium` 🔶 for cost, to be tuned by the evals; thinking left at the model default; no sampling parameters and no forced `tool_choice` (both are rejected by this model); client timeout 30 s; `maxRetries: 0`, because every call counts toward the cap and the athlete decides whether to retry; `max_tokens` 8000 🔶, where a refusal or a truncated response maps to `invalid_coach_response`. Token usage per call (counts only, never content) is logged so the first real run gives measured cost.

Prompt layout: rules in the system prompt (Principles 1, 5, 6, the output shape); the onboarding as JSON in the user message; the pasted plan inside explicit delimiters and described as data, never instructions. The coach has no tools.

### 4. Validation is a pipeline of pure functions
`validateOnboarding(body)` returns per-field errors. `validateCoachResponse(onboarding, response)` returns a list of violated rules, grouped as: structure (seven distinct days, at least one rest day unless pasted sessions fill the week), declared days, combined-load note, volume guard, import rules (unchanged sessions, `dayOptions`, only CrossFit added), and safety rules (`painReported` against `safetyNote`). Mapping to errors: coach throws or times out → `coach_unavailable`; any violation → `invalid_coach_response`; a pasted plan with empty `understoodRunning` → `plan_unreadable`, which wins when both apply; a cap or store failure → `server_error` (500) with nothing saved. A refusal, a truncated response, or a response that fails the schema is an `invalid_coach_response`. Pasted sessions are matched to `understoodRunning` one to one (a multiset, so repeated descriptions work). The rest-day exception applies when every day of the final plan has a `source: "athlete"` session, whatever `dayOptions` allowed. Each function has no I/O, so each spec scenario is one unit test with the fake coach.
*Alternative:* one big validator returning a boolean (cannot tell the athlete or the tests why).

### 5. Data model and the atomic cap

```sql
plans(id bigserial primary key, plan jsonb not null, onboarding jsonb not null,
      created_at timestamptz not null default now())
coach_call_counts(day date primary key, calls int not null)
```

Latest plan: `order by created_at desc, id desc limit 1`. The cap is one statement, run before the coach call:
`insert into coach_call_counts(day, calls) values (utc_today, 1) on conflict (day) do update set calls = coach_call_counts.calls + 1 where coach_call_counts.calls < $limit returning calls` — no row back means the cap is reached (429). The count is never refunded, so failed and rejected calls count, as the spec requires.
*Alternative:* the brief's `coach_calls(id, called_at)` with a count-then-insert; two concurrent requests can both pass the count. An advisory lock would also work but needs a transaction around the coach call.
*Consequence:* E7 (accounts and quotas) replaces this table.

### 6. The coach reads the paste; the server does not parse it
The model receives the whole paste and `pastedPlanWeek`, picks that week's rows, and reports them as `understoodRunning`. The server only checks the coach's output against its own report (known limit: it cannot detect a misread; the label and one manual run with the author's plan are the guards).
*Alternative:* the server parses `Week / Day / Training` rows (as in the author's garmin app), then needs no model for week selection and could reject "no rows for week 13" before spending a call. Rejected for E1: pasted formats vary, and the cost is one wasted call in a rare case. Revisit if that case turns out common.
Two pasted sessions may share a day, since the specs do not forbid it; matching is one to one (Decision 4).

### 7. The client
A single page: the onboarding form and, below it, the plan view. Requests use an abort timeout of 120 s 🔶 (a cold Render wake of about 60 s plus the 30 s coach timeout, with margin). A timer shows "waking up the coach" after 3 s without a response. "Plan next week" fills the form from `PlanRecord.onboarding` with `pastedPlanWeek + 1`, so week 53 surfaces the server's field error. The shared schema gives instant field feedback; the server stays the authority.

### 8. Deploy workflow
`.github/workflows/deploy.yml` runs on `workflow_run` of the `CI` workflow when it completes successfully on `master`: migrate (a small SQL-file runner with a `schema_migrations` table, against `DATABASE_URL`), deploy the server (create a Render deploy through its API and poll until that deploy is live, because `/health` alone can be answered by the old instance), deploy the client (Vercel CLI, prebuilt), smoke test (`/health`, `GET /api/plan`, the client URL, a CORS check from another origin, and an invalid `POST /api/plan` that must return 400 without a coach call; no response body is printed to the CI log). Render auto-deploy is turned off and the Vercel Git integration is disconnected (owner settings, listed in the tasks). Secrets live in GitHub Actions secrets only. A `concurrency` group stops two quick merges from overlapping deploys, and a failed smoke test is reported as a failed commit status. Migrations run while the old server is still up, so they must be backward compatible (add, never drop or rename in the same release).
*Tension with the specs:* the spec's "full flow on the live URL" would spend a real coach call on every deploy if automated. The smoke test therefore covers health and the read path, and the full flow is checked by hand once at the first deploy (recorded in that PR) and whenever the deploy workflow changes.
*Alternatives:* a Playwright flow against live with the real coach (cost on every merge); provider auto-deploy (the specs forbid it, and it ignores CI).

### 9. Configuration, logging, and privacy
Environment variables: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `MAX_COACH_CALLS_PER_DAY` (default 20), `CLIENT_ORIGIN`, `COACH_MODEL`, `COACH_MODE` (`real` by default). At startup the server refuses to run if `ANTHROPIC_API_KEY` is missing in real mode (the fake mode used by CI needs none) or if `MAX_COACH_CALLS_PER_DAY` is not a positive integer. Request size is bounded (16 KB body, plus the field limits in `specs/onboarding/`). The event-date check is UTC only, so an athlete west of UTC late in the evening may need to enter tomorrow's date. CORS allows only `CLIENT_ORIGIN`. Logs never contain the injuries text, the pasted plan, or a plan. The client has no direct database access; the only read path is `GET /api/plan`, which is open to anyone with the URL. That risk is accepted for E1 (PRD R11) and mitigated by keeping the deployed URL private; E7 revisits it.

### 10. Tests
Vitest in both packages; supertest for the API; `pg-mem` for the store; the fake coach everywhere. Every spec scenario gets a test tagged `@spec(<capability>/<requirement>/<scenario>)`. Scenarios marked "eval-verified" in `specs/safety/` are tagged `@eval(...)` in the evaluation files instead, and the manual-verified deploy scenarios (order, failure handling, write path, provider auto-deploy off, full flow) are tagged `@manual(...)` in a short checklist file whose results are recorded in the first deploy PR; `scripts/trace` (not built yet) must accept all three tags. The concurrency scenario runs against a real Postgres service container in CI, because `pg-mem` is single-threaded and cannot show a race; locally it is skipped when no test database is configured. The end-to-end tests select the fake coach with `COACH_MODE=fake`; the server refuses to start when that is set together with `NODE_ENV=production`, and a test covers the refusal. The built client bundle is scanned for the secret variable names and the `sk-ant-` key prefix.

## Risks / Trade-offs

- **`pg-mem` may not support** `jsonb`, `timestamptz`, or `ON CONFLICT ... DO UPDATE ... WHERE` → verify in the first task; fall back to a Postgres service container for the store tests too.
- **A misread paste cannot be detected by code** → the "from your plan" label and one manual run with the author's own plan (brief risk R9).
- **Prompt-only safety rules** (no diagnosis, no training through pain) are checked only by local evals at one repeat → rerun a failed safety scenario before concluding; accepted, documented.
- **Cold start** (Render about a minute, Supabase paused after a week idle) → the "waking up" state; a paused database shows as `server_error` and the first request after a long gap may need a retry.
- **Cost runaway** → the atomic daily cap plus an Anthropic spend limit set by the owner, and token usage logged to measure it.
- **The open `GET /api/plan`** exposes the latest plan, including a safety note → private URL, accepted for E1.
- **Render free tier with npm workspaces is unverified** → the CI clean build uses the same commands; any difference shows at the first deploy.
- **Model behavior drift** (model id, structured output support) → check in the first coach task (brief §9).

## Migration Plan

First deploy, in order: owner creates the Vercel, Render, and Supabase accounts and the Anthropic spend limit; adds the GitHub secrets; turns off provider auto-deploy; merges the deploy workflow; the first green merge runs migrate, server, client, and smoke; the owner runs the full flow once by hand. Migrations are forward-only SQL files. Rollback is manual: redeploy the previous commit from the Render and Vercel dashboards; no automatic rollback in E1.

## Open Questions

- Default `pastedPlanWeek` derived from the race date (weeks remaining); the form works without it.
- Exact prompt wording for `safetyNote` and `recommendations`; tuned by the evals.
- The effort level (`medium` is a starting point) and the coach timeout (30 s) once real runs give numbers.
