# E1b design: chosen direction

**Chosen by the owner (2026-11-24): H, light.** Open `mockups/index.html`; phone screenshots (390 px) are in `mockups/shots/`. Static pages with made-up data and the real E1 labels. System fonts and plain CSS so they open anywhere; the build uses Tailwind, shadcn/ui and one self-hosted font. Dark is a later, separate change: `mockups/h/style.css` already holds the dark tokens (`data-theme="dark"`).

## The design
- **Look:** soft grey page, white rounded cards with a light shadow, one blue accent, small outlined chips ("from your plan", "coach suggestion", intensity), distances in bold.
- **Plan view:** a summary card (counts of runs, CrossFit sessions and rest days, counted from the plan's sessions), one card per day, an icon tile per session (route for running, barbell for CrossFit, moon for rest), combined-load notes inside the day, coach suggestions as a list, "Plan next week" and "New plan" buttons. A "My plan | New plan" switch at the top.
- **Safety note:** only when the plan has one (a pain report), first on the page, rose-toned with an icon and text, no yellow.
- **Form view:** four section cards (goal, level, week, pain or injury); quick-idea chips under the goal that fill the free text; a three-way segmented control for each level; seven-button day rows (44 px on touch, 36 px with a mouse); pain or injury kept visible because it is a safety input; "I already follow a running plan", "My usual week" and "Target event" folded away; a progress cue ("2 of 4 required answers done"); the primary button pinned to the bottom on a phone.
- **States:** loading, waking up, form error, coach unavailable with retry, daily limit.
- **Contrast** (computed, 4.5 needed for text): body text 17.7, muted text 7.7, button text 5.2, CrossFit label 5.2, alert text 8.7. Color is never the only signal; every session says "Running" or "CrossFit".

## Why this one
Rounds A to E (bold color blocks, a dark neon look, a yellow safety box, a combined-color week strip) were rejected as too loud or too basic. Research that shaped H: running and training apps (Runna, Hevy, Strava) use an icon per workout type, one accent and simple cards or lists; form guidance (single column, grouped sections, fold away optional parts, errors next to the field, a visible primary button). A step-by-step wizard was not built: it adds back and next logic for six answers. Earlier rounds are in this branch's git history.

## Still open (settle when the specs are written)
The wording of the goal quick-idea chips, the exact accent blue, the font, and whether the summary card stays.
