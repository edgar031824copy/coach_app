## Context

The client (`client/`) is one React 19 page built with Vite 8 and tested with Vitest and Testing Library (85 tests) plus the E1 Playwright journey in `e2e/`. `App` renders the form, then the plan, with `usePlanRequest` holding the request state and `PlanView` and `OnboardingForm` doing the rest. There is one plain stylesheet. Direction is fixed by ADR 0007 (shadcn/ui on Tailwind) and by mockup H in `docs/design/`. See proposal.md for motivation. The server, the schemas in `shared/` and the API do not change.

## Goals / Non-Goals

**Goals:** the two-view page, the redesigned plan and form views, restyled states, tokens and a small component set, accessibility and responsive checks that run automatically where a machine can judge, documentation, a size budget.

**Non-Goals:** a router, browser Back, a dark theme (the tokens are written so one can be added), photos, a font download, any new endpoint or field, a client state library.

## Decisions

### 1. Tailwind v4 and a small shadcn component set

Tailwind CSS v4 through the `@tailwindcss/vite` plugin; shadcn/ui components copied into `client/src/components/ui/` (button, card, badge, alert, input, textarea, label) with `class-variance-authority`, `clsx`, `tailwind-merge` and `@radix-ui/react-slot` (button). The `@` alias maps to `client/src`. **To verify in task 1.1:** that the CLI works in this npm workspace, whether current shadcn components use Radix or Base UI, and that the output compiles with React 19 and strict TypeScript. If setup fights the build, the ADR's "Revisit" clause applies.
*Alternatives:* plain CSS with tokens (more hand-built work for later epics); Mantine (heavier, harder to push to a custom look); copying 21st.dev blocks (license not stated, paid retrieval).

### 2. Tokens

One file, `client/src/styles/tokens.css`, holds CSS variables for colors (page, card, text, muted text, border, accent and its text, running, CrossFit, alert), the type scale, spacing steps and radii, mapped into Tailwind's theme. Values start from mockup H (accent `#2563EB`, system UI font stack, no font files). A second file, `client/src/styles/token-pairs.json`, lists every text-on-background pair with its minimum ratio; a test computes the ratios. A dark theme later only adds a second set of variable values.

### 3. Views are one piece of state, not a router

`App` derives the view from existing state: `start` while the saved read runs, `plan` when a plan is shown and the athlete has not opened the form, `form` otherwise. A `formOpen` flag and the existing seed counter (`n`, which remounts the form) carry the rest.

| Event | Result |
|---|---|
| Read ends with a plan | `plan` view |
| Read ends with none or fails | `form` view (failed read adds the message) |
| "New plan" | `form` with `initial` undefined, seed counter + 1, failure cleared |
| "Plan next week" | `form` with `initial = nextWeekSeed(shown.onboarding)`, counter + 1, failure cleared |
| "My plan" (enabled only when a plan exists and no request runs) | `plan`, failure cleared |
| Submit succeeds | `plan` with the new plan |
| Submit fails | stays `form`, failure shown |

`usePlanRequest` gains a `reset()` that returns its state to idle, and the failed-read message is cleared with it: both are cleared on every view change and when a submit succeeds, so neither follows the athlete.

**Headings:** the page keeps one `h1` (the app name "Hybrid Coach", in the header); each view has one `h2` as its main heading ("Your plan" in the plan view, "New plan" in the form view, `tabIndex={-1}`); the day names are `h3`. This is E1's structure with the form given its own `h2`.

