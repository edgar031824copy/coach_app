Each `## N.` group is one implementation PR (about 2 to 5 tasks). Every task is test first: write the test, see it fail, then implement. "Scenarios" use the id format `<capability>/<requirement-slug>/<scenario-slug>`; `*` means every scenario of that requirement. Tests carry `@spec(<id>)`, eval-verified ones `@eval(<id>)`, and the manual deploy check `@manual(<id>)`.

Prerequisite outside this change: the harness pieces listed as not built in `docs/workflow.md` §15 (Stop hook, scope-freeze and spec-protection hooks, `.phase`, `scripts/phase`, `scripts/trace` accepting `@spec`, `@eval`, and `@manual`) should exist before group 1 starts, or at the latest before group 8's G4.

## 1. Scaffold the server and the shared contract

- [x] 1.1 Create the `server/` package (Express, TypeScript, Vitest, supertest) with `GET /health`.
  - Done when: `npm test` in `server/` runs and passes; `/health` returns `{"status":"ok"}`.
  - Test plan: a supertest test for `/health` written first.
  - Scenarios: `deploy/live-health/health-check` (locally; the live run is task 8.3).
- [x] 1.2 Create `shared/` with the types and Zod schemas from `design.md` (Day, Level, Onboarding, Session, Plan, CoachResponse, PlanRecord, ApiError) and wire `server/` (and later `client/`) to import it through npm workspaces (a root `package.json`).
  - Done when: both a valid and an invalid sample parse as expected for each schema; `server/` compiles against `shared/`; the server build compiles `shared` first and `node server/dist/index.js` starts from a fresh checkout.
  - Test plan: unit tests with one accepted and one rejected sample per schema.
  - Scenarios: none (foundation for groups 2 to 6).
- [x] 1.3 Extend `.github/workflows/ci.yml` with typecheck, lint, and test steps for every package that exists, plus a clean build from a fresh checkout with the commands Render will use (`npm ci && npm run build -w server`); `ci-complete` depends on them.
  - Done when: the PR's CI is green, and a deliberately failing test (removed before merge) turns `ci-complete` red.
  - Test plan: observe both runs on the PR; keep the red run's link in the PR description.
  - Scenarios: none (harness).

## 2. Onboarding validation

- [x] 2.1 Implement `validateOnboarding` for required answers and field rules (goal, levels, days, duplicates, empty injuries; the malformed-body scenario is tested over HTTP in 2.3).
  - Done when: each listed scenario has a passing test; the function does no I/O.
  - Test plan: table-driven unit tests, one case per scenario.
  - Scenarios: `onboarding/required-answers/*`, `onboarding/field-validation/*`.
- [x] 2.2 Extend `validateOnboarding` for the pasted plan and optional fields (length, whitespace-only as absent, `pastedPlanWeek` default and range, `weeklyTraining` ranges, `targetEvent` date in UTC with an injectable clock, the free-text length limits and the week saved as 1 when defaulted; the 16 KB body limit and JSON parse errors come from middleware and are mapped to the `ApiError` shape). Measure the author's real 12-week plan copied from the spreadsheet; if it exceeds 4,000 characters, raise the paste limit before this PR merges.
  - Done when: all listed scenarios pass, including "event date today is allowed".
  - Test plan: unit tests with a fixed clock.
  - Scenarios: `onboarding/pasted-running-plan-input/*`, `onboarding/optional-context-fields/*`, `onboarding/free-text-length-limits/*`.
- [x] 2.3 Wire `POST /api/plan` to the validator: 400 `validation_error` with per-field messages, using a spy coach that must not be called and a cap count that must not change.
  - Done when: an invalid body returns 400 with `fields`, the spy shows zero calls, and the count is unchanged; an over-16 KB body returns 413 and an unparseable body returns 400, both with no coach call.
  - Test plan: supertest with the spy coach and an in-memory count.
  - Scenarios: `onboarding/invalid-input-never-reaches-the-coach/*`, `onboarding/field-validation/malformed-body-is-rejected`, `onboarding/free-text-length-limits/request-body-too-large`.

## 3. Store and daily cap

