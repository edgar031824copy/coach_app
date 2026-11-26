## Why

The owner's manual pass on E1b found two gaps: a plan made without a pasted plan shows no week, so "Plan next week" has nothing to count, and a plan cannot be deleted. A follow-up to E1b, not a new epic (`epic: E1b`). Brief: `docs/epics/E1b-ui-foundation.md`. PRD: epic E1b and the E1 requirement "Plan next week".

## What Changes

- **Week for every plan.** Each saved plan carries the Monday of the week it is for (`weekStart`). The first plan is for the current week; "Plan next week" sends the following Monday (never a past week). The plan view shows "Week of 23 Nov" and "Made 26 Nov"; "Week N of your running plan" stays for pasted plans. Existing plans get the Monday of their creation week.
- **Delete a plan.** A trash button "Delete this plan" on the summary card that asks first (a question inside the card), backed by a new `DELETE /api/plan/:id`. It removes the shown plan from the database, refunds nothing, and opens the empty form. A reload never shows the deleted plan.
- `POST /api/plan` accepts an optional `weekStart` beside the onboarding (a Monday within 26 weeks of today; the current week when absent), so old clients keep working.

**For the owner at G1**
1. After deleting the newest plan, earlier plans stay stored: the form opens empty now, and a reload shows the next newest. Deleting every plan instead is not reversible and is not proposed.
2. There is no login (ADR 0003), so anyone who can reach the API can delete any plan, not only read it. Accepted until the access gate (E7).

## Capabilities

### New Capabilities
- `plan-week`: the week a plan is for: stored, validated, defaulted, sent by the client, moved by "Plan next week".
- `plan-deletion`: the delete endpoint, the button, its confirmation, outcomes and focus.

### Modified Capabilities
- `plan-storage`: "Reload without a coach call": the record also carries its week.
- `plan-presentation`: "Summary of the week": also shows the week and the date made.

## Impact

`shared/`, `server/` (migration 002, plan store, `POST`, `DELETE`, CORS), `client/`, `e2e/`, `docs/design-system.md`. Deploy order unchanged. No model or prompt change, so no evals.

## Non-goals

A plan history; choosing the week by hand; marking today; undo or a trash; deleting several plans; telling the coach the week; a login (E7).
