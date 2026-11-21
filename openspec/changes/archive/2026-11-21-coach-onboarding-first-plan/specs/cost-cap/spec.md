## Purpose

Protects the API budget while there is no login, by limiting how many coach calls the app makes per day and by making that limit hold under concurrent requests.

## ADDED Requirements

### Requirement: Daily cap
The system SHALL limit coach calls to `MAX_COACH_CALLS_PER_DAY` per UTC day (default 20 🔶). When the limit is reached, `POST /api/plan` SHALL return 429 with the error `daily_limit_reached`, SHALL NOT call the coach, and the client SHALL show a "daily limit reached" message with no retry.

#### Scenario: Cap reached
- **WHEN** the day's coach calls have reached the limit
- **THEN** `POST /api/plan` returns 429 `daily_limit_reached`, the coach is not called, and the client shows a "daily limit reached" message with no retry

#### Scenario: Default limit
- **WHEN** `MAX_COACH_CALLS_PER_DAY` is not set
- **THEN** the limit is 20

#### Scenario: Invalid limit setting
- **WHEN** `MAX_COACH_CALLS_PER_DAY` is set to something that is not a positive integer
- **THEN** the server refuses to start

### Requirement: What counts toward the cap
A coach call SHALL count toward the cap whether it succeeds, fails, or returns a response rejected by validation. The count SHALL reset when a new UTC day starts.

#### Scenario: Failed call counts
- **WHEN** a coach call fails
- **THEN** it counts toward the cap

#### Scenario: Rejected response counts
- **WHEN** a coach response is rejected by validation
- **THEN** it counts toward the cap

#### Scenario: New day resets the count
- **WHEN** a new UTC day starts
- **THEN** the count is zero

### Requirement: Cap holds under concurrency
The system SHALL check and increment the count as one atomic operation before calling the coach 🔶, so concurrent requests cannot exceed the cap.

#### Scenario: Two requests with one call left
- **WHEN** two requests arrive at the same time with one call left
- **THEN** only one reaches the coach and the other gets 429 `daily_limit_reached`

### Requirement: Last allowed call fails
When the last allowed call fails, the client SHALL show the error and state that no retries remain today.

#### Scenario: Last call fails
- **WHEN** the last allowed call fails
- **THEN** the client shows the error and says no retries remain today
