## 1. Foundation (first PR)

- [ ] 1.1 Measure the bundle size, then set up Tailwind CSS v4 and shadcn/ui in `client/`, keeping everything green.
  - Done when: **first**, before any dependency is added, the gzipped size of the JS and CSS in `client/dist` is measured and written in the PR; **then** Tailwind and `@tailwindcss/vite`, the `@` alias, `components.json` and the shadcn CLI are set up; the client builds, all 85 client tests and the bundle secret scan pass, the CI clean build is unchanged and green; the notes say whether shadcn's current components use Radix or Base UI.
  - Test plan: run `npm run build -w client`, `npm test -w client`, `node scripts/scan-bundle client/dist` and the root checks; a test that renders one shadcn `Button`. If setup fights the build, stop and revisit ADR 0007.
  - Scenarios: `design-system/foundation-stays-small-and-clean/bundle-scan-still-passes`.
- [ ] 1.2 Add the design tokens and their contrast test.
  - Done when: `client/src/styles/tokens.css` defines colors, type scale, spacing and radii from mockup H and maps them into the Tailwind theme; `token-pairs.json` lists every text-on-background pair;, and a source scan test finds no raw colors outside the token file.
  - Test plan: tests for the contrast computation and the raw-color scan, with mutations on the ratios.
  - Scenarios: `design-system/tokens-in-one-place/*`, `responsive-accessibility/contrast-and-signals/token-pairs-meet-contrast`.
- [ ] 1.3 Add the base components (button, card, badge, alert, input, textarea, label) and the icons, and start `docs/design-system.md`.
  - Done when: the components live in `client/src/components/ui/` styled with tokens only; the route, barbell, moon and warning icons are inline SVG components with `aria-hidden`; `docs/design-system.md` lists the tokens and each component with when to use it; a test checks every component file is named in that document.
  - Test plan: component tests for variants and states; the documentation test with a mutation (remove an entry and see it fail).
  - Scenarios: `design-system/documented-components/*`.

## 2. Views, plan view, and states (second PR)

- [ ] 2.1 Add the view state to `App`: the start state, the plan and form views, the transitions, and `reset()` on `usePlanRequest` (also clearing the failed-read message).
  - Done when: the table in `design.md` Decision 3 holds; a failure, field errors and the failed-read message clear on every view change and when a submit succeeds; "My plan" and "Build my plan" are disabled while a request runs; "New plan" opens an empty form without a request; "Plan next week" opens the prefilled form from the saved plan as in E1; the E1 App tests that assumed one page are rewritten with the same tags and intent.
  - Test plan: component tests for each row of the table, the in-flight disabling, the cleared messages, Try again, and "Plan next week" after a failed submit; a test for `reset()`; mutation checks on the transitions and on clearing.
  - Scenarios: `app-views/start-state/*` (except the focus scenario), `app-views/moving-between-views/*` (except the focus scenarios), `app-views/outcomes-of-a-submit/*` (except the focus scenario), `messages-and-states/earlier-plan-survives-a-failure/*`.
- [ ] 2.2 Add the heading structure and the focus rule.
  - Done when: one `h1` (the app name), an `h2` per view ("Your plan", "New plan", `tabIndex={-1}`), `h3` days; the goal-field focus effect in `OnboardingForm` is removed; focus goes to the opened view's `h2` after an athlete action, to the first invalid field when the form opens prefilled and invalid, to the first server-error field or else the failure notice after a failed submit, and nowhere on page open.
  - Test plan: component tests for each focus case including week 53 after "Plan next week", a prefilled valid form, a failure with no field, and page open; mutation checks (remove the exception, swap the order).
  - Scenarios: `app-views/start-state/opening-the-page-does-not-move-focus`, `app-views/moving-between-views/focus-follows-the-view`, `app-views/moving-between-views/focus-goes-to-the-first-error-when-the-form-opens-with-one`, `app-views/outcomes-of-a-submit/a-failure-moves-focus`.
- [ ] 2.3 Rebuild the plan view: summary card, seven day cards in week order with icon tiles and text labels, the safety note first, suggestions, the two buttons.
  - Done when: counts come from the plan's sessions and days with the singular and plural labels in the spec; rest days use the quieter variant; combined-load notes sit inside their day; athlete sessions say "from your plan" and recommendations "coach suggestion"; long text wraps; the note has `role="note"`, the name "Safety note", an icon and text, and comes first; no note shows when there is none; accessible names are kept ("Your plan", "Coach suggestions", one item per day).
  - Test plan: component tests for each scenario including days stored out of order, two sessions on a day, only athlete sessions, recommendations without a pasted plan, a 400-character description, a null week; page-order and accessible-name assertions; a mutation check on the counting and on the note order.
  - Scenarios: `plan-presentation/*` (the long-text layout check runs in 4.2), `app-views/labels-named-by-the-e1-specs-keep-their-wording/*`, `responsive-accessibility/contrast-and-signals/errors-and-the-safety-note-carry-text` (note part).
- [ ] 2.4 Restyle loading, building, waking and failure states with the new components.
  - Done when: "Loading your saved plan…", "Building your plan…" and the waking message use `role="status"`; failures use `role="alert"`; "Try again" and "No retries remain today." follow the E1 rules; reworded messages keep their information, and the PR lists every reworded message.
  - Test plan: the existing `failure-message` tests stay; component tests for roles, the 3 s waking rule (fake timers), each retry case, the validation failure, the timeout hint, the daily limit, and the unreadable-week sentence shown intact.
  - Scenarios: `messages-and-states/loading-building-and-waking-states/*`, `messages-and-states/failures/*`.

