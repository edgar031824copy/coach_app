## Purpose
Defines how the athlete sees and moves between the stored plans: the list the server returns, the plan shown when the page opens, the week switcher, and the warning before a plan replaces another.

## ADDED Requirements

### Requirement: Listing the stored plans
`GET /api/plans` SHALL return `{ "plans": [...] }` with every stored plan record (id, plan, onboarding, `weekStart` and creation time, as in `GET /api/plan`), ordered by `weekStart` from the oldest week to the newest, and `{ "plans": [] }` when none is stored. It SHALL NOT call the coach, spend or change the daily call count, or change anything stored. A store failure SHALL give a 500 `server_error` with no detail. Only the client's origin SHALL get CORS headers, as for every other route.

#### Scenario: All plans in week order
- **WHEN** plans for the weeks of 2026-11-30, 2026-11-16 and 2026-11-23 were saved in that order
- **THEN** `GET /api/plans` returns three records ordered 2026-11-16, 2026-11-23, 2026-11-30, each with its plan, onboarding, `weekStart` and creation time

#### Scenario: No plan yet
- **WHEN** no plan is stored
- **THEN** `GET /api/plans` returns `{ "plans": [] }`

#### Scenario: Reading does not call the coach or count
- **WHEN** `GET /api/plans` is called
- **THEN** the coach is not called and the day's call count is the same as before

#### Scenario: A rebuilt week is listed once
- **WHEN** the plan of one week was built twice
- **THEN** `GET /api/plans` lists that week once, with the newer plan

#### Scenario: A store failure
- **WHEN** the store fails while the list is read
- **THEN** the answer is a 500 `server_error` that carries no database detail

### Requirement: The plan shown on start
When the page opens, or is reloaded, and at least one plan is stored, the client SHALL show the plan of the current calendar week, taken on the athlete's own calendar, when one is stored. Otherwise it SHALL show the plan with the latest creation time, and the one with the highest id when creation times are equal.

#### Scenario: The current week opens
- **WHEN** plans for the weeks of 2026-11-16, 2026-11-23 and 2026-11-30 are stored, the last one made most recently, and today is Thursday 2026-11-26
- **THEN** the plan view shows the plan of the week of 2026-11-23

#### Scenario: No plan for the current week
- **WHEN** plans for the weeks of 2026-11-02 (made first) and 2026-11-09 (made second) are stored and today is Thursday 2026-11-26
- **THEN** the plan view shows the plan of the week of 2026-11-09

#### Scenario: The athlete's calendar decides the current week
- **WHEN** the athlete's clock reads 01:30 on Monday 2026-11-30 (23:30 UTC on Sunday 2026-11-29) and plans for the weeks of 2026-11-23 and 2026-11-30 are stored
- **THEN** the plan of the week of 2026-11-30 is shown

### Requirement: Moving between weeks
When two or more plans are stored, the plan view SHALL show a week switcher in the summary card's header: the text "Week of 23 Nov · 2 of 5" (the summary's week line, extended: the text "Week of 23 Nov" stays, followed by the shown plan's position among the stored plans counted from the oldest, and how many are stored), and two icon buttons named "Earlier plan" and "Later plan", each at least 44 by 44 px on a touch screen. "Earlier plan" SHALL show the plan of the previous stored week and "Later plan" the plan of the next stored week, skipping weeks that have no plan. Moving SHALL send no request. At the oldest plan "Earlier plan" and at the newest plan "Later plan" SHALL stay focusable, be marked `aria-disabled`, and do nothing. The switcher's text SHALL be announced politely when it changes. Moving to another week SHALL close an open deletion confirmation and clear a deletion alert or status line, and focus SHALL stay on the button that was pressed. While a deletion runs the two buttons SHALL be disabled. With one stored plan the header SHALL show "Week of 23 Nov" and no buttons and no count.

#### Scenario: The switcher shows the position
- **WHEN** five plans are stored and the third oldest is shown
- **THEN** the header reads "Week of 9 Nov · 3 of 5" with "Earlier plan" and "Later plan" beside it

