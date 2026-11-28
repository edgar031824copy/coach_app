## MODIFIED Requirements

### Requirement: Start state
On start the client SHALL read the saved plans with `GET /api/plans` and show a neutral loading state, with neither view, until the read ends. It SHALL then show the plan view when at least one plan exists, with the plan that "The plan shown on start" chooses, and the form view when none exists or the read fails. When the read failed, the client SHALL read `GET /api/plans` again after the next successful build, so the switcher lists every stored plan; if that read fails too, the client SHALL keep showing the plan just built with what it holds.

#### Scenario: Loading before the read ends
- **WHEN** the page opens and the saved-plan read has not finished
- **THEN** "Loading your saved plan…" is shown with `role="status"` and neither the plan view nor the form is shown

#### Scenario: A saved plan opens the plan view
- **WHEN** the read returns one or more saved plans
- **THEN** the plan view shows the plan chosen by "The plan shown on start" and the form view is not shown

#### Scenario: No saved plan opens the form view
- **WHEN** the read returns no plan
- **THEN** the form view is shown, empty, with no "My plan" link

#### Scenario: A failed read opens the form view with a message
- **WHEN** the read fails
- **THEN** the form view is shown with the message "Could not load your saved plan. You can still build a new one."

#### Scenario: A failed read is read again after a build
- **WHEN** the start read failed, other plans are stored, and the athlete builds a plan that succeeds
- **THEN** the client reads `GET /api/plans` again and the switcher lists every stored plan, and if that second read fails the plan just built is shown alone

#### Scenario: The failed-read message does not follow the athlete
- **WHEN** the read failed, the athlete built a plan, and then presses "New plan"
- **THEN** the failed-read message is no longer shown

#### Scenario: Opening the page does not move focus
- **WHEN** the page opens or reloads and the start state gives way to the first view
- **THEN** keyboard focus is not moved by the client
