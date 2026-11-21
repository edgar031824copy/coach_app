## Purpose

Defines the one-week combined plan the coach produces from a valid onboarding, the checks a response must pass before it is saved, and the distinct errors returned when generation fails.

## ADDED Requirements

### Requirement: Seven-day plan
The system SHALL return a plan with exactly seven entries, one for each of mon to sun, and SHALL reject any coach response that does not.

#### Scenario: Valid onboarding gives seven days
- **WHEN** the onboarding is valid
- **THEN** the plan has one entry for each of mon to sun

#### Scenario: Six days is rejected
- **WHEN** the coach response has six days
- **THEN** it is rejected as an invalid coach response

#### Scenario: Duplicate days is rejected
- **WHEN** the coach response lists the same day twice
- **THEN** it is rejected as an invalid coach response

### Requirement: At least one rest day
The system SHALL ensure the plan has at least one day with no sessions, so a plan can have six training days and one rest day. The only exception is a pasted running plan whose own sessions, as placed in the plan, occupy all seven days; the athlete's sessions are never changed to make room. Days the athlete did not declare as available are rest days unless a pasted session falls on them.

#### Scenario: Six training days and one rest day
- **WHEN** the plan has sessions on six days and none on the seventh
- **THEN** the plan is accepted

#### Scenario: No rest day is rejected
- **WHEN** every day has a session, the athlete's own pasted sessions leave at least one day empty, and the coach filled it
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Coach fills all seven days without a paste
- **WHEN** no running plan was pasted and every day has a session
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Pasted plan covers all seven days
- **WHEN** a pasted plan's own sessions cover all seven days
- **THEN** the plan is accepted without a rest day

#### Scenario: Undeclared days are rest days
- **WHEN** the athlete declared fewer than seven available days and no pasted session falls on the others
- **THEN** the undeclared days have no sessions

### Requirement: Coach sessions on declared days only
The system SHALL place a session with `source: "coach"` only on a day the athlete declared for that discipline. Sessions with `source: "athlete"` are exempt and follow the pasted plan.

#### Scenario: Coach session on an undeclared day is rejected
- **WHEN** a coach session falls on a day the athlete did not declare for that discipline
- **THEN** the response is rejected as an invalid coach response

### Requirement: Combined-load note
The system SHALL give a non-empty `combinedLoadNote` to every day that has both a running and a CrossFit session, whatever the source of each.

#### Scenario: Both disciplines on one day
- **WHEN** a day has a running session and a CrossFit session
- **THEN** its `combinedLoadNote` is non-empty

#### Scenario: Pasted running session shares a day with a coach CrossFit session
- **WHEN** a pasted running session and a coach CrossFit session fall on the same day
- **THEN** that day's `combinedLoadNote` is non-empty

### Requirement: Volume guard from stated weekly training
When the athlete gave `weeklyTraining` and no running plan was pasted, the system SHALL limit each discipline's weekly session count to at most the larger of 1.3 times the stated count (rounded down) and the stated count plus 2 🔶. Running km is passed to the coach as input only and is not validated.

#### Scenario: Within the limit
- **WHEN** a discipline's planned sessions do not exceed the limit
- **THEN** the plan is accepted

#### Scenario: Above the limit
- **WHEN** a discipline's planned sessions exceed the limit
- **THEN** the response is rejected as an invalid coach response

### Requirement: Target event as context
When the athlete gave a `targetEvent`, the system SHALL include it in the request to the coach. It adds no other rule.

#### Scenario: Event is sent to the coach
- **WHEN** the onboarding has a `targetEvent`
- **THEN** the request to the coach contains the event name, the event date, and today's UTC date

### Requirement: Distinct failure outcomes
The system SHALL return a distinct, observable error for each failure and SHALL save nothing when generation fails: `coach_unavailable` when the coach errors or exceeds the coach timeout (30 s 🔶; HTTP 502 🔶), and `invalid_coach_response` when the response fails validation (HTTP 422 🔶). Both SHALL offer a retry, and both count toward the daily cap. A refusal, a truncated response, or a response with the wrong shape SHALL count as an invalid coach response. When a response is both unreadable and invalid, `plan_unreadable` SHALL win.

#### Scenario: Coach error
- **WHEN** the coach call fails
- **THEN** the error is `coach_unavailable`, a retry is offered, and nothing is saved

#### Scenario: Coach timeout
- **WHEN** the coach does not answer within the coach timeout
- **THEN** the error is `coach_unavailable`, a retry is offered, and nothing is saved

#### Scenario: Invalid coach response
- **WHEN** the coach returns a response that fails validation
- **THEN** the error is `invalid_coach_response`, a retry is offered, and nothing is saved

#### Scenario: Malformed coach output
- **WHEN** the coach refuses, stops because it ran out of output space, or returns a response that does not match the response shape
- **THEN** the error is `invalid_coach_response`, a retry is offered, and nothing is saved

#### Scenario: Unreadable and invalid at once
- **WHEN** a pasted plan was given and the response has an empty `understoodRunning` and also breaks another rule
- **THEN** the error is `plan_unreadable`

#### Scenario: No partial plan
- **WHEN** generation fails for any reason
- **THEN** no partial plan exists in storage