#### Scenario: Earlier and later move one stored week
- **WHEN** the athlete presses "Earlier plan" and then "Later plan"
- **THEN** the plan of the previous stored week is shown, then the plan of the week they started on, and no request is sent

#### Scenario: Weeks without a plan are skipped
- **WHEN** plans for the weeks of 2026-11-02 and 2026-11-23 are stored and the athlete presses "Earlier plan" on the second
- **THEN** the plan of the week of 2026-11-02 is shown and the text reads "Week of 2 Nov · 1 of 2"

#### Scenario: The ends do nothing
- **WHEN** the oldest plan is shown and the athlete presses "Earlier plan", or the newest plan is shown and the athlete presses "Later plan"
- **THEN** the same plan stays shown, the pressed button keeps focus, and it is marked `aria-disabled`

#### Scenario: One plan has no switcher
- **WHEN** exactly one plan is stored
- **THEN** the header reads "Week of 23 Nov" with no buttons and no count

#### Scenario: Moving closes a question
- **WHEN** the deletion confirmation is open and the athlete moves to another week
- **THEN** the confirmation is gone and the other plan is shown

#### Scenario: Moving clears a failure alert
- **WHEN** a deletion alert is shown and the athlete moves to another week
- **THEN** the alert is gone and the other plan is shown

#### Scenario: Moving clears the status line
- **WHEN** the status line of a deletion is shown and the athlete moves to another week
- **THEN** the status line is gone and the other plan is shown

#### Scenario: The change is announced
- **WHEN** the athlete moves to another week
- **THEN** the new switcher text is in a polite live region

#### Scenario: Disabled while a deletion runs
- **WHEN** a deletion request is running
- **THEN** both switcher buttons are disabled until it ends

### Requirement: A new or replaced plan is shown
After a successful build the client SHALL show the plan just built, and the stored plans it holds SHALL list that week once: a new week is added in its place in week order, and a rebuilt week takes the place of the plan it replaced.

#### Scenario: A new week joins the list
- **WHEN** plans for the weeks of 2026-11-16 and 2026-11-23 are stored and the athlete builds the week of 2026-11-30
- **THEN** the new plan is shown, the text reads "Week of 30 Nov · 3 of 3", and "Earlier plan" shows the week of 2026-11-23

#### Scenario: A rebuilt week is not duplicated
- **WHEN** the athlete rebuilds the week of 2026-11-23
- **THEN** the new plan is shown, the number of stored plans is the same, and the old plan of that week is gone

### Requirement: A warning before a plan replaces another
When the form view is open and the week its request will carry already has a stored plan, the form SHALL show above its fields the note "You already have a plan for the week of 30 Nov. Building a new one replaces it." (that week, written as in the summary). The week is the one `plan-week` says the request carries: the Monday of the current week for the first plan and for "New plan", and the shown plan's week plus seven days, never before the current week, for "Plan next week". The note SHALL be information only: it SHALL NOT block, change or hide anything, and no note SHALL show when that week has no plan.

#### Scenario: New plan for a week that has a plan
- **WHEN** the plan of the current week is stored and the athlete presses "New plan"
- **THEN** the form shows "You already have a plan for the week of 23 Nov. Building a new one replaces it."

#### Scenario: Plan next week into a week that has a plan
- **WHEN** the plans of the weeks of 2026-11-23 and 2026-11-30 are stored, the first is shown, and the athlete presses "Plan next week"
- **THEN** the form shows the note for the week of 30 Nov

#### Scenario: No note for a free week
- **WHEN** the plan of the current week is shown and the athlete presses "Plan next week" and the next week has no plan
- **THEN** the form shows no note

#### Scenario: The first plan has no note
- **WHEN** no plan is stored and the form is open
- **THEN** the form shows no note

#### Scenario: The note does not block
- **WHEN** the note is shown and the athlete submits the form
- **THEN** the request is sent as for any form and the plan of that week is replaced
