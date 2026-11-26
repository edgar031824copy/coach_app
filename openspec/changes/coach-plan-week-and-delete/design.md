## Context

E1 saves every plan in one table (`plans`: id, plan, onboarding, `created_at`). `POST /api/plan` takes the onboarding as its body and answers with the saved record; `GET /api/plan` returns the newest record or `null`; the client (`client/src/api.ts`, `use-plan-request.ts`, `App.tsx`, `PlanView.tsx`) shows it. A plan has no week unless the athlete pasted a running plan (`pastedPlanWeek`), so "Plan next week" cannot say which week it plans, and nothing deletes a plan. See proposal.md. No model, prompt or cap change: the coach is not told the week and keeps building one generic Monday-to-Sunday week; a later epic (E3, E4) can use it.

## Goals / Non-Goals

**Goals:** a stored week for every plan; the client moves it forward; the plan view shows it with the date made; a delete endpoint and a button that asks first; a clear, tested outcome for every failure, including a double click, a lost answer and two browser tabs.

**Non-Goals:** plan history, choosing the week by hand, undo, bulk delete, any change to what the coach writes, a login.

## Decisions

### 1. The week is stored, not derived

A new column `week_start date not null` on `plans`. It cannot be derived from `created_at`: "Plan next week" is built the same day as the plan before it, so both would show the same week. A date without a time zone (`YYYY-MM-DD`) is what the athlete means by "the week of 23 Nov", so no time zone leaks into the stored value.
*Alternatives:* a week counter ("Plan 3"), which says nothing about the calendar (rejected by the owner); computing the week from `created_at` plus a "weeks ahead" number (more fields, same result).

### 2. API: an optional `weekStart` beside the onboarding

`POST /api/plan` keeps the onboarding as its body and accepts one more optional key, `weekStart`. The onboarding validator builds its value from named fields only, so an extra key is ignored and `validateOnboarding` is untouched. A new pure function `validateWeekStart(value, today)` in `shared/` returns the date or the field error `weekStart` ("The week must start on a Monday, within half a year of today."). Only an absent key means "current week"; `null`, `""`, a number, a timestamp and any other string are refused. Rules: `YYYY-MM-DD`, a real date, a Monday, and within 26 weeks (182 days) either side of the Monday of the current UTC week. The route resolves the week with the injected clock (`deps.now`, as the cap and the coach already do) and passes it to `generatePlan(deps, onboarding, weekStart)`, which hands it to `store.save`. Validation runs with the onboarding's and before the cap, so a refused week spends nothing. `PlanRecordSchema` gains `weekStart: z.string()`, so the answers to `POST` and `GET` carry it.
**Compatibility:** an old client sends no `weekStart` and ignores the extra field (the schema strips unknown keys). The deploy order is migrate, server, client, and a rollback redeploys the previous commit, which redeploys **both** server and client through the same workflow, so the new client never has to read an answer without `weekStart`. (Rolling back only the server by hand would break the new client: do not.)
*Alternatives:* put `weekStart` inside the onboarding (it is not an answer and would be saved there); a separate endpoint to change the week afterwards (more calls, a state with no week); a client schema tolerant of a missing week (code for a case the workflow does not produce).

### 3. Migration 002 and the store

`server/migrations/002_plan_week.sql`: add the column as nullable, fill every existing row with the Monday of its creation week in UTC (`date_trunc('week', created_at at time zone 'UTC')::date`; Postgres weeks start on Monday), then set `not null` with a **default** of the Monday of the current UTC week. The default keeps the old server working between the migration and the new server going live (and after a rollback): its `insert into plans(plan, onboarding)` names no week and still succeeds. Forward-only, one transaction (the runner already wraps each file).
**Reading the date:** node-pg turns a `date` into a JavaScript `Date` at local midnight, and `toISOString()` of that shifts the day on a server outside UTC. So every query selects `to_char(week_start, 'YYYY-MM-DD') as week_start` and `toRecord` takes the string as it is. `PlanStore.save(plan, onboarding, weekStart)` writes it; a new `PlanStore.delete(id): Promise<boolean>` runs `delete from plans where id = $1` (one statement, so two deletions of one id give one `true` and one `false`). Ordering of `latest()` is unchanged. Test doubles of `PlanStore` are updated for the new signature.

### 3b. Week arithmetic in one place

`shared/src/week.ts`: `mondayOf(date)`, `addDays(date, n)` and `isMonday(date)` on `YYYY-MM-DD` strings, computed with UTC date parts so a daylight-saving change never moves a date, and `monthShort(date)` with a fixed list of three-letter English names (not `Intl`, whose short names change between engines: "Sept"). The server calls them with the UTC date; the client with the athlete's local calendar date (`getFullYear`, `getMonth`, `getDate`). Unit tests cover month and year ends, a leap day, a Sunday and September.

### 4. The client chooses the week

`api.postPlan(onboarding, weekStart)` sends `{ ...onboarding, weekStart }`; `usePlanRequest.submit` passes it through, and `App` keeps the week next to `lastSent`, so "Try again" repeats both. The first form and "New plan" use the Monday of the current local week; "Plan next week" uses the later of the shown plan's `weekStart` plus 7 days and the Monday of the current week (a plan from weeks ago then plans this week, never the past). The athlete never edits it. A client near midnight at UTC+13 may send a Monday one week ahead of the server's UTC Monday; that is far inside the 26 weeks, so it is harmless. If the server still refuses the week (a plan 26 weeks ahead, after many "Plan next week" presses), `describeFailure` recognizes a validation error whose only field is `weekStart` and says "That week is too far from today. Use New plan to start from this week." with no retry. The plan view adds two lines to the summary card, "Week of 23 Nov" and "Made 26 Nov": the day and the fixed month name of the Monday, and of `createdAt` in the browser's time zone.

