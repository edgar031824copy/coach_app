# 0008. Plans are keyed by calendar week

**Status:** Proposed
**Date:** 2026-11-27

## Context

Until `coach-plan-history` every build added a row to `plans`, so one week could hold several plans, only the newest showed, and deleting walked back through rows the athlete could not see (the owner's real data: three rows, all for the week of 2026-11-16). Later epics read plans: E3 (the load model) needs "the plan of a week", and E6 (the validation log) records what was suggested and done against a week. Both need one answer per week.

## Options considered

- **One plan per calendar week, enforced by the database (chosen).** The Monday of the week (`week_start`) is the key. Rebuilding a week replaces its plan in one atomic upsert and keeps the row's id; a unique index makes a second plan for a week impossible. Migration 003 merged today's duplicates and copied what it removed to `plans_merged`.
- **A `superseded` flag that hides old rows:** rejected, it keeps the hidden state this change removes.
- **Several plans per week, with a way to pick one:** rejected, there is no use for a second plan of the same week in a single-athlete coach, and every reader would have to choose.
- **A plan history per week (versions):** rejected for now. The PRD's S1 "Plan history / adjustment log" is a different thing (what was suggested and done, E6); a version history of plans can be added later without changing this key.

## Decision

A plan belongs to one calendar week (the Monday, in the athlete's own calendar when it is built) and there is at most one plan per week. Building a week that has a plan replaces it. Readers (E3, E6) may rely on `week_start` being unique.

## Consequences

- Rebuilding a week cannot be undone: the page warns before it happens. The earlier plan of that week is gone (the migration's `plans_merged` copy is a one-off, not a feature).
- Code can ask for "the plan of the week of D" and get at most one row.
- The unique index is the guard, so a second server instance or a second tab cannot create a duplicate; the later writer wins.
- The migration was the first one that deleted production data and broke the runner's "backward compatible" rule; the old server's rebuild of an existing week fails until the new server is live (seconds, nothing lost).
- `plans_merged` stays until the owner drops it in a later migration.
- Revisit if E3 or E6 need more than one plan for a week (for example a mid-week adjustment kept beside the original).
