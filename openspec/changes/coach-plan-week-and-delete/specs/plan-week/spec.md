## Purpose
Defines the week a plan is for: every saved plan carries the Monday of its week, the server checks it, the client sends it, and "Plan next week" moves it forward by one week.

## ADDED Requirements

### Requirement: Every plan has a week
Each saved plan SHALL carry `weekStart`, a calendar date (`YYYY-MM-DD`) that is a Monday, saved with the plan and returned by `POST /api/plan` and `GET /api/plan`. `POST /api/plan` SHALL accept an optional `weekStart` beside the onboarding fields. When it is absent the plan's week is the Monday of the current week (UTC). A `weekStart` that is not a Monday, not a real date, or more than 26 weeks before or after the current week SHALL be refused as a validation error on the field `weekStart`, with nothing saved, no coach call and no cap spent. Plans saved before this change SHALL get the Monday of the week they were created in (UTC) and none SHALL be lost.

#### Scenario: Week is saved and returned
- **WHEN** a plan is made with `weekStart` "2026-11-23"
- **THEN** the answer to the request and a later `GET /api/plan` both carry `weekStart` "2026-11-23"

#### Scenario: Week defaults to the current week
- **WHEN** a plan is requested without `weekStart` on Thursday 2026-11-26
- **THEN** the saved plan's `weekStart` is "2026-11-23"

#### Scenario: Only a Monday is accepted
- **WHEN** a plan is requested with `weekStart` "2026-11-24" (a Tuesday)
- **THEN** the answer is a 400 validation error naming the field `weekStart`, nothing is saved, the coach is not called and the daily count is unchanged

#### Scenario: A value that is not a date is refused
- **WHEN** a plan is requested with `weekStart` "next monday", "2026-13-40" or a number
- **THEN** the answer is the same 400 validation error on `weekStart`

#### Scenario: A week far from today is refused
- **WHEN** a plan is requested with a Monday more than 26 weeks before or after the current week
- **THEN** the answer is a 400 validation error on `weekStart`, and a Monday exactly 26 weeks away is accepted

#### Scenario: Earlier plans get a week
- **WHEN** plans saved before this change exist and the database is migrated
- **THEN** each plan has the Monday of the week it was created in as its `weekStart`, and every plan, its onboarding and its creation time are unchanged

### Requirement: The client asks for the right week
The client SHALL send `weekStart` with every plan request, and the athlete SHALL NOT edit it. For a form opened empty, and for the first plan, it is the Monday of the current week in the athlete's own calendar. For "Plan next week" it is seven days after the shown plan's `weekStart`. A retry of a failed request SHALL send the same `weekStart` as the request it repeats.

#### Scenario: First plan is for the current week
- **WHEN** the athlete builds a plan from the empty form on Thursday 26 November 2026
- **THEN** the request carries `weekStart` "2026-11-23"

#### Scenario: Plan next week moves one week
- **WHEN** the shown plan's week starts on 2026-11-23, and the athlete presses "Plan next week" and submits
- **THEN** the request carries `weekStart` "2026-11-30"

#### Scenario: Plan next week crosses a month and a year
- **WHEN** the shown plan's week starts on 2026-12-28, and the athlete presses "Plan next week" and submits
- **THEN** the request carries `weekStart` "2027-01-04"

#### Scenario: New plan is for the current week again
- **WHEN** the shown plan is for another week and the athlete presses "New plan" and submits
- **THEN** the request carries the Monday of the current week

#### Scenario: A retry keeps the week
- **WHEN** a request fails and the athlete presses "Try again"
- **THEN** the second request carries the same `weekStart` as the first
