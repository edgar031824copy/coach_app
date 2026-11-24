## Purpose
Defines how the client presents loading, building, waking and failure states. It changes how they look and how clearly they are worded, not when they appear, which failures offer a retry, or the information the messages carry.

## ADDED Requirements

### Requirement: Loading, building and waking states
The client SHALL show "Building your plan…" with `role="status"` while a request runs, and the waking state ("Waking up the coach…") with `role="status"` once the request has had no response for 3 seconds, as in E1.

#### Scenario: Building
- **WHEN** a submit is sent
- **THEN** "Building your plan…" is shown with `role="status"`

#### Scenario: Waking after three seconds
- **WHEN** a request has had no response after 3 seconds
- **THEN** a message containing "Waking up the coach" is shown with `role="status"`, and not before

### Requirement: Failures
A failure SHALL be announced with `role="alert"`, SHALL say what happened and what to do, in plain sentence-case words without an apology, and SHALL offer "Try again" under exactly the conditions E1 defines. Reworded messages SHALL keep the information of the E1 messages.

#### Scenario: Alert role
- **WHEN** a request fails
- **THEN** the failure message is inside an element with `role="alert"` at the moment it appears

#### Scenario: Retry rules unchanged
- **WHEN** the last allowed call of the day failed with `coach_unavailable`
- **THEN** no "Try again" is offered and the text "No retries remain today." is shown

#### Scenario: Timeout keeps its hint
- **WHEN** the request times out
- **THEN** the message says the plan may still have been saved and that reloading the page will show it

#### Scenario: A retry is offered where E1 offers one
- **WHEN** a request fails with `coach_unavailable`, `invalid_coach_response`, `server_error`, a network error or a timeout and calls remain
- **THEN** "Try again" is offered

#### Scenario: Validation failure shows fields
- **WHEN** the server answers `validation_error` with field errors
- **THEN** the message "Some answers need fixing. Check the highlighted fields." is shown, each field shows its own message, and no retry is offered

#### Scenario: No retries remain for an unreadable week
- **WHEN** the server answers `plan_unreadable` and no calls remain
- **THEN** "No retries remain today." is shown

#### Scenario: Daily limit
- **WHEN** the server answers `daily_limit_reached`
- **THEN** the message contains "Daily limit reached", and no retry is offered

#### Scenario: Unreadable pasted week
- **WHEN** the server answers `plan_unreadable` with its sentence
- **THEN** the server's sentence is shown intact, followed by the client's hint to check the pasted plan and the week number

### Requirement: Earlier plan survives a failure
A failed request SHALL never remove, replace or hide the plan that was shown before it; the plan stays reachable.

#### Scenario: Earlier plan after a failure
- **WHEN** a plan is saved, a new request fails, and the athlete opens "My plan"
- **THEN** the earlier plan is shown unchanged
