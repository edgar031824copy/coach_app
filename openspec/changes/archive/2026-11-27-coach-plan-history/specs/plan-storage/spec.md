## MODIFIED Requirements

### Requirement: Submitting again replaces the shown plan
The system SHALL generate and save a plan on every successful submission. When the week of the submission already has a stored plan, the new plan SHALL replace it (the rule "One plan per week"); otherwise it SHALL be added. The client SHALL show the plan just built. Plans of other weeks SHALL stay stored and SHALL be reachable with the week switcher (`stored-plans`).

#### Scenario: Second submission
- **WHEN** the athlete submits the onboarding again for a week that already has a plan and it succeeds
- **THEN** the new plan is shown, it has taken the place of the earlier plan of that week, and the number of stored plans is the same

#### Scenario: A submission for another week is added
- **WHEN** the athlete submits for a week that has no plan and it succeeds
- **THEN** the new plan is shown and the plans of the other weeks remain stored and reachable with the switcher
