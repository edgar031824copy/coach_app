## Purpose

Defines how a validated plan is saved with its onboarding, shown day by day, reloaded without a new coach call, and how the athlete asks for the next week.

## ADDED Requirements

### Requirement: Save only valid plans
The system SHALL save a plan together with the onboarding it was made from only after the plan passes validation, and SHALL save nothing otherwise.

#### Scenario: Valid plan is saved with its onboarding
- **WHEN** a plan passes validation
- **THEN** it is saved together with the onboarding it was made from

#### Scenario: Invalid plan is not saved
- **WHEN** a plan fails validation
- **THEN** nothing is saved

### Requirement: Reload without a coach call
`GET /api/plan` SHALL return the latest saved plan record (the plan, its onboarding, and when it was created) or `null`, and SHALL NOT call the coach. The latest plan is the one with the highest creation time, ordered by id when times are equal.

#### Scenario: Reload shows the same plan
- **WHEN** the page is reloaded and a plan exists
- **THEN** the same plan is shown and the coach is not called

#### Scenario: No plan yet
- **WHEN** no plan has been saved
- **THEN** `GET /api/plan` returns `null`

#### Scenario: Latest plan wins
- **WHEN** several plans are saved
- **THEN** the one with the highest creation time is returned, and when creation times are equal, the one with the highest id

### Requirement: Day-by-day view
The system SHALL show the plan's seven days in order mon to sun, each with its sessions and, when present, its combined-load note. A day with no sessions SHALL be shown as a rest day, and a plan made from a pasted plan SHALL show its week number.

#### Scenario: Seven days in order
- **WHEN** a plan is shown
- **THEN** the days appear in the order mon to sun

#### Scenario: Rest day
- **WHEN** a day has no sessions
- **THEN** it is shown as a rest day

#### Scenario: Week number for a pasted plan
- **WHEN** the plan was made from a pasted plan
- **THEN** the week number is shown

### Requirement: Plan next week
When a plan exists, the system SHALL offer "Plan next week", which pre-fills the form from the saved onboarding with `pastedPlanWeek` plus 1 and lets the athlete edit it. Nothing changes until the athlete submits, and a submission goes through the same validation, cap, and coach call as any onboarding.

#### Scenario: Form is pre-filled
- **WHEN** a plan from a pasted plan exists and the athlete presses "Plan next week"
- **THEN** the form is pre-filled from the saved onboarding with the next week number and can be edited

#### Scenario: Nothing changes before submitting
- **WHEN** the athlete presses "Plan next week" and does not submit
- **THEN** no coach call is made and the saved plan is unchanged

#### Scenario: Submitting counts as a normal call
- **WHEN** the athlete submits the pre-filled form
- **THEN** it is validated, counted toward the daily cap, and sent to the coach once

#### Scenario: No pasted plan
- **WHEN** the saved onboarding has no pasted plan
- **THEN** `pastedPlanWeek` stays null in the pre-filled form

#### Scenario: Pasted plan with the default week
- **WHEN** the plan was made from a pasted plan with no week given (saved as week 1) and the athlete presses "Plan next week"
- **THEN** the form is pre-filled with week 2

#### Scenario: Week past the maximum
- **WHEN** the saved week is 52 and the athlete presses "Plan next week"
- **THEN** the form shows week 53 with a field error and the athlete can edit it before submitting

### Requirement: Submitting again replaces the shown plan
The system SHALL generate and save a new plan on every successful submission, SHALL show the latest, and SHALL keep earlier plans stored but not shown.

#### Scenario: Second submission
- **WHEN** the athlete submits the onboarding again and it succeeds
- **THEN** the new plan is shown and the earlier plan remains stored