### 5. `DELETE /api/plan/:id`

Express route after `GET`. The id must match `^[1-9][0-9]*$` and be a safe integer (at most 9007199254740991), else 400 `validation_error` (a 20-digit id would otherwise reach Postgres and fail as a 500); `store.delete(id)` true gives 204 with no body, false gives 404 `not_found` (a new value of `ApiErrorSchema`); an exception gives 500 `server_error`. It never touches the cap or the coach. CORS: `Access-Control-Allow-Methods` becomes `GET, POST, DELETE, OPTIONS`; only the client's origin gets headers, as before (CORS limits browsers, not `curl`; see Risks). `describeFailure` switches over every error code, so it gets a case for `not_found` ("The plan was not found."), and the client's `call()` accepts an empty body for this route.

### 6. The delete flow in the client

The plan view's button row has two states: the three buttons, or the confirmation, held in `App` state (`confirming`, `deleting`, a failure notice) and reset on every view change by `go()`. Inline, not a modal: no focus trap and no `dialog` support to test across browsers. The confirmation is a `role="group"` named by its question, with "Cancel" first and "Yes, delete" second; focus goes to "Cancel", the safe choice, and "Cancel" returns focus to "Delete this plan". Because the confirmation replaces the button row, a double click on "Delete this plan" could land on "Yes, delete": a press on it in the first 500 ms is ignored (a timestamp taken when the confirmation opens, tested with fake timers), and a second press while a deletion runs sends nothing (the buttons are disabled at once and a ref guards the first render). The client sends the id of the plan it shows (`shown.id`), not the newest. On success or 404 `App` clears the shown plan (`latest` and the saved record) and calls `go('form')`, which resets the request state and focuses the "New plan" heading. When the server answers with an error the notice reads "The plan could not be deleted. Nothing was changed. You can try again."; when no answer arrives (a timeout or a network error) the deletion may have happened, so it reads "The plan may already be deleted. Reload the page to check, or try again."; either way the plan stays, the three buttons are back, and the notice (`role="alert"`) takes focus. A retry after a real deletion gets 404, which counts as success. A new `danger` variant of `Button` (white text on `--error`) styles "Yes, delete", and the pair `brand-fg` on `error` joins `token-pairs.json`; `docs/design-system.md` lists the variant. A deletion cannot run while a plan request does in the same tab (the button exists only in the plan view and "My plan" is disabled while busy); across tabs a plan made in the other tab simply becomes the newest.

### 7. Files touched and checks

Shared: `week.ts`, the schemas, `validateWeekStart`. Server: `app.ts` (the route, the week, CORS), `generate-plan.ts` (receives the week), `db/plan-store.ts`, migration 002, and the test doubles of `PlanStore`. Client: `api.ts`, `use-plan-request.ts`, `App.tsx`, `PlanView.tsx`, `failure-message.ts`, `components/ui/button.tsx`, `styles/token-pairs.json`. Vitest: week functions; `validateWeekStart` table; the plan store against real Postgres (save with a week, the backfill by running 001, inserting, then 002, an insert the old way, the default near a UTC week change, reading back under `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland`, delete true and false); route tests with supertest (POST with and without `weekStart`, every refusal, DELETE statuses and the id table, two deletions at once, cap and coach untouched, the CORS preflight); client tests for the week in each request (with a fixed clock and `TZ`), the plan view lines and every step of the delete flow. Playwright (fake coach, real Postgres): build a plan and see its week, "Plan next week" shows the following week, delete and reload shows no plan; the confirmation and both failed deletions join the layout, target-size, focus-ring, reduced-motion and axe states.

## Risks / Trade-offs

- **Anyone who can reach the API can delete any plan (accepted, for the owner to confirm at G1).** There is no login (ADR 0003), ids are sequential, and 204 versus 404 reveals which exist, so one `curl` loop could delete every stored plan; CORS does not stop `curl`. Reading every plan was already possible the same way; deleting is the new power. ADR 0003 already says an access gate must exist before real data; the gate (E7) closes this, and this change does not add a rate limit or a secret.
- **Earlier plans reappear after a deletion, and the empty form can coexist with a stored plan.** Plans stay stored, so deleting the newest makes the next newest the saved plan: the page shows the empty form now (and "My plan" is not offered), and a reload shows that older plan. This is the owner's choice for the simplest behavior; "delete all my plans" is the alternative and is not reversible.
- **Two tabs.** Tab A shows plan 5, tab B makes plan 6, tab A deletes 5: tab A shows the empty form and a reload shows plan 6. If tab B deleted plan 5 first, tab A's deletion gets 404 and counts as success.
- **Migration on live data** → forward-only, one transaction, a test over rows made by 001, a default so the old server still inserts; the deploy workflow migrates before it deploys the server.
- **A wrong week from the client's clock** → the server accepts any Monday within 26 weeks and shows the week as given; a badly set clock gives a wrong label, not a wrong plan.
- **Accidental deletion** → the confirmation, focus on "Cancel", "Cancel" first, and the ignored early press.

## Migration Plan

Merge the server and shared tasks first (they deploy through the normal workflow: migrate, server, client), then the client tasks. Rollback is the usual redeploy of the previous commit, which redeploys server and client together; the new column is harmless to the old server because it has a default (its inserts name no week and still succeed) and the old code selects only the columns it knows. A test inserts a row the old way after migration 002 to prove it.

## Open Questions

- Whether deleting the newest plan should also remove the older ones (the owner decides at G1; proposed: no).
- Whether the coach should one day be told the week (not in this change; a later epic can use it).
