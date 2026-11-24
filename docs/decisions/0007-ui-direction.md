# 0007. UI direction for E1b (spike X4)

**Status:** Accepted (owner merged the proposal, 2026-11-24)
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
- **Components A: shadcn/ui on Tailwind (chosen, owner's call).** shadcn/ui is not an npm library: a CLI copies the component code into the repo, so it is ours to edit. It needs Tailwind CSS (the `@tailwindcss/vite` plugin), an `@` path alias and a `components.json`; components land in `client/src/components/ui/`. It gives accessible primitives for the dialogs, menus and toasts that E4 and E5 will need, and a theme made of CSS variables for the design tokens. Cost: Tailwind and a few dependencies for the client, and a one-time setup in a workspace (the client's Vite config already aliases `shared`).
- **Components B: plain CSS with tokens and native controls.** Fewer dependencies, but every later widget is built by hand, and an energetic, bold look is much more work without a toolkit.
- **Components C: Mantine.** Batteries included, but its own look is harder to push toward a custom direction, and one audit found extra accessibility work.
- **Components D: 21st.dev blocks or its MCP.** Used as a **gallery for inspiration**, not as a dependency: browsing is free, copying a block is limited to 2 a day on the free tier, fetching through the MCP is paid and needs an API key, its pages state no license (check each block before copying), and whether the project's context is sent is not stated. Blocks are React, Tailwind and shadcn, so a chosen idea can be rebuilt from shadcn primitives. The MCP is not installed.
- **Visual direction (owner: energetic and bold):** a high-contrast, high-energy look with one strong accent color, large type for the day and the session, and confident use of color; running and CrossFit told apart by color **and** a text label (never color alone); one type family; the plan reads as a week of day cards with rest days visibly quiet; the "waking up" and error states written in plain language. Two or three short mockups of this direction are made at the start of E1b (HTML, screenshotted with Playwright on a phone and a desktop width) and the owner picks one before the screens are changed.

## Decision

Build E1b on one page with the plan as the home screen, using shadcn/ui on Tailwind CSS with a small design system of CSS-variable tokens, designed with the `frontend-design` skill and reviewed with the design critique, accessibility review and UX copy skills. The direction is energetic and bold. Use 21st.dev as a gallery for ideas only. The visual direction is chosen from mockups at the start of E1b.

## Consequences

- E1b adds Tailwind and shadcn/ui to `client/` (the setup is its first task, with the bundle scan and the client tests still passing). Later epics reuse the tokens and components, which are documented in the repo, and get accessible dialogs and menus without extra work.
- Energetic and bold is easy to overdo: the mockups must keep the accessibility floor (contrast, focus, text labels next to color) and the plain wording of messages.
- A single page means no deep links to a view; add routes when E5 needs them.
- The research is desk-based and some apps were not covered; the mockups are where the owner's own taste decides, before any screen changes.
- Revisit if the Tailwind setup fights the existing build (workspaces, the shared alias, the secret scan of the bundle) or the owner dislikes the mockups.

## Sources

- [TechRadar, Runna review](https://www.techradar.com/health-fitness/fitness-apps/runna-review) · [Tom's Guide, Runna review](https://www.tomsguide.com/reviews/runna-app)
- [Screens Design, running app screen examples](https://screensdesign.com/articles/running-app-screen-design-examples/)
- [IntervalCoach changelog (Intervals.icu calendar on mobile)](https://intervalcoach.featurebase.app/en/changelog/week-of-march-21) · [TrainingPeaks on the App Store](https://apps.apple.com/au/app/trainingpeaks/id408047715)
- [Garmin forum, mobile calendar request](https://forums.garmin.com/developer/connect-iq/f/discussion/437475/garmin-connect-mobile-calendar-needs-better-overview-simple-notes)
- [21st.dev](https://21st.dev) · [21st.dev MCP guide](https://21st.dev/mcp.md)
- [anthropics/skills, frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [shadcn/ui, Vite installation](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui vs Radix vs Base UI comparison](https://dev.to/jake_kim_bd3065a6816799db/shadcnui-vs-radix-ui-vs-base-ui-2026-the-complete-react-component-library-comparison-p0m)
