## Why

The app stores every plan but shows only the newest, and deleting works on a set the athlete cannot see. On the live app the owner deleted the newest plan, refreshed, and an older plan appeared that looked new; the table held three plans for the same week. Source: `docs/plan-week-and-delete-manual-checks.md`. A follow-up to E1b (`epic: E1b`, no brief). The PRD's E5 (actual versus planned) and S1 (adjustment log) stay untouched.

## What Changes

- **One plan per calendar week.** Building a week that already has a plan replaces it (same row, new creation time, one atomic step; a failed build keeps the old plan). A migration merges today's duplicates: it keeps the newest plan of each week and deletes the older ones of that week. **BREAKING for stored data**, approved by the owner (three test rows on production).
- **See every stored plan.** `GET /api/plans` returns all plans, oldest week first. The plan view gets a week switcher (earlier, later, "2 of 5"). The page opens on the current week's plan if there is one, else the plan made most recently.
- **Deleting is visible.** Deleting the shown week shows the nearest remaining week with a status line; the empty form opens only when none is left. The question says that the other plans stay.
- **A warning before a replace.** The form says so when the week it builds already has a plan.

## Capabilities

### New Capabilities
- `stored-plans`: the list endpoint, the week switcher, the plan shown on load, the warning before a replace.

### Modified Capabilities
- `plan-week`: at most one plan per week, and the migration that merges duplicates.
- `plan-storage`: submitting again replaces the plan of that week.
- `plan-deletion`: the nearest remaining week is shown after a deletion.
- `app-views`: the page reads all plans on start.

## Impact

`server/` (migration 003, plan store, `GET /api/plans`), `shared/`, `client/`, `e2e/`, `docs/design-system.md`. The deploy runs migration 003 on production before the new server goes live. No model or prompt change, so no evals.

## Non-goals

- Choosing a week by hand, or any change to the 26-week window.
- A log of suggestions (S1, E6), comparison with actual training (E5), undo, "delete all", pagination, editing a stored plan.
- A login (ADR 0003): anyone who can reach the API can still read and delete every plan until E7.
