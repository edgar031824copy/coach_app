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
