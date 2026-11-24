# E1b design mockups

Three static directions for the E1 screens (epic brief `docs/epics/E1b-ui-foundation.md`, ADR 0007), all with made-up data and the real E1 labels ("from your plan", "coach suggestion", "Plan next week", "Rest day", the safety note first). Open `mockups/index.html` in a browser; screenshots at 390 px (phone) and 1280 px (desktop) are in `mockups/shots/`. The mockups use system fonts and plain CSS so they open anywhere; the real build would use Tailwind, shadcn/ui and one self-hosted font.

| | A: Scoreboard | B: Night session | C: Poster blocks |
|---|---|---|---|
| Look | White page, cobalt blue (running) and blaze orange (CrossFit), big blue distances, a week strip at the top | Dark violet page, aqua (running) and hot pink (CrossFit), rounded cards with colored outlines | Full-width color blocks: yellow (running), red (CrossFit), a double day is a yellow band over a red band, giant day names |
| Boldness spent on | the distances and the week strip | the dark stage and the colored day pills | the whole page is the color code |
| Theme | light only | dark (the brief says dark only if a mockup needs it; this one would) | light only |
| Safety note | yellow box, first | yellow box, first | black block, first |
| Risk | the most conventional | needs a dark theme and its own contrast work | the loudest; heavy for long reading |

Text contrast of the token pairs (WCAG 2.1 AA needs 4.5 for text), computed from the hex values: A 5.3 to 18.8; B 5.7 to 19.2; C 5.1 to 21.0. All pass. Color is never the only signal: every session carries the text label "Running" or "CrossFit". No animation is used. Known weaknesses of the mockups: on desktop A's two-column grid leaves a tall empty card next to a long one; the saved-plan-read failure and an empty state are not shown.

Not decided here: the font (system stack in the mockups), the exact accent after the owner picks, and anything beyond the screens in E1.

## Round 2 (owner feedback on round 1)

The owner rejected A, B and C: too loud, the yellow safety box, the combined-color week strip and the oversized pills. Asked for something simpler and modern. Round 1 is kept for the record.

- **D (light) and E (dark): clean, shadcn-style.** One column, a plain list of days separated by thin lines instead of cards, a segmented "My plan | New plan" switch at the top, a single blue accent for actions, running and CrossFit shown by a small colored dot plus the text label, outlined small chips ("from your plan", "coach suggestion", intensity), distances in bold. Reference points: the sparse white interface of Hevy and similar training apps, and the shadcn/ui default look the build will use. Marketing pages of Runna, Hevy and WHOOP were looked at; they show little of their apps' own screens, so this is a judgment, not a measured comparison.
- **The safety note** appears only when the plan has one (a pain report). It is a rose-toned alert with an icon, no yellow; `plan.html` shows the normal plan and `plan-pain.html` the one with the note.
- No week strip and no split colors: a day with two sessions simply lists both.
- Contrast (computed from the hex values, 4.5 needed for text): light, body text 17.7, muted text 7.7, button text 5.2, CrossFit label 5.2, alert text 8.7; dark, body text 19.1, muted text 7.8, button text 7.8, alert text 14.8, CrossFit label 8.8. Touch targets are 44 px.

## Round 3 (F light, G dark)

Owner feedback on D: likes light, day buttons too big (on a computer), wants it more modern, maybe with images, and dark mode later. Changes:
- **Day pickers:** seven equal buttons in one row, 44 px high on touch screens (the project's own rule) and 36 px with a mouse.
- **Modern look:** a soft page background, each day a white rounded card with a light shadow, an icon tile per session (a route icon for running, a barbell for CrossFit, a moon for rest; simple line icons in the style of the shadcn icon set), and a summary card at the top with the counts of runs, CrossFit sessions and rest days (counted from the plan's sessions, no new data). Chips and the "Plan next week" and "New plan" buttons are smaller.
- **Images:** none yet. The icons and the soft gradient in the summary card carry the look. Photos would add weight, a licensing check and a design risk; if wanted, they come in a later round (a few self-hosted, licensed images or illustrations).
- **Dark (G):** the same design with the dark tokens; the real build can follow the phone's setting.
- The safety note is still rose-toned and only appears when the plan has one.

## Round 4 (H light, I dark): the form view

Owner feedback on F/G: much better; start with light and add dark later; the "New plan" form is too basic. Research (sources linked in ADR 0007's follow-up note below): single-column forms with related fields grouped into sections, progressive disclosure (fold away what most people skip), a progress cue, errors shown next to the field, and a primary button near the bottom. Runna's own onboarding is a 26-step quiz, far heavier than this form needs, so a wizard was not copied.

Changes in the form view (same fields, same values, same validation and submit as E1):
- **Four sections as cards:** goal, level, week, pain or injury.
- **Goal:** a placeholder example and quick-idea chips ("Half marathon", "10K"...) that fill the text box; the field stays free text. The chip wording is a suggestion to approve.
- **Levels:** a three-way segmented control (Beginner, Intermediate, Advanced) instead of a select, same three values.
- **Days:** the seven-button rows from F; 44 px on touch, 36 px with a mouse.
- **Pain or injury stays visible** (not folded away) because it is a safety input (PRD Principle 6).
- **Optional parts folded:** "I already follow a running plan", "My usual week" and "Target event" are collapsible rows.
- **Progress cue:** "2 of 4 required answers done" with a thin bar (goal, both levels, at least one training day); it is a presentation of the existing rules.
- **Primary button** in a bar pinned to the bottom of the screen on a phone. (A full-page screenshot shows the bar in the middle; on a real screen it sits at the bottom.)

Alternative not built: a step-by-step wizard (one question per screen). It focuses attention, but it adds back and next logic and per-step validation for six answers; it is more behavior to keep consistent with E1's rules.
