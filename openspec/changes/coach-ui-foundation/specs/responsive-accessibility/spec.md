## Purpose
Defines how the client behaves at phone, tablet and desktop widths and the accessibility baseline (WCAG 2.1 AA) every view and state must meet, so the app is usable by phone, by keyboard and with a screen reader.

## ADDED Requirements

### Requirement: Layout at every width
Each view and state SHALL fit the screen without horizontal scrolling at 360, 768 and 1280 pixels wide.

#### Scenario: No horizontal scroll
- **WHEN** the plan view, the form view (empty and with errors), and each message state are opened at 360, 768 and 1280 pixels wide
- **THEN** the page is never wider than the screen

### Requirement: Touch targets
On a touch screen every button, link, day button, level option, chip, checkbox and field SHALL be at least 44 by 44 pixels (the project's own rule, above the WCAG 2.1 AA requirement). Links inside a sentence are exempt.

#### Scenario: Target size on a phone
- **WHEN** the form view and the plan view are opened at 360 pixels wide with touch input
- **THEN** every interactive element except links inside a sentence measures at least 44 pixels in both directions

### Requirement: Contrast and signals
Text and interface parts SHALL meet WCAG 2.1 AA contrast (4.5:1 for text, 3:1 for large text and interface parts) for every color pair the tokens define for text on a background. Color SHALL never be the only signal: disciplines, intensities, the safety note and errors carry text.

#### Scenario: Token pairs meet contrast
- **WHEN** the contrast of every text and background pair listed in the design tokens is computed
- **THEN** each pair meets its minimum ratio

#### Scenario: Errors and the safety note carry text
- **WHEN** a field has an error and a plan has a safety note
- **THEN** each shows words, not only a color or an icon

### Requirement: Keyboard use
The whole flow (filling the form, folding and opening optional parts, submitting, moving between views) SHALL work with the keyboard alone, with a visible focus indicator on every focusable element and a logical tab order.

#### Scenario: Keyboard-only journey
- **WHEN** the athlete fills the form, submits with Enter, and uses Tab to reach "Plan next week"
- **THEN** every step works without a pointer, focus is always visible, and after the plan opens focus is on the plan view's heading

### Requirement: Structure for screen readers
Every control SHALL have a label, each view SHALL have one main heading with no skipped heading levels, and the level controls SHALL be exposed as groups named "Running level" and "CrossFit level".

#### Scenario: Labels and headings
- **WHEN** the form view and the plan view are inspected
- **THEN** every control has an accessible name, the heading levels are 1, then 2, then 3 without gaps, and the level groups have those two names

#### Scenario: Automated accessibility rules
- **WHEN** an automated accessibility scan (axe, excluding the contrast rule covered above) runs on each view and state
- **THEN** it reports no violation

### Requirement: Reduced motion
When the visitor asks for reduced motion the client SHALL show no animation or transition.

#### Scenario: Reduced motion respected
- **WHEN** the browser reports `prefers-reduced-motion: reduce`
- **THEN** no element has a running animation or a transition longer than zero