**Focus (one rule, replacing E1's goal-field focus):** the `initial`-prefill effect in `OnboardingForm` that focuses the goal field is removed. When a view opens because of an athlete action, `App` focuses that view's `h2`, except that when the form opens prefilled and the validator reports an invalid field ("Plan next week" at week 52, giving week 53), the form focuses that first invalid field and `App` does not touch focus (`App` computes this with the same `validateOnboarding` call before choosing). The first view after the page opens never takes focus. After a failed submit the form focuses the first field with a server error, otherwise the failure notice (`role="alert"`, `tabIndex={-1}`). On a submit that is invalid on the client, E1's focus on the first invalid field stays. A folded part that contains an invalid field opens before that field is focused.
*Alternatives:* a router (E5 needs it, E1b does not; browser Back stays unhandled); keeping form and plan on one page (the research and the owner's choice reject a long scroll on phones).

### 4. Components and markup

- **Plan view:** `PlanSummary` (counts from `plan.days`), `DayCard` (a card per day; rest days use a quieter variant), `SessionRow` (icon tile + discipline text + description + intensity badge + "from your plan" badge), `SafetyNote` (an `Alert` with `role="note"` and the text, rendered before the summary), `Suggestions`. Seven cards are rendered from the same Monday to Sunday list as E1. Icons are three inline SVGs in `components/icons.tsx` (route, barbell, moon) plus a warning triangle; no icon library.
- **Form view:** the form keeps its state and validation (`validateOnboarding` from `shared`, touched fields, focus on the first invalid field). Only the markup changes: section cards; levels as native radio inputs inside a `fieldset` named "Running level" or "CrossFit level" and styled as a segmented control (no Radix radio dependency); day buttons as native checkboxes styled as buttons; the three optional parts as native `details` elements (values stay in form state, so closing keeps them); goal ideas as buttons shown while the goal is empty; the progress cue computed from the same field values the validator uses (a count of four, presentation only).
- **Bottom bar:** the action bar is `position: sticky; bottom: 0` inside the form with the safe-area inset, so it stays visible while scrolling on a phone and sits under the form on a wide screen.
- **Messages:** `FailureNotice` and the status lines keep their text sources (`describeFailure`, the waking timer); only their markup and classes change. The notice gains `tabIndex={-1}` so it can take focus after a failure. The progress cue is plain text read with the form, not an `aria-live` region.
- **Summary wording:** the summary shows the number and a label: "run" or "runs", "CrossFit", "rest day" or "rest days" (singular when the number is 1).
- **Touch and mouse sizes:** controls are 44 px high with touch and 36 px with a mouse (a `pointer: fine` media query), widths at least 24 px; the checks run with touch emulation at 360 and 768 and with a mouse at 1280.

### 5. Checks a machine can run

- Vitest: view transitions and outcomes, labels and roles, counts, folded values, chips, progress cue, token contrast (from `token-pairs.json`), no raw colors outside the token file (a source scan), every `components/ui` file named in `docs/design-system.md`.
- Playwright in `e2e/` against the fake coach: the E1 journey on the new controls; keyboard-only journey; no horizontal overflow at 360, 768 and 1280, 44 px targets with touch emulation at 360 and 768 and 36 px with a mouse at 1280; the primary button inside the viewport at 360 by 740; reduced motion (emulated media: no running animation, no transition); heading order; `@axe-core/playwright` on each view and state (contrast rule disabled there, covered by the token test), plus checks that a long description at 360 does not overflow or clip and that every focusable element shows a visible ring. **To verify:** the axe package works with the existing Playwright version.
- Bundle size: measured by hand, not by a script. Task 1.1 measures the gzipped JS plus CSS of `client/dist` before any dependency is added and notes it in its PR (command: build, then gzip each file in `client/dist/assets` and add the sizes); task 4.3 measures again and notes the difference against the 60 KB 🔶 budget (the owner confirms the figure at G1). No new script and no CI change.
- Manual (`@manual`): the owner runs the E1 flow on a phone and a desktop browser, a screen reader pass, and reviews screenshots at 360, 768 and 1280.

### 6. E1 tests

Tests that assumed form and plan on one page, and the select-based level tests, are rewritten for the views and the radio groups, keeping their `@spec` tags and intent, and listed in the PR. Tests of unchanged parts (`api`, `use-plan-request`, `failure-message`, `seed`, `bundle-scan`) stay as they are, apart from the added `reset()` test.

## Risks / Trade-offs

- **Tailwind or shadcn setup fights the workspace build** (the `shared` alias, CI clean build, bundle scan) → task 1.1 is a gate: the build, the 85 tests and the scan must pass before anything else; otherwise revisit ADR 0007.
- **Restyling changes behavior** → R9's list of spec-named labels has its own test; the unchanged E1 tests and the E1 E2E journey stay green.
- **A bold look lowers contrast** → the contrast test, axe, and the owner's review of screenshots.
- **Native `details` and styled radios behave differently across browsers** → covered by the keyboard test in Chromium; the owner checks a phone.
- **Hiding optional parts hides fields the athlete might want** → only optional ones are folded; pain or injury stays visible.
- **Sticky action bar covers content on short screens** → the form gets bottom padding equal to the bar; the 360 by 740 check.
- **The progress cue could disagree with validation** → both use the same field values and rule for "a training day or a pasted plan"; a test compares them.
- **Size budget**: Tailwind's CSS is small after purging; the main risk is a heavy dependency, caught by the manual size check at the end.

## Migration Plan

No data or API change. Merge task groups as they pass; each deploys through the normal workflow, and the live client changes with the first merge that touches screens. Rollback is the usual manual redeploy of the previous commit.

## Open Questions

- Whether a self-hosted font replaces the system stack later (no effect on the specs).
- Whether the summary card earns its place after the owner uses it; removing it later is a small change.
