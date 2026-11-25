# E1b manual checks (task 4.4)

Change `coach-ui-foundation` (epic E1b). Checked on **2026-11-25** against `master` at `5edb4e8` (PR #34), after the deploy workflow ran every step and passed (guard for the newest commit, migrate, Render, client build and bundle scan, Vercel, smoke test). No URLs are written here: the repository is public.

## What the owner checked

After the deploy the owner used the live app and reported it good ("yeah is good"), which accepts the manual part of gate G4. The report was an overall verdict: it was not itemized by device or by check, so this note does **not** claim a separate result for the phone run, the desktop run or a screen reader pass. What backs those up is automated and listed below.

Scenarios that are checked by hand:

- `@manual(responsive-accessibility/contrast-and-signals/rest-days-read-as-quieter)`: a rest day's card is visibly quieter than a training day's (dashed, flat, no shadow, a moon tile and the muted text color). Covered by the owner's overall verdict on the look of the plan view; the unit tests check the dashed variant and the contrast of the colors used.
- `@manual(design-system/foundation-stays-small-and-clean/size-budget)`: gzip -9 of `client/dist/assets` (JavaScript plus CSS) was **98,064 bytes** before any dependency of this change and is **116,121 bytes** at the end (111,523 plus 4,598), so **+18,057 bytes (18.1 KB)** against the 60 KB budget. Method and figures: `docs/design-system.md`, section Bundle size.
- `@manual(app-views/labels-named-by-the-e1-specs-keep-their-wording/e1-test-tags-are-kept)`: this scenario is the third check of `scripts/trace`, which fails when a `@spec` tag that exists on `master` is missing from the branch. It was run at the archive commit and reported no missing and no unknown tag.

## What backs the rest

- 244 client tests, 321 shared, 75 server and 62 end-to-end-package tests (`npm test`), typecheck and lint, all green in CI.
- 83 Playwright tests in CI against the built server with the fake coach: the E1 journey; layout at 360, 768 and 1280 px for 13 views and states; every control at least 44 by 44 with touch and 36 by 24 with a mouse; a keyboard-only journey; a visible focus ring on every stop; the reachable button at 360 by 740; reduced motion; headings and names; a 400-character description; and an axe scan of every view and state (contrast rule off, covered by the token test), which found no violation.
- No model or prompt change in E1b, so no golden-set evals apply at G4.

## Findings from the owner's pass

Both are new behavior, not defects against the approved E1b specs, so E1b's scope stays frozen and they become a follow-up change (not a new epic):

1. A plan made without a pasted running plan shows no week. Decided: show the calendar week and the date the plan was made for every plan, and let "Plan next week" move to the following Monday.
2. A way to delete a plan. Decided: a "Delete this plan" button with a confirmation, which deletes only the shown plan (earlier ones stay stored), does not refund the daily call count, and then opens the empty form.

## Defects the automated checks found and fixed during E1b

- No focus ring on inputs, textareas, chips, folded-part titles and the main button (Tailwind 4's `outline-none` sets the outline style to none). Fixed; a unit test forbids it.
- A color transition still ran with reduced motion asked for. Fixed with one rule in `index.css`, with a unit guard.
- The plan view showed list numbers and bullets (Tailwind's reset was off). Fixed in the group 2 review, then the reset was enabled page-wide in task 3.1.
- The day buttons were 36.8 px wide at 360 px (the spec needs 44). Fixed by letting each row use the full card width.