## 3. Form view (third PR)

- [ ] 3.1 Rebuild the form layout: four section cards, level radio groups, day buttons, folded optional parts, pain or injury always visible.
  - Done when: the form keeps E1's state, validation and submit; levels are radio groups named "Running level" and "CrossFit level" with none selected on an empty form; day buttons toggle; the three optional parts are `details` and their values are submitted when closed; the E1 form tests that used selects are rewritten with the same tags and intent.
  - Test plan: component tests for each scenario including the folded value being sent and the missing-level message; accessible-name tests for the groups.
  - Scenarios: `form-presentation/sections-and-folded-optional-parts/*` (except the folded-error scenario), `form-presentation/level-choice/*`, `form-presentation/day-buttons/*`.
- [ ] 3.2 Add the goal quick ideas, the progress cue, the pinned action bar, and opening a folded part that holds an error.
  - Done when: the four ideas show only while the goal is empty and fill the field on press; the cue reads "N of 4 required answers done" from the same values and rule as the validator (including the pasted-plan route) and never blocks submitting; the action bar is sticky with the safe-area inset and the form has matching bottom padding; a submit with an invalid value inside a closed optional part opens that part and focuses the field.
  - Test plan: component tests for chips, for the cue (a table test comparing cue and validator), and for the folded error; mutation checks.
  - Scenarios: `form-presentation/quick-goal-ideas/*`, `form-presentation/progress-cue/*`, `form-presentation/sections-and-folded-optional-parts/an-error-inside-a-folded-part-is-never-hidden`.
- [ ] 3.3 Confirm validation and focus parity with E1 on the new markup.
  - Done when: instant messages, no message on an untouched field, focus on the first invalid field on submit, server field errors on their fields, the prefilled form for "Plan next week" and the week 53 error all behave as in E1 and each has its tagged test; every error shows words (`errors-and-the-safety-note-carry-text`, error part).
  - Test plan: the E1 validation tests ported to the new controls, plus the week 53 flow from the plan view.
  - Scenarios: `form-presentation/same-validation-and-behavior-as-e1/*`, `responsive-accessibility/contrast-and-signals/errors-and-the-safety-note-carry-text` (error part).

## 4. Checks, documentation, and finish (last PR)

- [ ] 4.1 Update the E1 Playwright journey and add the layout, target-size and keyboard checks.
  - Done when: the journey passes on the new controls with the fake coach; Playwright tests cover no horizontal overflow at 360, 768 and 1280 for every view and state, target sizes (44 px with touch emulation at 360 and 768, 36 by 24 px with a mouse at 1280), the keyboard-only journey, and visible focus rings; all run in the CI e2e job.
  - Test plan: run `npm run e2e -w e2e` locally and in CI; mutate a target size and a focus style to see each check fail.
  - Scenarios: `responsive-accessibility/layout-at-every-width/*`, `responsive-accessibility/touch-targets/*`, `responsive-accessibility/keyboard-use/*`.
- [ ] 4.2 Add the remaining Playwright checks: the reachable primary button, reduced motion, headings, long text, and axe.
  - Done when: tests show "Build my plan" inside the viewport at 360 by 740 scrolled to the top; no running animation or transition under emulated reduced motion; the heading levels 1, 2, 3 without gaps and the two level groups named; a 400-character session description neither overflows nor clips at 360; an axe scan (contrast rule off) of each view and state finds nothing.
  - Test plan: run locally and in CI; mutate a heading level and a transition to see the checks fail. Verify first that `@axe-core/playwright` works with the installed Playwright; if not, say so and choose another scanner.
  - Scenarios: `form-presentation/the-primary-button-stays-in-reach-on-a-phone/*`, `responsive-accessibility/reduced-motion/*`, `responsive-accessibility/structure-for-screen-readers/*`, `plan-presentation/one-card-per-day-in-week-order/*` (layout part), `plan-presentation/sessions-are-identified-by-text/long-text-is-not-cut-off`.
- [ ] 4.3 Finish `docs/design-system.md` and record the size result.
  - Done when: the document lists the final tokens and components with usage; the bundle size is measured again and the difference from the number in task 1.1's PR is noted against the 60 KB 🔶 budget; the open points from the mockup README (chip wording, accent, font, summary card) are recorded as decided, and the README's font line is corrected.
  - Test plan: the documentation test; read the document against the code.
  - Scenarios: `design-system/documented-components/*`, `design-system/foundation-stays-small-and-clean/size-budget` (checked by hand).
- [ ] 4.4 Manual checks on the live app, gate G4 and archive.
  - Done when: after the deploy the owner completes the E1 flow (onboarding, plan, reload, "Plan next week", each error state he can trigger) on a phone and on a desktop browser, judges the rest day and the safety note by eye, and does a screen reader pass, with a note in `docs/` and no URLs; `scripts/trace` covers every scenario; `/opsx:verify` has no critical finding; the change is archived.
  - Test plan: the manual run recorded with `@manual` tags; `scripts/trace`; the CI result.
  - Scenarios: `@manual` for `responsive-accessibility/contrast-and-signals/rest-days-read-as-quieter`, the live phone and desktop run, and the screen reader pass; all scenarios (traceability).
