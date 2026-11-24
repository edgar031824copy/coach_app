## Purpose
Defines the two views of the single page (the plan view and the form view), what shows while the saved plan is read, how the athlete moves between views, and what each outcome of a request shows. It changes how the page is navigated, not what any request does.

## ADDED Requirements

### Requirement: Start state
On start the client SHALL read the saved plan with `GET /api/plan` and show a neutral loading state, with neither view, until the read ends. It SHALL then show the plan view when a plan exists, and the form view when none exists or the read fails.

#### Scenario: Loading before the read ends
- **WHEN** the page opens and the saved-plan read has not finished
- **THEN** "Loading your saved plan…" is shown with `role="status"` and neither the plan view nor the form is shown

#### Scenario: A saved plan opens the plan view
- **WHEN** the read returns a saved plan
- **THEN** the plan view shows that plan and the form view is not shown

#### Scenario: No saved plan opens the form view
- **WHEN** the read returns no plan
- **THEN** the form view is shown, empty, with no "My plan" link

#### Scenario: A failed read opens the form view with a message
- **WHEN** the read fails
- **THEN** the form view is shown with the message "Could not load your saved plan. You can still build a new one."

### Requirement: Moving between views
The plan view SHALL offer "Plan next week" and "New plan"; the form view SHALL offer "My plan" whenever a plan exists. No move between views SHALL send a request. "New plan" SHALL open the form with every field at its E1 default. "Plan next week" SHALL open the form prefilled from the shown plan's saved onboarding exactly as in E1. Focus SHALL move to the heading of the view that opens.

#### Scenario: New plan opens an empty form
- **WHEN** the athlete presses "New plan" while a plan is shown
- **THEN** the form view opens with every field at its default, nothing of the earlier plan's onboarding in it, and no request is sent

#### Scenario: Plan next week opens a prefilled form
- **WHEN** the athlete presses "Plan next week"
- **THEN** the form view opens prefilled from the shown plan's saved onboarding with the pasted-plan week increased by one (a null week stays null), exactly as in E1

#### Scenario: My plan goes back without a request
- **WHEN** the athlete presses "My plan" in the form view
- **THEN** the plan view shows the same plan as before, no request is sent, and focus is on the plan view's heading

#### Scenario: Focus follows the view
- **WHEN** a view opens
- **THEN** keyboard focus is on that view's main heading, except that when the form view opens with field errors showing, focus is on the first field with an error

### Requirement: Outcomes of a submit
While a request runs the form view SHALL stay open, "Build my plan" SHALL be disabled, and "My plan" SHALL be disabled. A success SHALL open the plan view with the new plan. A failure SHALL leave the form view open with the failure shown, the earlier plan SHALL remain reachable through "My plan", and the failure and field errors SHALL clear when the view changes.

#### Scenario: Success shows the new plan
- **WHEN** a submit succeeds
- **THEN** the plan view opens with the new plan and the heading has focus

#### Scenario: Failure keeps the form and the earlier plan
- **WHEN** a submit fails while an earlier plan exists
- **THEN** the form view stays open with the failure message, and "My plan" shows the earlier plan unchanged

#### Scenario: A failure does not follow the athlete to a new form
- **WHEN** a submit fails, the athlete presses "My plan", then "New plan"
- **THEN** the empty form shows no failure message and no field error

#### Scenario: Controls are disabled while the request runs
- **WHEN** a submit is in flight
- **THEN** "Build my plan" and "My plan" are disabled, so no result arrives while the plan view is shown

#### Scenario: Try again after a failure
- **WHEN** a failure offers "Try again" and the athlete presses it and the request succeeds
- **THEN** the same onboarding is sent again and the plan view opens with the new plan

### Requirement: Labels named by the E1 specs keep their wording
The client SHALL keep the wording of the labels and messages that the E1 specs name, whatever their look: "Plan next week", "waking up the coach" (with its 3 s rule), "from your plan", "coach suggestion", "daily limit reached", "no retries remain today", "rest day", the pasted-plan week number, the safety note when the plan has one, the server's sentence for an unreadable pasted week, and the offer to retry after `coach_unavailable` and `invalid_coach_response`.

#### Scenario: Spec-named labels are present
- **WHEN** a plan with an athlete session, a recommendation, a rest day, a pasted-plan week and a safety note is shown
- **THEN** the text "from your plan", "coach suggestion", "Rest day", "Week N of your running plan" and the safety note appear, and "Plan next week" is offered

#### Scenario: Every E1 scenario still passes
- **WHEN** the E1 scenario tests run against the redesigned client
- **THEN** every E1 scenario passes, each test keeping its `@spec` tag and its intent, observed within the view where its subject lives
