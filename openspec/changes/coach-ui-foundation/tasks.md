## 1. Foundation (first PR)

- [ ] 1.1 Set up Tailwind CSS v4 and shadcn/ui in `client/` (the `@tailwindcss/vite` plugin, the `@` alias, `components.json`, the CLI), record the baseline bundle size, and keep everything green.
  - Done when: the client builds, all 85 client tests and the bundle secret scan pass, the CI clean build is unchanged and green, `client/bundle-baseline.json` holds the gzipped JS and CSS size from before any visual change, and the notes say whether shadcn's current components use Radix or Base UI.
  - Test plan: run `npm run build -w client`, `npm test -w client`, `node scripts/scan-bundle client/dist` and the root checks; a test that renders one shadcn `Button` with its token classes. If setup fights the build, stop and revisit ADR 0007.
  - Scenarios: `design-system/foundation-stays-small-and-clean/*` (baseline recorded here).
- [ ] 1.2 Add the design tokens and their contrast test, and the bundle size check.
  - Done when: `client/src/styles/tokens.css` defines colors, type scale, spacing and radii from mockup H and maps them into the Tailwind theme; `token-pairs.json` lists every text-on-background pair; `scripts/bundle-size` (with `--write-baseline`) fails above baseline plus 60 KB and runs in the CI clean-build job; a source scan test finds no raw colors outside the token file.
  - Test plan: tests for the contrast computation, the raw-color scan and `scripts/bundle-size` (a passing size, a size over budget, a missing baseline), with mutation checks on the thresholds; run the script locally.
  - Scenarios: `design-system/tokens-in-one-place/*`, `design-system/foundation-stays-small-and-clean/*`, `responsive-accessibility/contrast-and-signals/token-pairs-meet-contrast`.
