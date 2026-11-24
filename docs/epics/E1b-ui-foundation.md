# Epic E1b: UI foundation

**PRD:** `prd-coach-app.md` §7.1 (E1b), Should item S6. **Decision:** `docs/decisions/0007-ui-direction.md` (spike X4, accepted). **Status:** brief revised after two `design-reviewer` rounds; ready for the owner's gate G0 decision. **OpenSpec change:** `coach-ui-foundation` (to be created with `/opsx:new`, epic: E1b).

This brief is the Definition of Ready document for E1b (`docs/workflow.md` §6). The WHEN/THEN scenarios are written once, in the change's `specs/`.

## 1. Problem and user

E1 works but looks unfinished: plain default styling, one long page, wording written for tests. The owner wants an interface worth showing to other athletes, and every later epic adds screens that would have to be restyled. **User:** the same hybrid athlete as in E1 (today the author), on a phone at the box or a desktop at home.

## 2. Outcome

The E1 flow (onboarding, plan, reload, "Plan next week", every error state) is designed: energetic and bold, readable at a glance, usable one-handed on a phone, with a documented design system that later epics reuse. **No behavior change:** the same fields, rules, requests and results as E1.

## 3. Requirements (edge cases named)

**Views.** One page, no router; the app switches between two views in code:
- **Start state:** while the saved plan is being read, a neutral loading state ("Loading your saved plan…", `role="status"`) shows and neither view is shown, so a user with a plan never sees an empty form first.
- **Plan view** (home): shown when the read finds a saved plan.
- **Form view**: shown when the read finds no plan, and opened from the plan view by "New plan" (empty form) or "Plan next week" (prefilled, exactly as in E1).
- Transitions: a successful submit shows the plan view with the new plan; a failed submit stays in the form view with the failure shown (focus goes to the first invalid field when there is one, otherwise to the failure message); the "My plan" link (present whenever a plan exists) goes back without submitting and is **disabled while a request runs**, so a result never arrives unseen; "Try again" resubmits the last sent onboarding and a success goes to the plan view; a timeout message still says a reload may show the plan, and "My plan" shows the earlier plan, which is consistent; a failed read of the saved plan on start shows the form view with a clear message; while a request is running the form view stays and shows the loading or "waking up the coach" state. Failure messages and server field errors clear on every view change, so an empty form from "New plan" never shows an old alert, and "Plan next week" is prefilled from the **saved** plan's onboarding, never from a failed attempt. Focus moves to the heading of the new view on every view change; when the form view opens with the week 53 field error showing, focus goes to that field. Browser Back is not handled (no router; E5).

