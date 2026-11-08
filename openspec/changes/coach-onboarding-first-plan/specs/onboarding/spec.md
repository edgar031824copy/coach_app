## Purpose

Defines which onboarding answers the system accepts and guarantees that invalid input never reaches the coach, so no model call is spent on a request that cannot produce a plan.

## ADDED Requirements

### Requirement: Required answers
The system SHALL require a goal, a running level, a CrossFit level, and at least one training day in `runningDays` or `crossfitDays`, or a pasted running plan.

#### Scenario: Valid onboarding is accepted
- **WHEN** the goal, both levels, and days are valid
- **THEN** the onboarding is accepted

#### Scenario: Empty goal is rejected
- **WHEN** the goal is empty
- **THEN** a per-field error on the goal is returned and the coach is not called

#### Scenario: No days and no pasted plan is rejected
- **WHEN** no CrossFit days, no running days, and no pasted plan are given
- **THEN** an error on the days fields is returned and the coach is not called

#### Scenario: Pasted plan makes running days optional
- **WHEN** a running plan is pasted and `runningDays` is empty
- **THEN** the onboarding is accepted

#### Scenario: Pasted plan without CrossFit days is accepted
- **WHEN** a running plan is pasted and `crossfitDays` is empty
- **THEN** the onboarding is accepted and the plan contains no coach-added CrossFit sessions

### Requirement: Field validation
The system SHALL accept only the levels beginner, intermediate, and advanced, and only the days mon to sun without repeats in a list. `injuries` MAY be empty. A malformed request body SHALL be rejected.

#### Scenario: Invalid level is rejected
- **WHEN** a level is not beginner, intermediate, or advanced
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Invalid day is rejected
- **WHEN** a day is not one of mon to sun
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Duplicate day is rejected
- **WHEN** a day is listed twice in the same days list
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Empty injuries is accepted
- **WHEN** `injuries` is empty
- **THEN** the onboarding is accepted

#### Scenario: Malformed body is rejected
- **WHEN** the request body is malformed or has an unknown shape
- **THEN** a 400 response is returned and the coach is not called

### Requirement: Pasted running plan input
The system SHALL accept a pasted running plan of at most 4,000 characters 🔶, SHALL treat a plan that is empty or only whitespace as absent, and SHALL accept `pastedPlanWeek` as an integer from 1 to 52 🔶 that defaults to 1 when absent or null.

#### Scenario: Over-length paste is rejected
- **WHEN** the pasted plan is over 4,000 characters
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Whitespace-only paste counts as absent
- **WHEN** the pasted plan contains only whitespace and no training days are given
- **THEN** the days error applies and the coach is not called

#### Scenario: Plan week defaults to 1
- **WHEN** a plan is pasted and `pastedPlanWeek` is absent or null
- **THEN** week 1 is used and the saved onboarding records week 1

#### Scenario: Plan week out of range is rejected
- **WHEN** `pastedPlanWeek` is not an integer from 1 to 52
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Plan week without a paste is ignored
- **WHEN** `pastedPlanWeek` is given and no plan is pasted
- **THEN** it is ignored and the onboarding is accepted

### Requirement: Optional context fields
The system SHALL treat `weeklyTraining` and `targetEvent` as optional, SHALL reject a `weeklyTraining` value that is out of range (sessions per week outside 0 to 14 🔶, or negative km), and SHALL reject a `targetEvent` whose date is invalid or before today in UTC (today is allowed).

#### Scenario: Optional fields absent
- **WHEN** `weeklyTraining` and `targetEvent` are absent
- **THEN** the onboarding is accepted

#### Scenario: Weekly training out of range
- **WHEN** `weeklyTraining` has sessions outside 0 to 14 or a negative km value
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Invalid event date
- **WHEN** the `targetEvent` date is not a valid date
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Past event date
- **WHEN** the `targetEvent` date is before today in UTC
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Event date today is allowed
- **WHEN** the `targetEvent` date is today in UTC
- **THEN** the onboarding is accepted

### Requirement: Invalid input never reaches the coach
The system SHALL NOT call the coach for any onboarding that fails validation, and SHALL NOT count such a request toward the daily cap.

#### Scenario: Rejected onboarding makes no coach call
- **WHEN** an onboarding fails any validation rule
- **THEN** the coach is called zero times and the daily call count is unchanged

### Requirement: Free-text length limits
The system SHALL reject a goal over 500 characters 🔶, `injuries` over 2,000 characters 🔶, a `targetEvent` name over 200 characters 🔶, and a request body over 16 KB 🔶, before any coach call.

#### Scenario: Goal too long
- **WHEN** the goal is over 500 characters
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Injuries too long
- **WHEN** `injuries` is over 2,000 characters
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Event name too long
- **WHEN** the `targetEvent` name is over 200 characters
- **THEN** an error on that field is returned and the coach is not called

#### Scenario: Request body too large
- **WHEN** the request body is over 16 KB
- **THEN** a 413 response is returned and the coach is not called
