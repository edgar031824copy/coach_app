# Epic E1b: UI foundation

**PRD:** `prd-coach-app.md` §7.1 (E1b), Should item S6. **Decision:** `docs/decisions/0007-ui-direction.md` (spike X4, accepted). **Status:** draft brief, not yet through gate G0. **OpenSpec change:** `coach-ui-foundation` (to be created with `/opsx:new`, epic: E1b).

This brief is the Definition of Ready document for E1b (`docs/workflow.md` §6). The WHEN/THEN scenarios are written once, in the change's `specs/`.

## 1. Problem and user

E1 works but looks unfinished: plain default styling, one long page, wording written for tests. The owner wants an interface worth showing to other athletes, and every later epic adds screens that would have to be restyled. **User:** the same hybrid athlete as in E1 (today the author), on a phone at the box or a desktop at home.

## 2. Outcome

The E1 flow (onboarding, plan, reload, "Plan next week", every error state) is designed: energetic and bold, readable at a glance, usable one-handed on a phone, with a documented design system that later epics reuse. **No behavior change:** the same fields, rules, requests and results as E1.

## 3. Requirements (edge cases named)

- **R1. Design foundation.** Tailwind CSS and shadcn/ui are set up in `client/` (ADR 0007), with design tokens as CSS variables (colors, type scale, spacing, radius) and light and dark themes if the chosen mockup needs both. Edge cases: the client build, the `shared` alias, the bundle secret scan and the client tests keep passing; no runtime dependency is added beyond what the chosen components need.
- **R2. Page structure.** One page. The plan is the home screen once one exists (the app already reads `GET /api/plan` on start); the onboarding form is a step: shown when there is no plan, and reachable from the plan ("New plan" and "Plan next week"). Edge cases: the first visit with no plan, a reload with a plan, a failed read of the saved plan (the form shows with a clear message), a plan request in progress.
- **R3. Plan view.** Monday to Sunday as day cards: today highlighted when the plan's week contains today (a plan has no dates, so only when the app can tell; otherwise no highlight), running and CrossFit told apart by color **and** a text label, the intensity shown, combined-load notes next to the day they belong to, rest days visibly quiet, the safety note prominent when pain was reported, coach suggestions labeled as suggestions and the athlete's own sessions labeled as theirs. Edge cases: a day with two sessions, a rest day, a long session text, a plan with a safety note, a pasted plan week with no added sessions.
- **R4. Onboarding form.** Grouped sections, day pickers that are easy to hit on a phone, instant field messages in plain language, the same validation as E1 (the shared `validateOnboarding`), keyboard and screen reader labels. Edge cases: every server field error shows on its field, prefilled values for "Plan next week" keep working, the 4,000-character paste field stays usable on a phone.
- **R5. States and messages.** Designed loading, "waking up the coach" (after 3 s, unchanged rule), each failure (validation, daily limit, coach unavailable, network, timeout) with its retry rule, and the "no retries remain today" case. Wording: sentence case, says what happened and what to do, no apology. Edge cases: a failure after a successful earlier plan keeps the earlier plan visible.
- **R6. Responsive layout.** Mobile first, checked at 360 px, 768 px and 1280 px wide; no horizontal scroll; touch targets at least 44 px.
- **R7. Accessibility baseline (WCAG 2.1 AA 🔶).** Contrast, visible focus, keyboard-only use of the whole flow, labels for every control, color never the only signal, reduced-motion respected, a logical heading order. Edge cases: errors announced to screen readers, focus moves to the first invalid field on submit (E1 behavior is kept).
- **R8. Design system documentation.** The tokens, the components and when to use them are documented in the repo (`docs/design-system.md`), so later epics reuse them. 
- **R9. No behavior change.** Every E1 scenario still passes. Edge cases: the E1 specs name two literal UI texts, the "waking up the coach" state and "rest day" wording; the design may change their look, and any wording change that a scenario names is checked against its spec first. If a spec has to change, that is a new change, not an edit.

## 4. Out of scope

New features, new endpoints, any server or database change, new copy about training advice, routes and multi-page navigation (E5), a login (E7), dark mode unless the chosen mockup needs it, illustrations or a logo beyond text, animation beyond one orchestrated moment and responses to user actions.

## 5. Design inputs

- **Direction:** energetic and bold (owner), high contrast, one strong accent, large type for the day and the session; the accessibility floor in R7 wins over style.
- **First task of the change: mockups.** Two or three static HTML mockups of the plan home and the form, built from shadcn pieces with ideas from the 21st.dev gallery (ideas only; its blocks have no stated license, so none is copied without checking it), screenshotted with Playwright at phone and desktop width. The owner picks one before any screen changes. Tools: the `frontend-design` skill to build, `design:design-critique`, `design:accessibility-review` and `design:ux-copy` to review.
- **Structure:** `client/src/components/ui/` for shadcn components, feature components stay where they are; tokens in the Tailwind theme and `index.css`.
- **No contract change:** the shared schemas and the API are untouched.

## 6. Test strategy

- The existing client tests (85) keep passing; tests that assert exact wording are updated deliberately and listed in the PR, never loosened to hide a change.
- New component tests for the new states (R3 to R5) using roles and labels, not class names.
- **Accessibility checks:** an automated axe run on the form, the plan view and each error state (a test dependency to verify, see section 9), plus a keyboard-only walkthrough, plus `design:accessibility-review` on screenshots. Automated tools find only part of the problems; the walkthrough is `@manual`.
- **Responsive and visual:** Playwright screenshots at 360, 768 and 1280 px, reviewed by the owner (`@manual`); not a pass/fail pixel comparison.
- The E1 end-to-end journey passes unchanged on the new UI; the bundle secret scan passes; no evals (no AI behavior change).
- The deploy runs as usual on merge; the owner runs the E1 flow on a phone and a desktop browser on the live app (`@manual`).

## 7. Risks (PRD §11)

No new PRD risk. Watch: the Tailwind and shadcn setup fighting the workspace build (the `shared` alias, the CI clean build, the bundle scan); a bold look that lowers contrast or relies on color alone; restyling that quietly changes behavior (guarded by the unchanged E1 tests); scope growth (every new idea about screens that do not exist yet goes to a later epic).

## 8. Dependencies

E1 (done) and spike X4 (ADR 0007, accepted). No account or secret is needed. 21st.dev is only browsed.

## 9. Things to verify during the epic

- Tailwind v4 with the `@tailwindcss/vite` plugin works with Vite 8 and Vitest in this workspace; the shadcn CLI writes `components.json` and files into `client/` correctly in an npm workspace.
- Whether new shadcn components are built on Radix or on Base UI today, and that the generated code compiles with React 19 and strict TypeScript.
- A test-time axe tool that works with Vitest and jsdom (or axe inside the Playwright tests), and its false-positive rate.
- Font choice: a system stack or one self-hosted family (no third-party font request, which would add a host to every page load and a privacy question).
- The client bundle size before and after.

## 10. Decisions needed from the owner (G0)

- Approve the brief, including R9 (wording named by a spec is checked first) and the mockup-first step.
- Dark mode: only if the chosen mockup needs it (proposed), or required.
- The "New plan" action: should the athlete be able to start the form over from the plan (proposed yes, since the form is a step), given that E1 has no "delete plan" and each new plan costs a coach call?
