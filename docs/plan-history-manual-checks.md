# Plan history: manual checks (task 3.4)

Change `coach-plan-history` (epic E1b, follow-up change). Checked against `master` at `c35ccb6` (PR #44), after CI and the deploy workflow passed for that commit. No URLs are written here: the repository is public.

## What the owner checked

After the deploy the owner used the live app and gave an overall verdict: **good**. The three test plans that were stored for one week are now one plan, the week switcher moves between the stored weeks, and the app behaves as the owner expected.

The owner did not itemize the check (which device, which screens), and did not report the following, so they are **not confirmed** by this note:

- The owner's own look at the production `plans` table (one plan per week, the removed rows in `plans_merged`). I never read or ran anything against production. `plans_merged` stays until the owner drops it in a later migration, on the owner's word.
- A screen reader pass over the status line after a deletion. It is covered by tests (the status region is in the card from the start and filled afterwards), not by a listening test.

## Scenarios checked by hand

None of the 64 scenarios of this change is tagged `@manual`; every one is covered by a test (`scripts/trace`: 267 of 267 across all capabilities).

## What backs the rest

- 117 shared, 392 server, 384 client and 62 end-to-end-package tests, typecheck and lint, green in CI.
- 139 Playwright tests against the built server with the fake coach and a real Postgres: the journey builds two weeks, moves with the switcher, reloads onto the current week, rebuilds a week after the replace note, deletes and lands on the nearest week, and deletes the last plan; the new states (several plans, twelve plans, after a deletion, the replace note) are in the layout, target-size, reduced-motion, focus and axe checks.
- Bundle: 118,606 bytes gzipped, 924 above the end of the last change (`docs/design-system.md`). A plan record is about 1.9 KB on the test fixture; a real coach answer may be larger.
- No model or prompt change, so no golden-set evals apply at G4.

## Findings

Raised in review (G3 and `/opsx:verify`) and left as is:

1. The switcher is a row of its own inside the summary card, under the heading, not in the header row beside the trash button: at 360 px the longest text ("Week of 28 Dec · 12 of 12") and two arrows do not fit beside it. The owner saw screenshots of the real page and merged it.
2. The timeout hints still say "reload the page to check". After this change a reload opens the current week, so a plan built for another week is found with the switcher. The approved wording was not changed.
3. The e2e journey cannot tell "the nearest week chosen the wrong way", because the stack's cap of 3 coach calls allows only 2 plans plus a rebuild. The unit and `App` tests cover it.
4. The first form's week is taken when the page opens, so a page left open across a Monday midnight keeps last week's Monday until "New plan" is pressed.
