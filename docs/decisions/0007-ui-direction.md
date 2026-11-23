# 0007. UI direction for E1b (spike X4)

**Status:** Proposed
**Date:** 2026-11-23

## Context

E1 shipped working but unstyled screens. E1b applies a designed interface (PRD 1.8, spike X4). The owner wants the app to look and feel good, and later epics will add screens (suggestions, plan view), so the choices below are paid for many times.

What was looked at (desk research and the repository only; **nothing was installed or tried by hand**, and vendor claims are unverified):
- **Plan screens of running apps**, from review and screenshot-library pages: Runna (a "Week 1/6" header and a "Today's workouts" section; reviewers praise that the plan states when, how far and what pace; a user asks for a weekly easy/moderate/hard breakdown), Run With Hal ("Planned This Week" with daily status), RunMotion (a week with a "weeks until your goal" note), Intervals.icu mobile (a vertical list of only the days that have workouts instead of a grid), TrainingPeaks (users find its mobile graphs hard to read and miss drag and drop), Garmin Connect (a calendar where a day shows its workout at a glance; users ask for week notes on mobile). Not covered by the sources found: Strava, Nike Run Club, Whoop, Fitbod.
- **Component approaches:** shadcn/ui on Radix or Base UI (strong accessibility defaults, needs Tailwind and a copy-in workflow), Mantine (batteries included, one 2026 audit reports more manual accessibility work, methodology unchecked), and plain CSS with design tokens (nothing comparable found).
- **21st.dev:** a community catalog of React and Tailwind components on the shadcn registry, plus an MCP and CLI. Search is free; fetching a component and generating UI are paid; an API key is needed; the page states no price and no component license; whether the project's design context is sent is not stated.
- **Design skills available in Claude Code:** `frontend-design` (grounding the design in the subject, a small token set, avoid templated defaults, restrained motion, plain sentence-case copy, a quality floor of responsive layout, visible focus, reduced motion and contrast), `design:design-critique`, `design:accessibility-review`, `design:ux-copy`, `design:design-system`, and Playwright for screenshots. A repository of leaked system prompts was suggested as a source and was **not used**: it is not an authorized source.

## Options considered

- **Page structure A: one page, the plan as home once a plan exists, the onboarding form as a step (chosen).** Matches E1 (the app already reads `GET /api/plan` on start) and the running apps above. No router yet.
- **Page structure B: separate routes now.** Adds a router for two screens; E5 can add routes when it adds screens.
- **Components A: plain CSS with design tokens, native form controls, no UI library (chosen for E1b).** E1's screens are a form, a list of days and a few messages; native inputs are accessible by default. No new build tooling.
- **Components B: shadcn/ui (Tailwind) or Mantine.** Worth it when dialogs, menus or toasts appear (E4 and E5); then add Radix or Base UI primitives for those pieces only. Adopting Tailwind for two screens costs more than it returns.
- **Components C: 21st.dev blocks or its MCP.** Not adopted: paid retrieval, an API key, an unstated license, and marketing blocks fit a coaching app poorly. The owner can still browse it for inspiration.
- **Visual direction:** one calm, high-contrast look with a single accent color; running and CrossFit told apart by color **and** a text label (never color alone); one type family; the plan reads as a week of day cards with rest days visibly quiet; the "waking up" and error states written in plain language. Two or three short mockups of this direction are made at the start of E1b (HTML, screenshotted with Playwright on a phone and a desktop width) and the owner picks one before the screens are changed.

## Decision

Build E1b on one page with the plan as the home screen, native form controls, and a small design system of CSS tokens and a few components, designed with the `frontend-design` skill and reviewed with the design critique, accessibility review and UX copy skills. Do not add a component library or 21st.dev now; revisit when E4 or E5 needs dialogs or menus. The visual direction is chosen from mockups at the start of E1b.

## Consequences

- E1b stays small and adds no dependency. Later epics reuse the tokens and components, which are documented in the repo.
- A single page means no deep links to a view; add routes when E5 needs them.
- The research is desk-based and some apps were not covered; the mockups are where the owner's own taste decides, before any screen changes.
- Revisit if a screen needs complex widgets, or if the owner prefers a library after seeing the mockups.

## Sources

- [TechRadar, Runna review](https://www.techradar.com/health-fitness/fitness-apps/runna-review) · [Tom's Guide, Runna review](https://www.tomsguide.com/reviews/runna-app)
- [Screens Design, running app screen examples](https://screensdesign.com/articles/running-app-screen-design-examples/)
- [IntervalCoach changelog (Intervals.icu calendar on mobile)](https://intervalcoach.featurebase.app/en/changelog/week-of-march-21) · [TrainingPeaks on the App Store](https://apps.apple.com/au/app/trainingpeaks/id408047715)
- [Garmin forum, mobile calendar request](https://forums.garmin.com/developer/connect-iq/f/discussion/437475/garmin-connect-mobile-calendar-needs-better-overview-simple-notes)
- [21st.dev](https://21st.dev) · [21st.dev MCP guide](https://21st.dev/mcp.md)
- [anthropics/skills, frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [shadcn/ui vs Radix vs Base UI comparison](https://dev.to/jake_kim_bd3065a6816799db/shadcnui-vs-radix-ui-vs-base-ui-2026-the-complete-react-component-library-comparison-p0m)
