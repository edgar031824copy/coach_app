## Purpose

Defines how a pasted multi-week running plan is read and kept exactly as the athlete wrote it (PRD Principle 5), while the coach adds only CrossFit sessions, notes, and non-binding recommendations.

## ADDED Requirements

### Requirement: Only the chosen week is used
When a running plan is pasted, the system SHALL use only the rows of week `pastedPlanWeek`.

#### Scenario: Multi-week paste uses the chosen week
- **WHEN** a plan with several weeks is pasted and `pastedPlanWeek` is 3 (eval-verified, evaluation scenario 2)
- **THEN** only the sessions of week 3 appear as athlete sessions in the plan

#### Scenario: No rows for the chosen week
- **WHEN** the paste has no rows for week `pastedPlanWeek` (for example, week 13 of a 12-week plan)
- **THEN** the error is `plan_unreadable` (HTTP 422 🔶), the athlete is told no sessions were found for that week, and nothing is saved

### Requirement: Pasted sessions are kept unchanged
The system SHALL show the running sessions of a pasted plan exactly as the coach reported reading them (`understoodRunning`), with `source: "athlete"`, the same description (exact string equality 🔶), and a day the paste allows. Intensity is the coach's own label and is not compared.

#### Scenario: Unchanged sessions are accepted
- **WHEN** the plan's running sessions match `understoodRunning` in description and day
- **THEN** the plan is accepted

#### Scenario: Altered session is rejected
- **WHEN** a running session's description differs from `understoodRunning`
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Dropped session is rejected
- **WHEN** a session in `understoodRunning` is missing from the plan
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Added running session is rejected
- **WHEN** the plan contains a running session that is not in `understoodRunning`
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Session outside its allowed days is rejected
- **WHEN** a pasted session is placed on a day outside its `dayOptions`
- **THEN** the response is rejected as an invalid coach response

#### Scenario: Identical descriptions are matched one to one
- **WHEN** two pasted sessions have the same description and the plan contains it only once
- **THEN** the response is rejected as an invalid coach response

### Requirement: Flexible days
When a pasted row allows several days (for example "Friday/Saturday/Sunday"), the system SHALL list them as `dayOptions` and the plan SHALL place the session on exactly one of them.

#### Scenario: Row with several days
- **WHEN** a row reads "Friday/Saturday/Sunday" (eval-verified, evaluation scenario 2)
- **THEN** `understoodRunning` lists fri, sat, and sun as `dayOptions` and the plan has the session on exactly one of them

### Requirement: Unreadable paste
The system SHALL reject a response whose `understoodRunning` is empty when a running plan was pasted, and SHALL tell the athlete the plan could not be read. When no plan was pasted, `understoodRunning` SHALL be empty and the plan SHALL contain no `source: "athlete"` sessions.

#### Scenario: Paste with no running sessions
- **WHEN** a plan is pasted and the coach reports no running sessions read
- **THEN** the error is `plan_unreadable`, the athlete is told the plan could not be read, and nothing is saved

#### Scenario: No paste
- **WHEN** no running plan was pasted
- **THEN** `understoodRunning` is empty and the plan has no `source: "athlete"` sessions

### Requirement: Coach adds only CrossFit sessions
With a pasted plan, the coach SHALL add only CrossFit sessions, and only on the declared CrossFit days.

#### Scenario: Coach adds a running session to a pasted plan
- **WHEN** a pasted plan is given and the response contains a coach-added running session
- **THEN** the response is rejected as an invalid coach response

#### Scenario: CrossFit on a declared day
- **WHEN** the coach adds a CrossFit session on a declared CrossFit day
- **THEN** the plan is accepted

### Requirement: Pasted text is untrusted data
The system SHALL send the pasted plan as delimited data to a coach with no tools, and SHALL reject any response that breaks the rules in this capability, whatever the pasted text says.

#### Scenario: Instruction inside the paste
- **WHEN** the pasted text contains an instruction aimed at the model and the coach obeys it by changing a running session
- **THEN** the response is rejected as an invalid coach response

### Requirement: Labels and recommendations
The system SHALL label sessions with `source: "athlete"` as "from your plan". It SHALL show each recommendation labeled "coach suggestion", and no recommendation SHALL change a session.

#### Scenario: Athlete sessions are labeled
- **WHEN** a plan with pasted sessions is shown
- **THEN** each session with `source: "athlete"` is labeled "from your plan"

#### Scenario: Recommendations never change sessions
- **WHEN** a plan has recommendations
- **THEN** each is labeled "coach suggestion" and the athlete's sessions are shown exactly as pasted
