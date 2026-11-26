## Purpose
Defines how a plan is deleted: the server removes it from storage, and the client offers a "Delete this plan" button that asks first, deletes the plan on screen, and opens a new form.

## ADDED Requirements

### Requirement: Deleting a plan
`DELETE /api/plan/:id` SHALL remove the plan with that id from storage and answer 204 with no body. It SHALL NOT call the coach, spend or refund the daily cap, or change any other plan. An id that is not stored (including one already deleted) SHALL get a 404 error `not_found`. An id that is not a positive whole number written without leading zeros, or is larger than 9007199254740991, SHALL get a 400 validation error. In both cases nothing changes. After a deletion `GET /api/plan` SHALL never return the deleted plan. When two deletions of the same plan arrive together, one SHALL be answered 204 and the other 404. The client origin SHALL be allowed to use `DELETE` and every other origin refused as before.

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
- **WHEN** the id is "abc", "0", "-3", "1.5", "01" or "99999999999999999999"
- **THEN** the answer is a 400 validation error and nothing changes

#### Scenario: Two deletions at once
- **WHEN** two deletions of the same plan are sent at the same time
- **THEN** one is answered 204 and the other 404, and no other plan changes

#### Scenario: Cap and coach are untouched
- **WHEN** a plan is deleted
- **THEN** the coach is not called and the day's call count is the same as before

#### Scenario: Only the client origin may delete
- **WHEN** the browser asks permission for `DELETE` from the client's origin, and from another origin
- **THEN** the client's origin is allowed and the other origin is refused as for every other request

### Requirement: Delete button with a confirmation
The plan view SHALL offer "Delete this plan" beside "Plan next week" and "New plan". Pressing it SHALL send nothing and SHALL replace those three buttons with a confirmation, "Delete this plan? This cannot be undone.", with "Cancel" first and "Yes, delete" second, and focus on "Cancel"; a press on "Yes, delete" in the first half second after the confirmation opens SHALL be ignored, so a double click on "Delete this plan" cannot confirm. "Cancel" SHALL bring the three buttons back, with focus on "Delete this plan". "Yes, delete" SHALL send the deletion of the plan that is shown (by its id, whatever other plans are stored), once however often it is pressed, with both confirmation buttons disabled while it runs. On success, or when the server says the plan is already gone, the plan SHALL no longer be shown and the empty form view SHALL open, with its heading focused. When the server answers with an error the plan SHALL stay shown, with the three buttons back and an alert "The plan could not be deleted. Nothing was changed. You can try again." that takes focus. When no answer arrives (a timeout or a network error) the plan SHALL stay shown, with the three buttons back and an alert "The plan may already be deleted. Reload the page to check, or try again." that takes focus.

#### Scenario: Button is offered with a plan
- **WHEN** a plan is shown
- **THEN** "Delete this plan" is offered beside "Plan next week" and "New plan", and it is not offered in the form view or while the saved plan loads

#### Scenario: Confirmation comes first
- **WHEN** the athlete presses "Delete this plan"
- **THEN** no request is sent, the confirmation "Delete this plan? This cannot be undone." shows with "Cancel" and then "Yes, delete" in place of the three buttons, and focus is on "Cancel"

#### Scenario: A double click does not confirm
- **WHEN** the athlete double-clicks "Delete this plan"
- **THEN** the confirmation is shown and no request is sent

#### Scenario: Cancel keeps the plan
- **WHEN** the athlete presses "Cancel"
- **THEN** the plan is unchanged, no request was sent, the three buttons are back and focus is on "Delete this plan"

#### Scenario: The deletion names the shown plan
- **WHEN** the shown plan is stored under an id while a newer plan is also stored, and the athlete confirms
- **THEN** the deletion is sent for the shown plan's id and the newer plan stays stored

#### Scenario: Confirming deletes the plan and opens a new form
- **WHEN** the athlete presses "Yes, delete" and the server answers 204
- **THEN** the plan is no longer shown, the form view opens empty with the heading "New plan" focused, no earlier plan's answers are in it, and no failure message shows

#### Scenario: A reload does not show the deleted plan
- **WHEN** the page is reloaded after a plan was deleted
- **THEN** the deleted plan is not shown

#### Scenario: An older plan can remain stored
- **WHEN** an older plan is stored and the newest plan is deleted
- **THEN** the empty form opens now, and a reload shows the older plan as the saved plan

#### Scenario: One request however often it is pressed
- **WHEN** the athlete presses "Yes, delete" twice in a row
- **THEN** one deletion request is sent, and "Yes, delete" and "Cancel" are disabled while it runs

#### Scenario: A failed deletion keeps the plan
- **WHEN** the server answers the deletion with an error
- **THEN** the plan stays shown, the three buttons are back, and an alert says "The plan could not be deleted. Nothing was changed. You can try again." and has focus

#### Scenario: A deletion that may have happened says so
- **WHEN** the deletion times out or the connection fails
- **THEN** the plan stays shown, the three buttons are back, and an alert says "The plan may already be deleted. Reload the page to check, or try again." and has focus

#### Scenario: A plan that is already gone counts as deleted
- **WHEN** the server answers 404 `not_found` to the deletion
- **THEN** the client behaves as for a successful deletion
