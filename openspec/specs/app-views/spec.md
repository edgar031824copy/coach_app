# app-views Specification

## Purpose
Defines the two views of the single page (the plan view and the form view), what shows while the saved plan is read, how the athlete moves between views, and what each outcome of a request shows. It changes how the page is navigated, not what any request does.

## Requirements

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

#### Scenario: The failed-read message does not follow the athlete
- **WHEN** the read failed, the athlete built a plan, and then presses "New plan"
- **THEN** the failed-read message is no longer shown

#### Scenario: Opening the page does not move focus
- **WHEN** the page opens or reloads and the start state gives way to the first view
- **THEN** keyboard focus is not moved by the client

### Requirement: Moving between views
The plan view SHALL offer "Plan next week" and "New plan"; the form view SHALL offer "My plan" whenever a plan exists. No move between views SHALL send a request. "New plan" SHALL open the form with every field at its E1 default. "Plan next week" SHALL open the form prefilled from the shown plan's saved onboarding exactly as in E1. Focus SHALL move to the main heading of the view that opens, except on the first view after the page opens, and except when the form opens with a field error, where it moves to the first field with an error. The form view's main heading is "New plan" and the plan view's is "Your plan".

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
- **WHEN** the athlete opens a view by pressing "New plan", "My plan" or "Plan next week" with a form that has no field error
- **THEN** keyboard focus is on that view's main heading

#### Scenario: Focus goes to the first error when the form opens with one
- **WHEN** the shown plan was built for week 52 and the athlete presses "Plan next week", so the form opens with the week 53 error showing
- **THEN** keyboard focus is on the first field with an error and not on the heading

#### Scenario: Plan next week uses the saved plan
- **WHEN** a submit fails, the athlete presses "My plan", then "Plan next week"
- **THEN** the form is prefilled from the saved plan's onboarding and not from the failed attempt, and anything typed but not submitted is gone

### Requirement: Outcomes of a submit
While a request runs the form view SHALL stay open, "Build my plan" SHALL be disabled, and "My plan" SHALL be disabled. A success SHALL open the plan view with the new plan. A failure SHALL leave the form view open with the failure shown, the earlier plan SHALL remain reachable through "My plan", the failure and field errors SHALL clear when the view changes, and focus SHALL move to the first field with an error or, when there is none, to the failure message.

#### Scenario: Success shows the new plan
- **WHEN** a submit succeeds
- **THEN** the plan view opens with the new plan and the heading has focus

#### Scenario: Failure keeps the form and the earlier plan
- **WHEN** a submit fails while an earlier plan exists
- **THEN** the form view stays open with the failure message, and "My plan" shows the earlier plan unchanged

#### Scenario: A failure does not follow the athlete to a new form
- **WHEN** a submit fails, the athlete presses "My plan", then "New plan"
- **THEN** the empty form shows no failure message and no field error

#### Scenario: A failure moves focus
- **WHEN** a submit fails with a failure that names no field (the coach is unavailable, a timeout, a network error, or the daily limit)
- **THEN** keyboard focus moves to the failure message

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

#### Scenario: Accessible names are kept
- **WHEN** the plan view is shown
- **THEN** it has a heading named "Your plan", a list named "Coach suggestions" when the plan has recommendations, a note named "Safety note" when it has a safety note, and seven items each named by its day

#### Scenario: E1 test tags are kept
- **WHEN** `scripts/trace` runs against this change
- **THEN** no `@spec` tag that exists on `master` is missing, so every E1 scenario keeps a passing test within the view where its subject lives