- **R1. Design foundation.** Tailwind CSS and shadcn/ui are set up in `client/` (ADR 0007), with design tokens as CSS variables (colors, type scale, spacing, radius); `styles.css` is replaced by the Tailwind entry file; a dark theme only if the chosen mockup needs it. Edge cases: the client build, the `shared` alias, the CI clean build, the bundle secret scan and the client tests keep passing. The only new structural pieces are `client/components.json` and `client/src/components/ui/`. A bundle-size budget is set from the measured size before the change (proposed: at most +60 KB gzipped 🔶).
- **R2. Page structure.** The start state and the two views above, with the transitions above. "New plan" only opens an empty form: no endpoint, rule or cap changes, and the daily cap still applies to every submit. A scenario shows that "New plan" opens a form with every field at its E1 default, with nothing of the earlier plan's onboarding in it, and that it never calls the coach. Edge cases: first visit with no plan; reload with a plan (the plan view, read from the database); a read that is still running; a read that fails (the form view with a message); failed read of the saved plan; a request in progress; a failure after a successful earlier plan (the plan view is still reachable); the "waking up" state when the request is slow.
- **R3. Plan view.** Monday to Sunday as day cards, sorted as E1 sorts them: running and CrossFit told apart by color **and** a text label; the intensity shown; a combined-load note next to the day it belongs to; rest days visibly quiet; "Week N of your running plan" when a pasted plan week is known; sessions with `source: "athlete"` labeled "from your plan" and recommendations labeled "coach suggestion" (spec wording, see R9). The safety note appears whenever the plan has one (the trigger is the note's presence, as in E1), **before** the day cards, with an icon and text, and is never quieter than a day card: it comes first in the page order and its text is at least as large and as high in contrast as a day card's (mechanical checks); "visibly quiet" rest days and "readable at a glance" are judged by the owner (`@manual`). Edge cases: a day with two sessions; a rest day; long session text (it wraps and is never cut off); a plan whose sessions are all the athlete's own with no recommendations; a plan with recommendations and no pasted plan; a plan with a safety note.
- **R4. Form view.** Grouped sections, day pickers that are easy to hit on a phone, the same validation and timing as E1 (instant messages through the shared `validateOnboarding`, no message on an untouched field, focus to the first invalid field on submit, server field errors on their fields), labels for every control. Edge cases: prefilled values for "Plan next week" and the week 53 field error; the 4,000-character paste field stays usable on a phone; "New plan" starts empty.
- **R5. States and messages.** Designed start loading, form loading, "waking up the coach" (after 3 s, rule unchanged), each failure (validation, daily limit, coach unavailable, network, timeout) with its retry rule unchanged (`canRetry`, `limitNote`), and "no retries remain today". Wording may be improved (sentence case, what happened and what to do, no apology) but keeps the information of the current messages, for example that a timed-out plan may still have been saved and a reload checks it. Failure messages stay `role="alert"` (present at the moment of failure) and loading stays `role="status"`. The server's sentence for an unreadable week ("No running sessions found for week N in your pasted plan") is shown intact; only the text the client adds around it may change. The PR lists every reworded message and the test changed for it.
- **R6. Responsive layout.** Mobile first, checked at 360, 768 and 1280 px wide: no horizontal scroll and interactive elements at least 44 px high and wide (this project's own rule; WCAG 2.1 AA does not require it; the elements are links, buttons, native checkboxes and radios by their label area, selects and text fields; running text links inside a sentence are exempt), both checked mechanically in Playwright.
- **R7. Accessibility baseline (WCAG 2.1 AA 🔶).** Color contrast of every token pair (4.5:1 for text, 3:1 for large text and interface parts, computed in a test over the tokens), visible focus, keyboard-only use of the whole flow (a Playwright test: tab order through the form, Enter submits, focus after each view change), a label on every control, color never the only signal, reduced motion respected (animations are off under `prefers-reduced-motion`, checked in a Playwright test with emulated media), a logical heading order (a test), errors announced to screen readers.
- **R8. Design system documentation.** Tokens, components and when to use them are written in `docs/design-system.md`.
- **R9. No change in what the app does.** Same fields, rules, requests and results as E1; every E1 scenario passes. The views in R2 change how the page is navigated, not what any request does. Labels named by the E1 specs keep their wording (a case-insensitive match is fine) and only their look may change: "Plan next week", "waking up the coach" (and its 3 s rule), "from your plan", "coach suggestion", "daily limit reached", "no retries remain today", the rest day display, the pasted-plan week number, the safety note when present, the unreadable-week sentence from the server, and "a retry is offered" after `coach_unavailable` and `invalid_coach_response`. The accessible names the E1 tests use (the "Your plan" heading, "Coach suggestions" list, `role="note"` "Safety note") are kept, because screen reader users rely on them. Anything else the specs name is checked against its spec before it changes; if a spec has to change, that is a new change, not an edit.

## 4. Out of scope

New features and endpoints, any server or database change, highlighting today in the week (a plan has no dates; a later idea), a router and browser Back (E5), a login (E7), a dark theme unless the chosen mockup needs it (then it is part of this change's specs, because the mockups are chosen before them, see section 5), illustrations or a logo beyond text, new training advice or copy about training, animation other than short motion that responds to an action (opening, confirming), and any change to the E1 scenarios.

## 5. Design inputs

- **Direction:** energetic and bold (owner), high contrast, one strong accent, large type for the day and the session; the accessibility floor in R7 wins over style.
- **Scaffolding (first task of the change, after the mockups are chosen):** Tailwind and shadcn setup in the existing client, with the build, tests and bundle scan still green (CLAUDE.md learning: scaffolding is part of the change).
- **Mockups (before the Spec PR, right after G0):** two or three static HTML mockups built from shadcn pieces, with ideas from the 21st.dev gallery (ideas only; its blocks state no license, so none is copied without checking), screenshotted with Playwright at 360 and 1280 px. They cover the plan view, the form view, the safety note, the rest day, the waking state and one error state. The owner picks one; the chosen mockup and its screenshots are saved under `docs/design/` as an input to the specs, so a dark theme, the token set and the safety note's treatment are known when the specs freeze at G1. Acceptance: contrast of the chosen tokens passes R7 and the safety note is not quieter than a day card. Tools: `frontend-design` to build; `design:design-critique`, `design:accessibility-review` and `design:ux-copy` to review.
- **Structure:** `client/src/components/ui/` for shadcn components; feature components stay where they are.
- **Contracts:** the shared schemas and the API are untouched.

## 6. Test strategy

- The 85 client tests: tests that assert exact wording and tests that assume the form and the plan are on one page (for example the failure-keeps-the-plan, replaces-the-shown-plan and nothing-changes-before-submitting tests) are rewritten for the views, **with the same `@spec` tags and the same intent** (the plan is observed through "My plan"); every rewritten test is listed in the PR, and none is loosened to hide a change.
- New component tests for the views and states (R2 to R5) using roles and labels, not class names.
- Playwright (in `e2e/`, against the fake coach): the E1 journey unchanged; keyboard walkthrough, no horizontal scroll and target sizes at the three widths, reduced motion, heading order (R6, R7); axe for the rules jsdom can run. A token contrast test (R7).
- `design:accessibility-review` on screenshots, and a screen reader pass by the owner (`@manual`); automated tools find only part of the problems.
- Screenshots at 360, 768 and 1280 px reviewed by the owner (`@manual`); no pixel comparison.
- The bundle secret scan passes; the deploy smoke test is unchanged; no evals (no AI behavior change).
- After the deploy, the owner runs the E1 flow on a phone and a desktop browser on the live app (`@manual`).

## 7. Risks (PRD §11)

No new PRD risk. Watch: the Tailwind and shadcn setup fighting the workspace build (the `shared` alias, the CI clean build, the bundle scan); a bold look that lowers contrast or relies on color alone; restyling that quietly changes behavior (guarded by the unchanged E1 tests and R9); scope growth (ideas about screens that do not exist yet go to later epics).

## 8. Dependencies

E1 (done) and spike X4 (ADR 0007, accepted). No account or secret is needed. 21st.dev is only browsed. The Playwright setup in `e2e/` already exists.

## 9. Things to verify during the epic

These are gates of the setup task; failing one triggers the "Revisit" clause of ADR 0007.
- Tailwind v4 with the `@tailwindcss/vite` plugin works with Vite 8 and Vitest in this workspace; the shadcn CLI writes `components.json` and files into `client/` correctly in an npm workspace.
- Whether new shadcn components are built on Radix or on Base UI today, and that the generated code compiles with React 19 and strict TypeScript.
- An axe setup that runs in the Playwright tests (jsdom cannot check contrast; the token test covers it) and its false-positive rate.
- Font: a system stack or one self-hosted family (no third-party font request).
- The client bundle size before the change, to fix the budget in R1.

## 10. Decisions (owner)

- Decided in the G0 discussion (2026-11-24): the two views with "New plan" as an empty form; a dark theme only if the chosen mockup needs it; mockups first; "highlight today" dropped.
- Chosen mockup (2026-11-24): H, light only; dark is a later change; see `docs/design/README.md`.
- Mockups are done after G0 and before the Spec PR (so nothing conditional is left in the frozen specs).
- The bundle budget in R1 is a proposal; it is fixed by the owner after the size is measured, and the specs state the figure then.
- `docs/design-system.md` is documentation and is not tested.
- Still to approve at G0: this revised brief, including R9's rule that spec-named labels keep their wording, and the bundle budget proposal in R1 🔶.
