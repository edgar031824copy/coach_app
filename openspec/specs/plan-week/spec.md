# plan-week Specification

## Purpose
Defines the week a plan is for: every saved plan carries the Monday of its week, the server checks it, the client sends it, and "Plan next week" moves it forward by one week.

## Requirements

### Requirement: Every plan has a week
Each saved plan SHALL carry `weekStart`, a calendar date (`YYYY-MM-DD`) that is a Monday, saved with the plan and returned by `POST /api/plan` and `GET /api/plan` as the same date whatever time zone the server runs in. `POST /api/plan` SHALL accept an optional `weekStart` beside the onboarding fields. Only an absent key means "the current week": then the plan's week is the Monday of the current week (UTC). A `weekStart` that is not a string of the form `YYYY-MM-DD`, not a real date, not a Monday, or more than 26 weeks before or after the current week SHALL be refused as a validation error on the field `weekStart`, with nothing saved, no coach call and no cap spent. Plans saved before the week existed SHALL get the Monday of the week they were created in (UTC), and none SHALL be lost by that step (the later merge of plans of one week is the rule "One plan per week").

#### Scenario: Week is saved and returned
- **WHEN** a plan is made with `weekStart` "2026-11-23"
- **THEN** the answer to the request and a later `GET /api/plan` both carry `weekStart` "2026-11-23"

#### Scenario: Week defaults to the current week
- **WHEN** a plan is requested without `weekStart` on Thursday 2026-11-26
- **THEN** the saved plan's `weekStart` is "2026-11-23"

#### Scenario: A Sunday belongs to the week before
- **WHEN** a plan is requested without `weekStart` at 23:30 UTC on Sunday 2026-11-29
- **THEN** the saved plan's `weekStart` is "2026-11-23"

#### Scenario: Only a Monday is accepted
- **WHEN** a plan is requested with `weekStart` "2026-11-24" (a Tuesday)
- **THEN** the answer is a 400 validation error naming the field `weekStart`, nothing is saved, the coach is not called and the daily count is unchanged

#### Scenario: A value that is not a date is refused
- **WHEN** a plan is requested with `weekStart` "next monday", "2026-13-40", "2026-11-23T00:00:00Z", an empty string, `null` or a number
- **THEN** the answer is the same 400 validation error on `weekStart`

#### Scenario: A week far from today is refused
- **WHEN** a plan is requested with a Monday 27 weeks before or 27 weeks after the current week
- **THEN** the answer is a 400 validation error on `weekStart`, and a Monday exactly 26 weeks before or after the current week is accepted

#### Scenario: Earlier plans get a week
- **WHEN** plans saved before this change exist, one created at 23:30 UTC on a Sunday and one on 1 January, and the database is migrated
- **THEN** each plan has the Monday of the week it was created in as its `weekStart`, and every plan, its onboarding and its creation time are unchanged

#### Scenario: The date does not move with the server's time zone
- **WHEN** the server runs in a time zone far from UTC and a plan was saved with `weekStart` "2026-11-23"
- **THEN** `GET /api/plan` returns `weekStart` "2026-11-23"

### Requirement: The client asks for the right week
The client SHALL send `weekStart` with every plan request, and the athlete SHALL NOT edit it. For a form opened empty, and for the first plan, it is the Monday of the current week in the athlete's own calendar. For "Plan next week" it is seven days after the shown plan's `weekStart`, but never earlier than the Monday of the current week. A retry of a failed request SHALL send the same `weekStart` as the request it repeats. When the server refuses the week, the alert SHALL say "That week is too far from today. Use New plan to start from this week." and offer no retry.

#### Scenario: First plan is for the current week
- **WHEN** the athlete builds a plan from the empty form on Thursday 26 November 2026
- **THEN** the request carries `weekStart` "2026-11-23"

#### Scenario: The week follows the athlete's calendar
- **WHEN** the athlete's clock reads 01:30 on Monday 30 November 2026 (23:30 UTC on Sunday 29 November) and they build a plan from the empty form
- **THEN** the request carries `weekStart` "2026-11-30"

#### Scenario: Plan next week moves one week
- **WHEN** the shown plan's week starts on 2026-11-23, and the athlete presses "Plan next week" and submits
- **THEN** the request carries `weekStart` "2026-11-30"

#### Scenario: Plan next week crosses a month and a year
- **WHEN** the shown plan's week starts on 2026-12-28, and the athlete presses "Plan next week" and submits
- **THEN** the request carries `weekStart` "2027-01-04"

#### Scenario: Plan next week never plans the past
- **WHEN** the shown plan's week started four weeks before the current week, and the athlete presses "Plan next week" and submits
- **THEN** the request carries the Monday of the current week

#### Scenario: New plan is for the current week again
- **WHEN** the shown plan is for another week and the athlete presses "New plan" and submits
- **THEN** the request carries the Monday of the current week

#### Scenario: A retry keeps the week
- **WHEN** a request fails and the athlete presses "Try again"
- **THEN** the second request carries the same `weekStart` as the first

#### Scenario: A week that is too far away is explained
- **WHEN** the server answers a plan request with a validation error on `weekStart`
- **THEN** the alert says "That week is too far from today. Use New plan to start from this week." and no "Try again" is offered

### Requirement: One plan per week
The system SHALL store at most one plan for each `weekStart`; the database SHALL enforce it. When `POST /api/plan` produces a valid plan for a week that already has one, the system SHALL replace the plan and the onboarding of that stored plan, set its creation time to the time of the replacement, keep its id, and answer with that record, all in one atomic step. When the request fails or the plan is not valid, the stored plan of that week SHALL stay exactly as it was. Two builds of one week at the same time SHALL leave exactly one plan for that week. A plan for another week SHALL never be touched by a build. Migration 003 SHALL, for each week that has more than one plan, keep the plan with the latest creation time (the highest id when creation times are equal) and delete the others, and then enforce uniqueness; plans of weeks that have one plan SHALL be unchanged, and running the migration again SHALL change nothing.

#### Scenario: The first plan of a week is added
- **WHEN** a plan is built for a week that has no plan
- **THEN** it is stored and the number of stored plans grows by one

#### Scenario: Rebuilding a week replaces its plan
- **WHEN** a plan is built for the week of 2026-11-23 and another plan of that week is stored
- **THEN** the number of stored plans is the same, the plan and onboarding of that week are the new ones, its id is the same as before, and its creation time is the time of the rebuild

#### Scenario: A failed build keeps the stored plan
- **WHEN** a rebuild of the week fails because the coach is unavailable or the plan is not valid
- **THEN** the stored plan of that week is exactly the one that was there before

#### Scenario: Two builds at once leave one plan
- **WHEN** two builds of the same week finish at the same time
- **THEN** exactly one plan is stored for that week, and it is one of the two that were built

#### Scenario: Other weeks are untouched
- **WHEN** the week of 2026-11-30 is built while the weeks of 2026-11-16 and 2026-11-23 are stored
- **THEN** the plans of those two weeks are unchanged

#### Scenario: The migration keeps the newest plan of a week
- **WHEN** three plans of the week of 2026-11-16 and one plan of the week of 2026-11-23 exist and the database is migrated
- **THEN** the newest plan of the week of 2026-11-16 and the plan of 2026-11-23 remain, with unchanged content, and the two older plans of 2026-11-16 are gone

#### Scenario: The migration breaks a tie with the highest id
- **WHEN** two plans of one week have the same creation time and the database is migrated
- **THEN** the one with the highest id remains

#### Scenario: The migration can run again
- **WHEN** the migrated database is migrated again
- **THEN** nothing changes
