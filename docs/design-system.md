# Design system

The visual foundation of the client (epic E1b, ADR 0007): shadcn/ui components on Tailwind CSS, with every value coming from one token file. Light theme only; a dark theme is a later change that adds a second block of values for the same names.

This document is checked by tests: every file in `client/src/components/ui/` and every color token must be named here (`client/src/design-system-docs.test.ts`). Add an entry when you add a component or a token.

## Rules

1. **Tokens only.** Colors live in `client/src/styles/tokens.css` and nowhere else. A test scans the source for hexadecimal and `rgb(` values, and another for Tailwind palette classes such as `bg-blue-500` or `text-white`. Use the token classes (`bg-primary`, `text-muted-foreground`, `border-alert-border`).
2. **Contrast.** Every text-on-background pair is listed in `client/src/styles/token-pairs.json` and its ratio is computed by a test (4.5 for text, 3 for icons and the focus ring). A new pair goes in that file.
3. **Words, not color alone.** Disciplines, intensities, the safety note and errors always carry text.
4. **Sizes.** Every control is at least 44 by 44 px on touch screens and 36 px high and 24 px wide with a mouse (`h-11 pointer-fine:h-9`). Seven 44 px day buttons do not fit inside a 296 px card, so the day row runs to the card's inner edge (`-mx-3`, 2 px gaps). Playwright measures every control at 360, 768 and 1280 px.
5. **Components are plain.** Roles and names are set by the caller (`role="note"`, `role="alert"`, `htmlFor` and `id`); the components only style.
6. **Focus.** Never use `outline-none`: in Tailwind 4 it sets the outline style to none, so `focus-visible:outline-2` draws nothing (a unit test forbids it, and Playwright tabs through every control and reads the ring). Controls drawn by a sibling `span` (radios, day buttons) use `peer-focus-visible:`.
7. **Motion.** Short color transitions are fine. One rule in `index.css` turns every animation and transition off when the visitor asks for reduced motion.
8. **Reset.** Tailwind's reset is on (in the base layer, so utilities always win): lists have no markers or indent and text elements no margin unless the markup says so (`list-none m-0 p-0`, `m-0`). The page is light only, on the page color.

## Tokens

All in `client/src/styles/tokens.css`. The first table is the raw values (mockup H); the Tailwind theme block maps them to class names.

| Token | Use | Tailwind class |
|---|---|---|
| `--page` | page background | `bg-background` |
| `--card` | card, field and outline button surface | `bg-card` |
| `--soft` | soft surface: segmented control, notes, quiet chips | `bg-secondary`, `bg-muted` |
| `--fg` | main text | `text-foreground` |
| `--muted-fg` | secondary text, labels | `text-muted-foreground` |
| `--border` | card and field borders, dividers | `border-border` |
| `--brand` | the one accent: primary button, selected day, progress | `bg-primary` |
| `--brand-hover` | the accent while hovered (darker, so white text stays readable) | `hover:bg-primary-hover` |
| `--brand-fg` | text on the accent | `text-primary-foreground` |
| `--focus` | focus ring | `outline-ring` |
| `--run` | running icon | `text-run` |
| `--run-soft` | running icon tile | `bg-run-soft` |
| `--cf` | CrossFit icon | `text-crossfit` |
| `--cf-soft` | CrossFit icon tile | `bg-crossfit-soft` |
| `--alert-bg` | safety note and failure notice background | `bg-alert` |
| `--alert-bd` | their border | `border-alert-border` |
| `--alert-fg` | their text | `text-alert-foreground` |
| `--error` | field error text and invalid border | `text-error`, `border-error` |
| `--shadow` | the one card shadow | `shadow-card` |

- **Type scale** (rem): `text-xs` 13 px, `text-sm` 14 px, `text-base` 16 px, `text-lg` 18 px, `text-xl` 24 px, `text-2xl` 28 px. Body text is `text-base`.
- **Spacing**: a 4 px base, so `p-1` is 4 px, `p-4` is 16 px, `p-6` is 24 px.
- **Radii**: `rounded-sm` 6 px (chips), `rounded-md` 12 px (buttons and fields), `rounded-lg` 16 px (notes, suggestions), `rounded-xl` 20 px (cards).

## Patterns

How the screens use the components. The code is in `client/src/PlanView.tsx`, `client/src/OnboardingForm.tsx` and `client/src/App.tsx`.

