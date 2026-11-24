# Design system

The visual foundation of the client (epic E1b, ADR 0007): shadcn/ui components on Tailwind CSS, with every value coming from one token file. Light theme only; a dark theme is a later change that adds a second block of values for the same names.

This document is checked by tests: every file in `client/src/components/ui/` and every color token must be named here (`client/src/design-system-docs.test.ts`). Add an entry when you add a component or a token.

## Rules

1. **Tokens only.** Colors live in `client/src/styles/tokens.css` and nowhere else. A test scans the source for hexadecimal and `rgb(` values, and another for Tailwind palette classes such as `bg-blue-500` or `text-white`. Use the token classes (`bg-primary`, `text-muted-foreground`, `border-alert-border`).
2. **Contrast.** Every text-on-background pair is listed in `client/src/styles/token-pairs.json` and its ratio is computed by a test (4.5 for text, 3 for icons and the focus ring). A new pair goes in that file.
3. **Words, not color alone.** Disciplines, intensities, the safety note and errors always carry text.
4. **Sizes.** Controls are 44 px high on touch screens and 36 px with a mouse (`h-11 pointer-fine:h-9`), at least 24 px wide.
5. **Components are plain.** Roles and names are set by the caller (`role="note"`, `role="alert"`, `htmlFor` and `id`); the components only style.

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
