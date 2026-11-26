## Context

E1 saves every plan in one table (`plans`: id, plan, onboarding, `created_at`). `POST /api/plan` takes the onboarding as its body and answers with the saved record; `GET /api/plan` returns the newest record or `null`; the client (`client/src/api.ts`, `App.tsx`, `PlanView.tsx`) shows it. A plan has no week unless the athlete pasted a running plan (`pastedPlanWeek`), so "Plan next week" cannot say which week it plans, and nothing deletes a plan. This change gives every plan a week and adds deletion. See proposal.md. No model, prompt or cap change.

## Goals / Non-Goals

**Goals:** a stored week for every plan; the client moves it forward; the plan view shows it with the date made; a delete endpoint and a button that asks first; a clear, tested outcome for every failure.

**Non-Goals:** plan history, choosing the week by hand, undo, bulk delete, any change to what the coach writes, a login.

## Decisions

### 1. The week is stored, not derived

A new column `week_start date not null` on `plans`. It cannot be derived from `created_at`: "Plan next week" is built the same day as the plan before it, so both would show the same week. A date without a time zone (`YYYY-MM-DD`) is what the athlete means by "the week of 23 Nov", so no time zone leaks into the stored value.
*Alternatives:* a week counter ("Plan 3"), which says nothing about the calendar (rejected by the owner); computing the week from `created_at` plus a "weeks ahead" number (more fields, same result).

### 2. API: an optional `weekStart` beside the onboarding

`POST /api/plan` keeps the onboarding as its body and accepts one more optional key, `weekStart`. The onboarding validator already ignores keys it does not know, so `validateOnboarding` is untouched; a new pure function `validateWeekStart(value, today)` in `shared/` returns the date or a field error. Rules: a string `YYYY-MM-DD` that is a real date, a Monday, and within 26 weeks (182 days) of the Monday of the current UTC week, else the field error `weekStart` ("The week must start on a Monday, within half a year of today."). Absent: the Monday of the current UTC week. Validation runs with the onboarding's and before the cap, so a refused week spends nothing. `PlanRecordSchema` gains `weekStart: z.string()`; the answer to `POST` and `GET` carry it.
**Compatibility:** an old client sends no `weekStart` and ignores the extra field in the answer (the schema strips unknown keys). A new client never meets an old server, because the deploy order is migrate, server, client.
*Alternatives:* put `weekStart` inside the onboarding (it is not an answer and would be saved there); a separate endpoint to change the week afterwards (more calls, a state with no week).

### 3. Migration 002

`server/migrations/002_plan_week.sql`: add the column as nullable, fill it for every existing row with the Monday of the creation week in UTC (`date_trunc('week', created_at at time zone 'UTC')::date`; Postgres weeks start on Monday), then set `not null` with a **default** of the Monday of the current UTC week. The default keeps the old server working between the migration and the new server going live (and after a rollback): its `insert into plans(plan, onboarding)` names no week and still succeeds. Forward-only, one transaction (the runner already wraps each file). `PlanStore.save(plan, onboarding, weekStart)` writes it, `toRecord` reads it, and a new `PlanStore.delete(id): Promise<boolean>` runs `delete from plans where id = $1` and reports whether a row went. Ordering of `latest()` is unchanged.

### 3b. Week arithmetic in one place

`shared/src/week.ts`: `mondayOf(date)`, `addDays(date, n)`, and `isMonday(date)` on `YYYY-MM-DD` strings, computed with UTC date parts so a daylight-saving change never moves a date. The server calls it with the UTC date; the client with the athlete's local calendar date (`getFullYear`, `getMonth`, `getDate`). The same functions serve both, and unit tests cover month and year ends and a leap year.

### 4. The client chooses the week

`api.postPlan(onboarding, weekStart)` sends `{ ...onboarding, weekStart }`. `App` keeps the week of the request next to `lastSent`, so "Try again" repeats both. "Plan next week" and "New plan" set it: the former to the shown plan's `weekStart` plus 7 days, the latter (and the first form) to the Monday of the current local week. The athlete never edits it. The plan view adds two small lines to the summary card, "Week of 23 Nov" and "Made 26 Nov", formatted with `en-GB` day and short month so the text is the same on every machine; "Made" uses `createdAt` in the browser's time zone.

### 5. `DELETE /api/plan/:id`

Express route after `GET`. The id must match `^[1-9][0-9]*$` (anything else: 400 `validation_error`); `store.delete(id)` true gives 204 with no body, false gives 404 with a new error code `not_found` (added to `ApiErrorSchema`); an exception gives 500 `server_error` as the other routes do. It never touches the cap or the coach. CORS: `Access-Control-Allow-Methods` becomes `GET, POST, DELETE, OPTIONS`; the rule that only the client's origin gets headers is unchanged. The client's `call()` accepts an empty body for this route.

### 6. The delete flow in the client

The plan view's button row has two states: the three buttons, or the confirmation ("Delete this plan? This cannot be undone." with "Yes, delete" and "Cancel"), held in `App` state (`confirming`, `deleting`) and reset on every view change by `go()`. Inline, not a modal: no focus trap and no `dialog` support to test across browsers; the confirmation is a `role="group"` named by its question, takes focus on "Cancel" (the safe choice), and "Cancel" returns focus to "Delete this plan". On success (or 404) `App` clears the shown plan (`latest` and the saved record) and calls `go('form')`, which resets the request state and focuses the "New plan" heading. A failure keeps the plan, shows a `role="alert"` notice that takes focus, and restores the three buttons. A new `danger` variant of `Button` (white text on `--error`) styles "Yes, delete" and the contrast pair `brand-fg` on `error` is added to `token-pairs.json`; `docs/design-system.md` lists the variant.

### 7. Checks

Vitest: week functions; `validateWeekStart` table; the plan store against real Postgres (save with a week, migration backfill by running 001 then inserting then 002, delete true and false); route tests with supertest (POST with and without `weekStart`, every refusal, DELETE statuses, cap and coach untouched, CORS preflight); client tests for the week in each request, the plan view lines (with `TZ` set for the date made), and every step of the delete flow. Playwright (fake coach, real Postgres): build a plan and see its week, "Plan next week" shows the following week, delete and reload shows no plan; the confirmation and a failed deletion join the accessibility, layout and target-size states.

## Risks / Trade-offs

- **Earlier plans reappear after a deletion.** Plans stay stored, so deleting the newest makes the next newest the saved plan: the page shows the empty form now, and a reload shows that older plan. This is the owner's choice for the simplest behavior and is called out at G1; "delete all my plans" is the alternative and is not reversible.
- **Migration on live data** → forward-only, one transaction, a test that runs it over rows made by 001; the deploy workflow already migrates before it deploys the server.
- **A wrong week from the client's clock** → the server accepts any Monday within 26 weeks and shows the week as given; a badly set clock gives a wrong label, not a wrong plan.
- **Deleting by id exposes ids** → ids were already in every answer; there is no login in this epic, so anyone who can reach the API could already read plans (ADR 0003); a login and per-athlete ownership come with E7.
- **Accidental deletion** → the confirmation, with focus on "Cancel".

## Migration Plan

Merge the server and shared tasks first (they deploy through the normal workflow: migrate, server, client), then the client tasks. Rollback is the usual redeploy of the previous commit; the new column is harmless to the old server because the column has a default (its inserts name no week and still succeed) and the old code selects only the columns it knows. A test inserts a row the old way after migration 002 to prove it.

## Open Questions

- Whether deleting the newest plan should also remove the older ones (the owner decides at G1; proposed: no).