- [x] 3.1 Add the migration runner (SQL files plus a `schema_migrations` table) and the first migration (`plans`, `coach_call_counts`); check that `pg-mem` supports `jsonb`, `timestamptz`, and `ON CONFLICT ... DO UPDATE ... WHERE`.
  - Done when: the migration applies twice without error; the `pg-mem` check is written in the PR description with the fallback decision (real Postgres for store tests) if anything is unsupported.
  - Test plan: run the migration twice in a test; one probe test per `pg-mem` feature.
  - Result (2026-11-08): `pg-mem` handles `jsonb`, `bigserial`, `timestamptz`, ordering and plain `ON CONFLICT DO UPDATE`, but returns the existing row from `DO UPDATE ... WHERE` at the limit (real Postgres returns none) and ignores `ROLLBACK`. Fallback decision: every database test runs against real Postgres (a service container in CI, the owner's local Postgres otherwise) and `pg-mem` is not used.
  - Scenarios: none (foundation).
- [x] 3.2 Implement the plan store: save a plan with its onboarding, read the latest (highest `created_at`, then `id`).
  - Done when: the listed scenarios pass against the store.
  - Test plan: store tests with controlled timestamps, including two plans with equal times.
  - Scenarios: `plan-storage/save-only-valid-plans/*`, `plan-storage/reload-without-a-coach-call/no-plan-yet`, `plan-storage/reload-without-a-coach-call/latest-plan-wins`.
- [x] 3.3 Implement the cap reservation (the single atomic upsert from `design.md`, default 20, UTC day, never refunded) with an injectable clock, and refuse to start when `MAX_COACH_CALLS_PER_DAY` is not a positive integer.
  - Done when: at the limit the reservation returns "denied"; a new UTC day resets; `MAX_COACH_CALLS_PER_DAY` is honored.
  - Test plan: sequential unit tests with a fake clock.
  - Scenarios: `cost-cap/daily-cap/default-limit`, `cost-cap/daily-cap/invalid-limit-setting`, `cost-cap/what-counts-toward-the-cap/new-day-resets-the-count`.
- [x] 3.4 Add a Postgres service container to CI and a concurrency test that fires two reservations with one call left; skip it locally when no test database is configured.
  - Note: the service container itself was added in 3.1's PR, because every database test now uses real Postgres; this task keeps the concurrency test and the 20-run loop. The "skip it locally when no test database is configured" part is superseded: with all database tests on real Postgres, a missing local database fails loudly with instructions instead of skipping, so the concurrency test can never be skipped silently.
  - Done when: in CI exactly one of two simultaneous reservations succeeds, repeatedly (run the test 20 times in a loop).
  - Test plan: the loop test itself, against real Postgres.
  - Scenarios: `cost-cap/cap-holds-under-concurrency/two-requests-with-one-call-left`.

## 4. Coach response validation

- [x] 4.1 Implement structure validators: seven distinct days, at least one rest day (unless pasted sessions fill the week), coach sessions only on declared days.
  - Done when: each scenario passes with a fake coach response.
  - Test plan: unit tests per scenario, including six days, duplicate days, and a pasted plan covering all seven days.
  - Scenarios: `plan-generation/seven-day-plan/*`, `plan-generation/at-least-one-rest-day/*`, `plan-generation/coach-sessions-on-declared-days-only/*`, `onboarding/required-answers/pasted-plan-without-crossfit-days-is-accepted` (the plan has no coach-added CrossFit sessions).
- [x] 4.2 Implement the combined-load note rule and the volume guard.
  - Done when: a shared day without a note is rejected (pasted running plus coach CrossFit included); the guard accepts at the limit and rejects above it.
  - Test plan: unit tests at the boundary values (1.3 times, plus 2).
  - Scenarios: `plan-generation/combined-load-note/*`, `plan-generation/volume-guard-from-stated-weekly-training/*`.
- [x] 4.3 Implement the pasted-plan rules: unchanged sessions, `dayOptions` placement, only CrossFit added, empty `understoodRunning` as `plan_unreadable`, no athlete sessions without a paste, and a hostile fake coach that obeys an injected instruction.
  - Done when: every listed scenario passes, including week 13 of a 12-week paste returning `plan_unreadable`.
  - Test plan: unit tests with fake coach responses; one test where the fake obeys the injected instruction.
  - Scenarios: `running-plan-import/only-the-chosen-week-is-used/no-rows-for-the-chosen-week`, `running-plan-import/pasted-sessions-are-kept-unchanged/*` (including identical descriptions matched one to one), `running-plan-import/unreadable-paste/*`, `running-plan-import/coach-adds-only-crossfit-sessions/*`, `running-plan-import/pasted-text-is-untrusted-data/*`. The two model-dependent scenarios (chosen week, flexible days) are eval-verified in task 7.2.
- [x] 4.4 Implement the safety validators: `painReported` true needs a non-null `safetyNote`; false needs it null.
  - Done when: both rejection cases and both accept cases pass.
  - Test plan: four unit tests with fake responses.
  - Scenarios: `safety/safety-note-when-pain-is-reported/pain-reported-with-a-note`, `safety/safety-note-when-pain-is-reported/pain-reported-without-a-note`, `safety/safety-note-when-pain-is-reported/note-without-reported-pain`.

## 5. Plan generation endpoint

- [x] 5.1 Implement the generation flow: validate onboarding, reserve a cap slot, call the coach, validate the response, save, return a `PlanResponse` (a `PlanRecord` plus `remainingCallsToday`, which coach error responses also carry); map failures to 502 `coach_unavailable`, 422 `invalid_coach_response`, 422 `plan_unreadable`, 429 `daily_limit_reached` (a refusal, truncated, or wrong-shape response is `invalid_coach_response`, and `plan_unreadable` wins when both apply); pass `targetEvent` to the coach; save nothing on failure; failed and rejected calls keep their count.
  - Done when: each outcome is returned with the right status and error, and the store is empty after any failure; a thrown cap reservation or save returns 500 `server_error` with nothing saved, and a reservation made before a failed save still counts.
  - Test plan: supertest with a fake coach that succeeds, throws, times out, and returns invalid and unreadable responses.
  - Scenarios: `plan-generation/distinct-failure-outcomes/*`, `plan-generation/target-event-as-context/event-is-sent-to-the-coach`, `plan-generation/seven-day-plan/valid-onboarding-gives-seven-days`, `cost-cap/daily-cap/cap-reached`, `cost-cap/what-counts-toward-the-cap/failed-call-counts`, `cost-cap/what-counts-toward-the-cap/rejected-response-counts`, `plan-storage/save-only-valid-plans/*`.
  - Control case (from the group 2 review): add a test where a valid body calls the coach and increments the cap count, so the "coach not called and count unchanged" checks of `onboarding/invalid-input-never-reaches-the-coach/*` can actually fail. Until this exists they only pass because nothing calls the coach or the cap.
  - Done in 5.1: the control case, the tag for `distinct-failure-outcomes/unreadable-and-invalid-at-once`, and the coach timeout enforced in the flow (`coachTimeoutMs`, default 30 s). Not done, optional hardening from the group 4 review: the matching of pasted sessions has no size bound, so a cap on the number of sessions or `understoodRunning` entries in the response-shape check would bound the work; the model's output-token limit already makes a huge response impractical.
- [ ] 5.2 Implement `GET /api/plan` returning the latest `PlanRecord` or `null`, with no coach call.
  - Done when: it returns the saved plan after a successful `POST` and `null` before any.
  - Test plan: supertest with a spy coach showing zero calls on `GET`.
  - Scenarios: `plan-storage/reload-without-a-coach-call/reload-shows-the-same-plan`, `plan-storage/submitting-again-replaces-the-shown-plan/second-submission`.
- [ ] 5.3 Implement the real coach client: model from `COACH_MODEL`, structured output, `medium` effort, 30 s timeout, `maxRetries: 0`, `max_tokens` 8000 🔶, the prompt layout (rules in the system prompt, onboarding as JSON, paste inside delimiters, no tools), and token-usage logging without content.
  - Done when: against a mocked SDK the request has the expected shape, the paste is inside the delimiters, a timeout becomes `coach_unavailable`, and no real call is made in any test.
  - Test plan: unit tests with a mocked SDK; one manual check against the real API, recorded in the PR, that the model id and structured output work (design risk).
  - Scenarios: `plan-generation/distinct-failure-outcomes/coach-timeout`, `running-plan-import/pasted-text-is-untrusted-data/*` (prompt shape).
- [ ] 5.4 Add configuration, CORS, and logging rules: env vars, only `CLIENT_ORIGIN` allowed, no secret in the repo, and logs that never contain injuries, the paste, or a plan.
  - Done when: a request from another origin gets no CORS permission; the repository secret scan (gitleaks) passes; the server refuses to start without `ANTHROPIC_API_KEY` in real mode (fake mode needs none); a log capture test finds none of the test data.
  - Test plan: supertest with an `Origin` header; a log-capture test with sample injuries text.
  - Scenarios: `deploy/no-secrets-and-restricted-origin/other-origins-are-refused` (the bundle scan is task 6.5).

## 6. Client

- [ ] 6.1 Create the `client/` package (React, Vite, TypeScript, Vitest, Testing Library) and the API module with a 120 s abort timeout and a "waking up the coach" state after 3 s.
  - Done when: a component test shows the waking state at 3 s of silence and no timeout error before 120 s (fake timers).
  - Test plan: component test with fake timers and a delayed fake fetch.
  - Scenarios: `deploy/cold-start-experience/*`.
- [ ] 6.2 Build the onboarding form using the shared schema for instant field feedback and showing server field errors.
  - Done when: an invalid value shows its message before submitting and a server `validation_error` shows per-field messages.
  - Test plan: component tests for both paths.
  - Scenarios: none new (the rules are covered in group 2; this task only presents them).
- [ ] 6.3 Build the plan view: seven days in order, rest day, "from your plan" and "coach suggestion" labels, combined-load note, safety note, week number.
  - Done when: each listed scenario passes in a component test with fixture plans.
  - Test plan: component tests with fixtures including an empty day and a pasted-plan plan.
  - Scenarios: `plan-storage/day-by-day-view/*`, `running-plan-import/labels-and-recommendations/*`, `safety/safety-note-when-pain-is-reported/pain-reported-with-a-note` (display).
- [ ] 6.4 Implement reload and "Plan next week", and the client messages for each error (retry for `coach_unavailable` and `invalid_coach_response`, a clear message for `plan_unreadable`, "daily limit reached" with no retry, "no retries remain today" when `remainingCallsToday` is 0 after a failed call).
  - Done when: reload shows the saved plan with no new call; "Plan next week" pre-fills week plus 1 (week 53 shows its field error) and changes nothing until submitted.
  - Test plan: component tests with a fake API for each error and for pre-fill.
  - Scenarios: `plan-storage/plan-next-week/*`, `plan-storage/reload-without-a-coach-call/reload-shows-the-same-plan`, `cost-cap/daily-cap/cap-reached` (client message), `cost-cap/last-allowed-call-fails/last-call-fails`.

- [ ] 6.5 Add a bundle secret scan to CI: build the client and fail if the output contains a secret variable name (`ANTHROPIC_API_KEY`, `DATABASE_URL`) or the `sk-ant-` key prefix.
  - Done when: the scan passes on the real build and fails on a build with a planted fake key.
  - Test plan: run the scan once on a bundle with a planted string and once on the clean build.
  - Scenarios: `deploy/no-secrets-and-restricted-origin/no-secret-in-the-repo-or-bundle`.

## 7. End-to-end tests and evaluation

- [ ] 7.1 Add Playwright end-to-end tests for the main journey, using the fake coach selected by `COACH_MODE=fake` (the server refuses to start with it when `NODE_ENV=production`, and a test covers that refusal): onboarding with a pasted plan, plan shown, reload, "Plan next week", and a daily-limit message.
  - Done when: the tests run green in CI against the local stack with a real Postgres container.
  - Test plan: the Playwright tests themselves, written first.
  - Scenarios: `plan-storage/plan-next-week/form-is-pre-filled`, `plan-storage/plan-next-week/submitting-counts-as-a-normal-call`, `cost-cap/daily-cap/cap-reached`.
- [ ] 7.2 Create the evaluation runner and the six E1 evaluation scenarios under `evals/` (default 1 repeat, local, real model), with an initial `evals/baseline.json`; tag the eval-verified safety scenarios with `@eval(...)`.
  - Done when: the runner executes all six scenarios locally, prints pass rates against the baseline, and records token cost.
  - Test plan: run it once locally; keep the results out of the repo (`evals/results/` is ignored) and summarize them in the PR.
  - Evaluation scenario 4 (no paste, no pain) also asserts `painReported` is false.
  - Scenarios (`@eval`): `safety/pain-is-reported-by-the-coach/*`, `safety/no-diagnosis-and-no-training-through-pain/*`, `safety/safety-note-when-pain-is-reported/pasted-plan-and-pain`, `running-plan-import/only-the-chosen-week-is-used/multi-week-paste-uses-the-chosen-week`, `running-plan-import/flexible-days/row-with-several-days`.
- [ ] 7.3 Run the manual check with the author's own 12-week plan against the real API and record the result.
  - Done when: the chosen week's sessions come back unchanged and the paste is read correctly, or the problems are written up.
  - Test plan: one real run, noted in the PR (this is the only guard against a misread paste).
  - Scenarios: none (risk R9 check).

## 8. Deploy, verification, and archive (last PR)

- [ ] 8.1 Write `.github/workflows/deploy.yml`: run only after a `CI` run on `master` that was triggered by a push and concluded `success` (filter the `workflow_run` on branch, event, and conclusion); migrate, deploy the server (create a Render deploy through its API and poll until it is live), deploy the client (Vercel, prebuilt), smoke test (`/health`, `GET /api/plan`, the client URL, a CORS check, and an invalid `POST /api/plan` that must return 400 without a coach call); stop at the first failing step and report a failed smoke test as a failed commit status. Use a `concurrency` group so deploys do not overlap, never print a response body to the log, and keep migrations backward compatible.
  - Note from the group 1 review: if Render sets `NODE_ENV=production` for the build (unverified), `npm ci` skips dev dependencies and `tsc` would be missing. Then make the Render build command `npm ci --include=dev && npm run build -w server` (or move `typescript` to `dependencies`), and run the CI `clean-build` job with `NODE_ENV=production` so it builds the way Render does.
  - Done when: the workflow validates (`actionlint`); the passing checks for its deploy scenarios are the recorded runs in task 8.3.
  - Test plan: `actionlint` plus a branch dry run with deploy steps disabled.
  - Scenarios: `deploy/deploy-order-behind-green-ci/red-ci-does-not-deploy`, `deploy/deploy-order-behind-green-ci/green-merge-deploys-in-order`, `deploy/failure-handling/*`, `deploy/write-path-is-live/*`.
- [ ] 8.2 Write the owner setup checklist (`docs/deploy-setup.md`): create the Vercel, Render, and Supabase accounts, add the GitHub secrets (including the Render API key and service id), use the Supabase pooler connection string (session mode for migrations) because the direct host is reported to be IPv6-only, turn off provider auto-deploy, and set the Anthropic spend limit.
  - Done when: the owner has completed every item and confirms it in the PR.
  - Test plan: the owner ticks each item; confirm that a push to `master` triggers no provider deploy by itself.
  - Scenarios: `deploy/deploy-order-behind-green-ci/provider-auto-deploy-is-off`.
- [ ] 8.3 First deploy and the manual full-flow check: merge, watch the workflow, run onboarding on the live client URL by hand, and record the result in the PR as `@manual`.
  - Done when: `/health` returns ok on the live server and a plan is generated and shown from the live client URL; the PR records evidence for every `@manual` deploy scenario: the first run's step order, a forced failing migration step and smoke step showing the later steps skipped and the failed status, a red-CI run that does not deploy, and the provider auto-deploy setting.
  - Test plan: the manual run, with a screenshot or note in the PR.
  - Scenarios: `deploy/live-health/*` (`full-flow-on-the-live-url` is `@manual`), and the `@manual` scenarios of `deploy/deploy-order-behind-green-ci/*`, `deploy/failure-handling/*`, and `deploy/write-path-is-live/*`.
- [ ] 8.4 Gate G4 and archive: run the traceability check, collect the G4 evidence (eval pass rates against the baseline, test and E2E results), run `/opsx:verify`, then `/opsx:archive`.
  - Done when: every scenario has a passing test, an `@eval` run, or a recorded `@manual` check; the last PR description carries the G4 evidence; the specs are synced.
  - Test plan: `scripts/trace` output and the verify report attached to the PR.
  - Scenarios: all (traceability).