**Plan view.** The safety note comes first when the plan has one (`Alert` danger, `role="note"`, warning icon, text). Then a summary card (week label, the "Your plan" heading and the counts of runs, CrossFit sessions and rest days, counted from the plan). Then seven day cards in week order: a training day is a `Card` with an `h3`, a session row per session (icon tile, discipline as text, description, intensity badge, "from your plan" badge) and the combined-load note inside the card; a rest day is the quiet card with a moon tile. Then the coach suggestions with a "coach suggestion" badge, and the two buttons.

**Form view.** Four section cards (`Card` with an `h3` and a one-line hint): goal (with quick ideas while it is empty), level, week, and pain or injury, which is never folded. Under them the three optional parts.
- *Segmented level choice:* a `fieldset` with a `legend`, three native radios drawn by a `span` (the input covers its label). The chosen option is a white pill with an accent ring; the ring is what makes the state visible, so keep it.
- *Day toggles:* seven native checkboxes drawn as buttons, in a `fieldset`.
- *Folded optional part:* a native `details` whose summary click is handled in React, so the form owns whether it is open. Fields stay mounted, so a closed part keeps its values and they are still sent. A part opens by itself when it holds a saved answer or an error.
- *Progress cue:* "N of 4 required answers done" with a thin bar, from the shared validator's own verdict. It never blocks or enables submitting.
- *Pinned bar:* "Build my plan" in a `sticky bottom-0` bar with the safe-area inset; `scroll-padding-bottom` on `html` keeps a focused field clear of it.
- *Errors:* text below the field in `text-error`, linked with `aria-describedby`; a group with one message (the usual week, the target event) links it to every input of the group. On submit, focus goes to the first invalid field in page order, opening a folded part first if needed.

**States.** Progress text ("Loading your saved plan…", "Building your plan…", the waking message) is an `Alert` with `role="status"`. A failure is a danger `Alert` with `role="alert"`, a warning icon, the message, and "Try again" only where the rules allow. The failed-read message is a plain soft `Alert` with no role.

**Moving between views.** The view's `h2` takes focus after an athlete action and never when the page opens; a pre-filled form with an invalid value focuses that field instead.

## Components

In `client/src/components/ui/`. Import with the `@` alias, for example `import { Button } from '@/components/ui/button'`.

### Button (`button.tsx`)
A button or, with `asChild`, a link styled as one. Variants: `default` (the accent; the one main action of a view, for example "Build my plan"), `outline` (a second action next to it, for example "New plan"), `secondary` (a quiet choice, such as a quick idea). One `default` button per view.

### Card (`card.tsx`)
A surface for one group of content: a day, a form section, the summary. Variants: `default`, and `quiet` (dashed, flat, see-through) for rest days. The heading inside it is written by the view, at the right level.

### Badge (`badge.tsx`)
A short text chip: the intensity, "from your plan", "coach suggestion". Words only; never use it to show state by color.

### Alert (`alert.tsx`)
A message block with room for a leading icon. Variants: `default` (a soft surface, for progress and status text) and `danger` (the safety note and failures). Pass the role: `note` for the safety note, `alert` for a failure, `status` for progress text.

### Input (`input.tsx`)
A single-line field. Give it an `id` and a `Label`. Set `aria-invalid` for an invalid value to get the error border; show the error words in text below it.

### Textarea (`textarea.tsx`)
A multi-line field (goal, pasted plan, notes). Same rules as `Input`.

### Label (`label.tsx`)
The visible name of a field. Pair it with `htmlFor` and the field's `id`. For a group of radios or checkboxes use a `fieldset` and `legend` instead.

## Icons (`icons.tsx`)

In `client/src/components/`, inline SVG, no icon library. They are decoration: `aria-hidden`, not focusable, colored by the text color; size them with a class such as `size-5`. The text next to them carries the meaning.

| Icon | Use |
|---|---|
| `RouteIcon` | running sessions |
| `BarbellIcon` | CrossFit sessions |
| `MoonIcon` | rest days |
| `WarningIcon` | the safety note and failures |

## Bundle size

Measured by hand: build the client, `gzip -9` each file in `client/dist/assets`, and add the sizes (JavaScript plus CSS).

| When | JavaScript | CSS | Total |
|---|---|---|---|
| Before any dependency of E1b (task 1.1) | 97,380 | 684 | 98,064 |
| Final (task 4.3) | 111,523 | 4,598 | 116,121 |

The increase is 18,057 bytes (18.1 KB) against the 60 KB budget 🔶 that the owner confirmed at G1. Most of it is the three small libraries behind `Button` (`@radix-ui/react-slot`, `class-variance-authority`, `tailwind-merge`, about 12 KB when the first screen started using it), plus Tailwind's reset and the utilities the screens use. No font file and no icon library are shipped.
