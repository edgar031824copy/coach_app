## Purpose
Defines how a plan is deleted: the server removes it from storage, and the client offers a "Delete this plan" button that asks first, deletes, and opens a new form.

## ADDED Requirements

### Requirement: Deleting a plan
`DELETE /api/plan/:id` SHALL remove the plan with that id from storage and answer 204 with no body. It SHALL NOT call the coach, spend or refund the daily cap, or change any other plan. An id that is not stored (including one already deleted) SHALL get a 404 error `not_found`; an id that is not a positive whole number SHALL get a 400 validation error; in both cases nothing changes. After a deletion `GET /api/plan` SHALL never return the deleted plan. The client origin SHALL be allowed to use `DELETE` and every other origin refused as before.

#### Scenario: A stored plan is deleted
- **WHEN** `DELETE /api/plan/:id` is sent for a stored plan
- **THEN** the answer is 204 with no body and the plan is no longer stored

#### Scenario: A deleted plan never comes back
- **WHEN** the newest plan is deleted
- **THEN** `GET /api/plan` returns the next newest plan, or `null` when none is left, and never the deleted plan

#### Scenario: Other plans stay
- **WHEN** one of three stored plans is deleted
- **THEN** the other two remain stored with the same content

#### Scenario: Unknown plan
- **WHEN** the id is not stored, or the plan was already deleted
- **THEN** the answer is 404 with the error `not_found` and nothing changes

#### Scenario: Id is not a whole number
- **WHEN** the id is "abc", "0", "-3" or "1.5"
- **THEN** the answer is a 400 validation error and nothing changes

#### Scenario: Cap and coach are untouched
- **WHEN** a plan is deleted
- **THEN** the coach is not called and the day's call count is the same as before

#### Scenario: Only the client origin may delete
- **WHEN** the browser asks permission for `DELETE` from the client's origin, and from another origin
- **THEN** the client's origin is allowed and the other origin is refused as for every other request

### Requirement: Delete button with a confirmation
The plan view SHALL offer "Delete this plan" beside "Plan next week" and "New plan". Pressing it SHALL send nothing and SHALL replace those three buttons with a confirmation, "Delete this plan? This cannot be undone.", with "Yes, delete" and "Cancel", and focus on "Cancel". "Cancel" SHALL bring the three buttons back, with focus on "Delete this plan". "Yes, delete" SHALL send the deletion, with both confirmation buttons disabled while it runs. On success, or when the server says the plan is already gone, the plan SHALL no longer be shown and the empty form view SHALL open, with its heading focused. On any other failure the plan SHALL stay shown, with the three buttons back and an alert "The plan could not be deleted. Nothing was changed. You can try again." that takes focus.

#### Scenario: Button is offered with a plan
- **WHEN** a plan is shown
- **THEN** "Delete this plan" is offered beside "Plan next week" and "New plan", and it is not offered in the form view or while the saved plan loads

#### Scenario: Confirmation comes first
- **WHEN** the athlete presses "Delete this plan"
- **THEN** no request is sent, the confirmation "Delete this plan? This cannot be undone." shows with "Yes, delete" and "Cancel" in place of the three buttons, and focus is on "Cancel"

#### Scenario: Cancel keeps the plan
- **WHEN** the athlete presses "Cancel"
- **THEN** the plan is unchanged, no request was sent, the three buttons are back and focus is on "Delete this plan"

#### Scenario: Confirming deletes the plan and opens a new form
- **WHEN** the athlete presses "Yes, delete" and the server answers 204
- **THEN** the plan is no longer shown, the form view opens empty with the heading "New plan" focused, no earlier plan's answers are in it, and no failure message shows

#### Scenario: A reload does not show the deleted plan
- **WHEN** the page is reloaded after a plan was deleted
- **THEN** the deleted plan is not shown

#### Scenario: Buttons are disabled while deleting
- **WHEN** the deletion request is running
- **THEN** "Yes, delete" and "Cancel" are disabled

#### Scenario: A failed deletion keeps the plan
- **WHEN** the deletion fails with a server error, a network error or a timeout
- **THEN** the plan stays shown, the three buttons are back, and an alert says "The plan could not be deleted. Nothing was changed. You can try again." and has focus

#### Scenario: A plan that is already gone counts as deleted
- **WHEN** the server answers 404 `not_found` to the deletion
- **THEN** the client behaves as for a successful deletion