- [ ] 1.3 Add the base components (button, card, badge, alert, input, textarea, label) and the icons, and start `docs/design-system.md`.
  - Done when: the components live in `client/src/components/ui/` styled with tokens only, the route, barbell, moon and warning icons exist as inline SVG components with accessible hiding (`aria-hidden`), `docs/design-system.md` lists the tokens and each component with when to use it, and a test checks every component file is named in that document.
  - Test plan: component tests for variants and states (disabled, focus ring class present); the documentation test with a mutation (remove a component's entry and see it fail).
  - Scenarios: `design-system/documented-components/*`.

## 2. Views, plan view, and states (second PR)

- [ ] 2.1 Add the view state to `App`: the start state, the plan and form views, the transitions, `reset()` on `usePlanRequest`, and focus on the heading of the view that opens.
  - Done when: the table in `design.md` Decision 3 holds, a failure and its field errors clear on every view change, "My plan" and "Build my plan" are disabled while a request runs, "New plan" opens an empty form without a request, "Plan next week" opens the prefilled form as in E1, and the E1 App tests that assumed one page are rewritten with the same tags and intent.
  - Test plan: component tests for each row of the table, the in-flight disabling, the cleared failure, and focus; a test for `reset()`; mutation checks on the transitions and on the order of reset and view change.
  - Scenarios: `app-views/start-state/*`, `app-views/moving-between-views/*`, `app-views/outcomes-of-a-submit/*`, `messages-and-states/earlier-plan-survives-a-failure/*`.
- [ ] 2.2 Rebuild the plan view: summary card, seven day cards in week order with icon tiles and text labels, the safety note first, suggestions, the two buttons.
  - Done when: counts come from the plan's sessions and days, rest days are quieter, combined-load notes sit inside their day, athlete sessions say "from your plan" and recommendations "coach suggestion", long text wraps, the note has `role="note"` and comes first, and no note shows when there is none.
  - Test plan: component tests for each scenario including days stored out of order, two sessions on a day, a 400-character description, null pasted-plan week; page-order assertions for the note; a mutation check on the counting.
  - Scenarios: `plan-presentation/*`, `app-views/labels-named-by-the-e1-specs-keep-their-wording/spec-named-labels-are-present`.
- [ ] 2.3 Restyle loading, building, waking and failure states with the new components.
  - Done when: "Loading your saved plan…", "Building your plan…" and the waking message use `role="status"`, failures use `role="alert"`, "Try again" and "No retries remain today." follow the E1 rules unchanged, reworded messages keep their information, and a test list in the PR names every reworded message.
  - Test plan: the existing `failure-message` tests stay as they are; component tests for roles, the 3 s waking rule (fake timers), the timeout hint, the daily limit, the unreadable-week sentence shown intact.
  - Scenarios: `messages-and-states/loading-building-and-waking-states/*`, `messages-and-states/failures/*`.

## 3. Form view (third PR)

- [ ] 3.1 Rebuild the form layout: four section cards, level radio groups, day buttons, folded optional parts, pain or injury always visible.
  - Done when: the form keeps E1's state, validation and submit; levels are radio groups named "Running level" and "CrossFit level" with none selected on an empty form; day buttons toggle; the three optional parts are `details` and their values are submitted when closed; the E1 form tests that used selects are rewritten with the same tags and intent.
  - Test plan: component tests for each scenario including the folded value being sent and the missing-level message; an accessibility-name test for the groups.
  - Scenarios: `form-presentation/sections-and-folded-optional-parts/*`, `form-presentation/level-choice/*`, `form-presentation/day-buttons/*`.
- [ ] 3.2 Add the goal quick ideas, the progress cue and the pinned action bar.
  - Done when: the four ideas show only while the goal is empty and fill the field on press; the cue reads "N of 4 required answers done" from the same values and rule as the validator and never blocks submitting; the action bar is sticky at the bottom with the safe-area inset and the form has matching bottom padding.
  - Test plan: component tests for chips and for the cue (including a test that compares the cue with the validator over a table of inputs); the visibility check of the button runs in task 4.1.
  - Scenarios: `form-presentation/quick-goal-ideas/*`, `form-presentation/progress-cue/*`.
- [ ] 3.3 Confirm validation and focus parity with E1 on the new markup.
  - Done when: instant messages, focus on the first invalid field on submit, server field errors on their fields, the prefilled form for "Plan next week" and the week 53 error all behave as in E1 and each has its tagged test.
  - Test plan: the E1 validation tests ported to the new controls, plus the week 53 flow from the plan view.
  - Scenarios: `form-presentation/same-validation-and-behavior-as-e1/*`.

## 4. Checks, documentation, and finish (last PR)

- [ ] 4.1 Update the E1 Playwright journey and add the responsive and accessibility checks.
  - Done when: the journey passes on the new controls with the fake coach; Playwright tests cover keyboard-only use, no horizontal overflow and 44 px targets at 360, 768 and 1280 pixels, the primary button inside the viewport at 360 by 740, reduced motion, heading order, and an axe scan (contrast rule off) of each view and state; all run in the CI e2e job.
  - Test plan: run `npm run e2e -w e2e` locally and in CI; mutate a heading level, a target size and a transition to see each check fail.
  - Scenarios: `responsive-accessibility/layout-at-every-width/*`, `responsive-accessibility/touch-targets/*`, `responsive-accessibility/keyboard-use/*`, `responsive-accessibility/structure-for-screen-readers/*`, `responsive-accessibility/reduced-motion/*`, `form-presentation/the-primary-button-stays-in-reach-on-a-phone/*`, `app-views/labels-named-by-the-e1-specs-keep-their-wording/every-e1-scenario-still-passes`.
- [ ] 4.2 Finish `docs/design-system.md` and record the size result.
  - Done when: the document lists the final tokens and components with usage, the size check passes with the final numbers noted, and the open points from the mockup README (chip wording, accent, font, summary card) are recorded as decided.
  - Test plan: the documentation test; read the document against the code.
  - Scenarios: `design-system/documented-components/*`.
- [ ] 4.3 Manual checks on the live app, gate G4 and archive.
  - Done when: after the deploy the owner completes the E1 flow (onboarding, plan, reload, "Plan next week", each error state he can trigger) on a phone and on a desktop browser and does a screen reader pass, with a note in `docs/` and no URLs; `scripts/trace` covers every scenario; `/opsx:verify` has no critical finding; the change is archived.
  - Test plan: the manual run recorded with `@manual` tags; `scripts/trace`; the CI result.
  - Scenarios: `@manual` for the live phone and desktop run and the screen reader pass (`responsive-accessibility/*`, `app-views/*`), and all scenarios (traceability).
