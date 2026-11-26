# Plan week and delete: manual checks (task 3.4)

Change `coach-plan-week-and-delete` (epic E1b, follow-up change). Checked against `master` at `36eecd3` (PR #39), after CI and the deploy workflow passed for that commit. No URLs are written here: the repository is public.

## What the owner checked

After the deploy the owner used the live app: built plans, looked at the week and date on each, used "Plan next week", deleted plans and refreshed, and looked at the stored rows in the database table. The owner did **not** give an overall "good" for this change. The verdict was mixed:

- The week lines ("Week of 7 Dec", "Made 26 Nov") were read as fine for a generated plan. The owner noted that with a pasted plan both "Week 3 of your running plan" and "Week of …" show, and chose to leave it as designed.
- The delete control was judged confusing to place in the first version (bottom button row, a question far below the fold). It was moved into the summary card as a trash icon with an inline confirmation (task 2.6, spec amendment approved by the owner) and the owner then tested that locally.
- **Deleting is confusing.** The app stores every plan but shows only the newest, so after deleting the newest plan and refreshing, the previous plan appears and looks like a new one; the owner cannot see how many plans are stored. This is the accepted risk "earlier plans reappear after a deletion" in `design.md`, now met in real use. The owner asked to archive this change and fix it right away in a follow-up change, not to reopen this one.

So gate G4's manual part is **accepted for archiving at the owner's request, not as a clean pass**. The follow-up is recorded below.

## Follow-up change (decided, not yet started)

Make the stored plans visible and consistent. Direction discussed with the owner: one plan per calendar week (building a week that already has a plan replaces it, with a warning on the form, and a migration that merges today's duplicates), plus a way to see and move between the stored weeks, so "Delete this plan" removes one visible week and the nearest remaining week appears. "Delete all" was weighed and set aside for now. Open decisions: the migration deletes rows on production data (the owner must approve it), replace without asking or confirm first, and whether this overlaps the PRD's E5 plan view.

## Scenarios checked by hand

None of the 48 scenarios of this change is tagged `@manual`; every one is covered by a test (`scripts/trace`: 230 of 230).

## What backs the rest

- 114 shared, 370 server, 323 client and 62 end-to-end-package tests, typecheck and lint, green in CI.
- 109 Playwright tests against the built server with the fake coach and a real Postgres: the journey now covers the week lines, "Plan next week" moving the week, and deleting (the row gone, the daily count not refunded, an earlier plan shown after a reload); layout at 360, 768 and 1280 px, target sizes, focus rings, reduced motion and axe cover the confirmation and both failed-deletion states.
- Bundle: 117,682 bytes gzipped, 1,561 above the end of E1b, under the 60 KB budget (`docs/design-system.md`).
- No model or prompt change, so no golden-set evals apply at G4.

## Findings

Raised in review and left as is (the wording is the approved text):

1. A refused week shows the plain alert plus, under the form, the server's own line (an archived E1b rule: a server field the form has no place for is never hidden).
2. The refused-week alert says "Use New plan" while the form view has only a heading and "My plan".
3. `OnboardingForm` logs a React "unique key" warning. It is older than this change.
