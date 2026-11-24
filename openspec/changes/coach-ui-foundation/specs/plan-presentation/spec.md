## Purpose
Defines how a saved plan is shown: a summary, one card per day in week order, labels that tell sessions apart without relying on color, and the safety note first when the plan has one. It changes presentation only, not the plan's content.

## ADDED Requirements

### Requirement: Summary of the week
The plan view SHALL show a summary with the number of running sessions, the number of CrossFit sessions, and the number of rest days, counted from the plan's own sessions and days, and SHALL show "Week N of your running plan" when the pasted-plan week is known.

#### Scenario: Counts match the plan
- **WHEN** a plan has 3 running sessions, 5 CrossFit sessions and 1 rest day
- **THEN** the summary shows 3 runs, 5 CrossFit and 1 rest day

#### Scenario: Two sessions on a day count twice
- **WHEN** one day has a running and a CrossFit session
- **THEN** both sessions are counted and the day is not counted as a rest day

#### Scenario: Week label
- **WHEN** the saved onboarding has a pasted-plan week of 3
- **THEN** "Week 3 of your running plan" is shown, and with a null week no such label is shown

### Requirement: One card per day, in week order
The plan view SHALL show seven day cards from Monday to Sunday whatever order the plan stores them in, each with the day's name as a heading. A day with no sessions SHALL show "Rest day" in a visibly quieter style, and a day's combined-load note SHALL appear inside that day's card.

#### Scenario: Days in week order
- **WHEN** the plan stores its days in a different order
- **THEN** the cards appear Monday to Sunday

#### Scenario: Rest day
- **WHEN** a day has no sessions
- **THEN** its card shows "Rest day" and no session

#### Scenario: Combined-load note stays with its day
- **WHEN** a day has a combined-load note
- **THEN** the note appears inside that day's card

### Requirement: Sessions are identified by text
Each session SHALL show its discipline as text ("Running" or "CrossFit"), its description, and its intensity as text, with an icon as an extra cue only. Sessions with `source: "athlete"` SHALL carry the label "from your plan", and each recommendation SHALL carry the label "coach suggestion". Long descriptions SHALL wrap and never be cut off.

#### Scenario: Discipline and intensity are text
- **WHEN** a session is shown
- **THEN** its discipline and intensity appear as text, not only as a color or an icon

#### Scenario: Athlete sessions and suggestions are labeled
- **WHEN** a plan has an athlete session and a recommendation
- **THEN** the session is labeled "from your plan" and the recommendation "coach suggestion", and the athlete's session text is shown exactly as saved

#### Scenario: Long text is not cut off
- **WHEN** a session description is 400 characters long
- **THEN** the whole text is readable in its card at a 360 px wide screen

### Requirement: The safety note comes first
When the plan has a safety note the plan view SHALL show it before the summary and the day cards, as a note with an icon and text, in a style at least as prominent as a day card. When the plan has none, no safety note SHALL be shown.

#### Scenario: Note first
- **WHEN** the plan has a safety note
- **THEN** the note precedes the summary and every day card in the page order, has `role="note"`, and its text is at least as large as a day card's text

#### Scenario: No note without a note
- **WHEN** the plan's safety note is null
- **THEN** no safety note element is shown
