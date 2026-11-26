## Why

The owner's manual pass on E1b found two gaps. A plan made without a pasted running plan shows no week, so "Plan next week" has nothing to count. And a plan cannot be deleted: a wrong or test plan stays forever. A follow-up to E1b, not a new epic (`epic: E1b`). Brief: `docs/epics/E1b-ui-foundation.md`. PRD: epic E1b and the E1 requirement "Plan next week".

## What Changes

- **Week for every plan.** Each saved plan carries the Monday of the week it is for (`weekStart`). The first plan of a form is for the current week; "Plan next week" sends the following Monday. The plan view shows "Week of 23 Nov" and "Made 26 Nov"; "Week N of your running plan" stays for pasted plans. Existing plans get the Monday of their creation week.
- **Delete a plan.** A "Delete this plan" button with a confirmation, backed by a new `DELETE /api/plan/:id`. It removes the plan from the database, does not refund the daily call count, and opens the empty form. A reload never shows the deleted plan.
- `POST /api/plan` accepts an optional `weekStart` beside the onboarding (a Monday within 26 weeks of today; the current week when absent), so old clients keep working.
- **For the owner at G1:** earlier plans stay stored, so after deleting the newest plan a reload shows the next newest. The alternative, deleting every stored plan, is not reversible and is not proposed.

## Capabilities

### New Capabilities
- `plan-week`: the week a plan is for: stored, validated, defaulted, sent by the client, moved by "Plan next week".
- `plan-deletion`: the delete endpoint, the button, its confirmation, outcomes and focus.

### Modified Capabilities
- `plan-storage`: "Reload without a coach call": the record also carries its week.
- `plan-presentation`: "Summary of the week": also shows the week and the date made.

## Impact

`shared/` (schemas); `server/` (migration 002, plan store, `POST`, new `DELETE`, CORS methods); `client/` (API, plan view, confirmation, a danger button); `e2e/`; `docs/design-system.md`. Deploy order unchanged: migrate, server, client. No model or prompt change, so no evals.

## Non-goals

A plan history or opening an earlier plan; choosing the week by hand; marking today; undo or a trash; deleting several plans; any change to what the coach produces; a login (E7).
