# plan-deletion Specification

## Purpose
Defines how a plan is deleted: the server removes it from storage, and the client offers a trash button in the summary card that asks first, deletes the plan on screen, and opens a new form.

## Requirements

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
The plan view SHALL offer deletion as an icon-only trash button named "Delete this plan", at the top right of the summary card, level with the "Your plan" heading, at least 44 by 44 px on a touch screen. The row below the plan SHALL hold only "Plan next week" and "New plan". Pressing the trash button SHALL send nothing and SHALL show, inside the summary card under the heading row, a confirmation "Delete the plan for the week of 23 Nov? This cannot be undone." (the shown plan's own week, written as in the summary; when other plans are stored it ends with " Your other plans stay."), with "Cancel" first and "Delete plan" second, and focus on "Cancel"; while it is open the trash button is not shown. A press on "Delete plan" in the first half second after the confirmation opens SHALL be ignored. "Cancel" SHALL close the confirmation and bring the trash button back, with focus on it. Pressing "Plan next week" or "New plan" while the confirmation is open SHALL close it. "Delete plan" SHALL send the deletion of the plan that is shown (by its id, whatever other plans are stored and whichever week the switcher has opened), once however often it is pressed, with both confirmation buttons disabled while it runs. On success, or when the server says the plan is already gone, the deleted plan SHALL no longer be among the stored plans the page holds. When other plans remain, the nearest remaining week SHALL be shown, which is the next later week that has a plan, or the previous earlier week when no later one remains, with the status line "Deleted the plan for the week of 23 Nov. Showing the week of 30 Nov." (`role="status"`) in the summary card and focus on the plan view's heading. When no plan remains, the empty form view SHALL open, with its heading focused. When the server answers with an error the plan SHALL stay shown, the confirmation SHALL close, the trash button SHALL be back, and an alert "The plan could not be deleted. Nothing was changed. You can try again." SHALL show in the summary card and take focus. When no answer arrives (a timeout or a network error) the plan SHALL stay shown, the confirmation SHALL close, the trash button SHALL be back, and an alert "The plan may already be deleted. Reload the page to check, or try again." SHALL show in the summary card and take focus.

#### Scenario: Button is offered with a plan
- **WHEN** a plan is shown
- **THEN** the trash button "Delete this plan" is at the top right of the summary card, "Plan next week" and "New plan" are the only buttons below the plan, and the trash button is not offered in the form view or while the saved plan loads

#### Scenario: Confirmation comes first
- **WHEN** the athlete presses the trash button while other plans are stored
- **THEN** no request is sent, the confirmation "Delete the plan for the week of 23 Nov? This cannot be undone. Your other plans stay." shows in the summary card with "Cancel" and then "Delete plan", the trash button is hidden, and focus is on "Cancel"; with no other plan stored the question ends after "This cannot be undone."

#### Scenario: A double click does not confirm
- **WHEN** the athlete double-clicks the trash button
- **THEN** the confirmation is shown and no request is sent

#### Scenario: Cancel keeps the plan
- **WHEN** the athlete presses "Cancel"
- **THEN** the plan is unchanged, no request was sent, the confirmation is closed and the trash button is back with focus on it

#### Scenario: The deletion names the shown plan
- **WHEN** the athlete has opened an earlier week with the switcher while a plan for a later week is also stored, and confirms
- **THEN** the deletion is sent for the shown plan's id and the plan of the later week stays stored

#### Scenario: Confirming deletes the plan and opens a new form
- **WHEN** the athlete presses "Delete plan" for the only stored plan and the server answers 204
- **THEN** the plan is no longer shown, the form view opens empty with the heading "New plan" focused, no earlier plan's answers are in it, and no failure message shows

#### Scenario: A reload does not show the deleted plan
- **WHEN** the page is reloaded after a plan was deleted
- **THEN** the deleted plan is not shown and `GET /api/plans` does not list it

#### Scenario: An older plan can remain stored
- **WHEN** an older week's plan is stored and the plan of the newest week is deleted
- **THEN** the older plan is shown at once with the status line naming both weeks, and nothing is read again

#### Scenario: The next later week is shown first
- **WHEN** the plans of three weeks are stored, the middle one is shown, and it is deleted
- **THEN** the plan of the later week is shown, the status line names the deleted week and the shown week, and the heading of the plan view has focus

#### Scenario: The previous week is shown when none is later
- **WHEN** the plan of the newest week is shown and deleted while earlier weeks are stored
- **THEN** the plan of the previous stored week is shown with the status line

#### Scenario: One request however often it is pressed
- **WHEN** the athlete presses "Delete plan" twice in a row
- **THEN** one deletion request is sent, and "Delete plan" and "Cancel" are disabled while it runs

#### Scenario: A failed deletion keeps the plan
- **WHEN** the server answers the deletion with an error
- **THEN** the plan stays shown, the confirmation is closed, the trash button is back, and an alert in the summary card says "The plan could not be deleted. Nothing was changed. You can try again." and has focus

#### Scenario: A deletion that may have happened says so
- **WHEN** the deletion times out or the connection fails
- **THEN** the plan stays shown, the confirmation is closed, the trash button is back, and an alert in the summary card says "The plan may already be deleted. Reload the page to check, or try again." and has focus

#### Scenario: A plan that is already gone counts as deleted
- **WHEN** the server answers 404 `not_found` to the deletion
- **THEN** the client behaves as for a successful deletion
