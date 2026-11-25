## Why

E1 works but looks unfinished: default styling, one long page, wording written for tests. The owner wants an interface worth showing to other athletes, and later epics add screens that would otherwise need restyling. Brief: `docs/epics/E1b-ui-foundation.md`. PRD: epic E1b and Should item S6. Direction: ADR 0007 and mockup H (`docs/design/`).

## What Changes

- Add Tailwind CSS and shadcn/ui to `client/`, with design tokens and a light theme.
- Two views on one page, no router: the plan view (home) and the form view, plus a loading state while the saved plan is read. "New plan" opens an empty form, "Plan next week" a prefilled one, "My plan" goes back without a request.
- Plan view: a summary card, one card per day with icons, the safety note first when present.
- Form view: four section cards, segmented level choice, seven-button day rows, goal quick-idea chips, folded optional parts, a progress cue, the primary button pinned to the bottom on phones.
- Restyle loading, waking and failure states; keep their rules and the wording the E1 specs name.
- Add accessibility and responsive checks and document the design system.
- No change to the API, schemas, server, database, or any E1 requirement. E1 tests that assumed one page are rewritten with the same scenario tags.

## Capabilities

### New Capabilities
- `app-views`: start state, the two views, transitions, focus, and what each request outcome shows.
- `plan-presentation`: how a plan is shown.
- `form-presentation`: how the onboarding form is laid out and its helpers; E1 validation unchanged.
- `messages-and-states`: loading, building, waking and failure presentation; roles and retry rules unchanged.
- `responsive-accessibility`: layout at phone, tablet and desktop widths, and the accessibility baseline.
- `design-system`: tokens, components, documentation, size budget.

### Modified Capabilities
None. Every E1 requirement and scenario stays as written.

## Impact

`client/` (dependencies, `components.json`, `components/ui/`, restyled screens, rewritten structural tests); `e2e/` (journey updated, new checks); `docs/design-system.md`. No harness change. The CI clean build and the bundle secret scan must still pass.

## Non-goals

New features or endpoints; any server or database change; highlighting today in the week; a router and browser Back (E5); a login (E7); a dark theme (a later change); illustrations or a logo beyond text; new training advice or copy; animation other than short motion that responds to an action; any change to the E1 scenarios.
