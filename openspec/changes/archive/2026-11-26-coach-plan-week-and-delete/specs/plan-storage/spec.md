## MODIFIED Requirements

### Requirement: Reload without a coach call
`GET /api/plan` SHALL return the latest saved plan record (the plan, its onboarding, the week it is for, and when it was created) or `null`, and SHALL NOT call the coach. The latest plan is the one with the highest creation time, ordered by id when times are equal.

#### Scenario: Reload shows the same plan
- **WHEN** the page is reloaded and a plan exists
- **THEN** the same plan is shown and the coach is not called

#### Scenario: No plan yet
- **WHEN** no plan has been saved
- **THEN** `GET /api/plan` returns `null`

#### Scenario: Latest plan wins
- **WHEN** several plans are saved
- **THEN** the one with the highest creation time is returned, and when creation times are equal, the one with the highest id

#### Scenario: Record carries its week
- **WHEN** a plan exists
- **THEN** `GET /api/plan` returns its plan, its onboarding, its creation time and its `weekStart`
