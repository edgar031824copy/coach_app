## Purpose
Defines how the onboarding form is laid out and the helpers around it: sections, a segmented level choice, day buttons, quick goal ideas, folded optional parts, a progress cue, and a pinned primary button. The fields, values, validation and submit are exactly E1's.

## ADDED Requirements

### Requirement: Sections and folded optional parts
The form view SHALL group the fields into four sections (goal, level, week, pain or injury), each with a heading. The pain or injury field SHALL always be visible. "I already follow a running plan", "My usual week" and "Target event" SHALL be collapsed by default, SHALL open and close on request, and their values SHALL be kept and submitted whether open or closed.

#### Scenario: Four sections
- **WHEN** the form view opens
- **THEN** it shows the goal, level, week, and pain or injury sections, each under a heading, and the pain or injury field is visible

#### Scenario: Optional parts are folded
- **WHEN** the form view opens
- **THEN** the three optional parts are collapsed, and opening one shows its fields

#### Scenario: Folded values are still sent
- **WHEN** the athlete fills "Target event", closes it, and submits
- **THEN** the request contains the event name and date

### Requirement: Level choice
Each level (running and CrossFit) SHALL be chosen with one control offering Beginner, Intermediate and Advanced, with none selected on an empty form, and the same three values as E1.

#### Scenario: No level on an empty form
- **WHEN** the form opens empty
- **THEN** neither level is selected

#### Scenario: Choosing a level
- **WHEN** the athlete picks Advanced for running
- **THEN** only Advanced is selected for running, and the request carries `runningLevel: "advanced"`

#### Scenario: Level is required
- **WHEN** the athlete submits with no running level
- **THEN** the message "Choose your running level." shows on that control and no request is sent

### Requirement: Day buttons
The running days and the CrossFit days SHALL each be seven buttons, Monday to Sunday, that toggle on and off, with the same rule as E1 that at least one training day or a pasted plan is required.

#### Scenario: Toggle a day
- **WHEN** the athlete presses Tue under running days twice
- **THEN** Tue is selected after the first press and not selected after the second

#### Scenario: No day and no pasted plan
- **WHEN** the athlete submits with no day selected and no pasted plan
- **THEN** the E1 message for the missing days shows and no request is sent

### Requirement: Quick goal ideas
While the goal is empty the form SHALL offer short ideas ("Half marathon", "10K", "Stay fit and balanced", "Get stronger"); pressing one SHALL put its text in the goal field, where it can be edited. Once the goal has text the ideas SHALL no longer be shown.

#### Scenario: An idea fills the goal
- **WHEN** the goal is empty and the athlete presses "10K"
- **THEN** the goal field contains "10K" and the ideas are hidden

#### Scenario: Typed goals are never replaced
- **WHEN** the athlete has typed a goal
- **THEN** no idea is shown, so none can overwrite it

### Requirement: Progress cue
The form SHALL show how many of its four required answers are done (goal, running level, CrossFit level, and at least one training day or a pasted plan), updating as the athlete answers. The cue SHALL NOT block or enable submitting.

#### Scenario: Cue counts answers
- **WHEN** the goal and the running level are filled and nothing else
- **THEN** the cue reads "2 of 4 required answers done"

#### Scenario: Cue never blocks
- **WHEN** fewer than four answers are done and the athlete presses "Build my plan"
- **THEN** the E1 validation messages show and no request is sent, exactly as in E1

### Requirement: Same validation and behavior as E1
Validation timing and messages, the focus on the first invalid field on submit, server field errors on their own fields, and the prefilled form for "Plan next week" including the week 53 field error SHALL work as in E1.

#### Scenario: Server field error on its field
- **WHEN** the server answers 400 with an error for a field
- **THEN** the message shows on that field

#### Scenario: Focus on the first invalid field
- **WHEN** the athlete submits an invalid form
- **THEN** focus moves to the first invalid field and no request is sent

#### Scenario: Week 53 after Plan next week
- **WHEN** the shown plan was built for week 52 and the athlete presses "Plan next week"
- **THEN** the form opens with week 53 and its field error visible and editable before submitting

### Requirement: The primary button stays in reach on a phone
On a phone-width screen the "Build my plan" button SHALL stay visible at the bottom of the screen while the form is scrolled.

#### Scenario: Button visible without scrolling to the end
- **WHEN** the form view is open at 360 by 740 pixels and scrolled to the top
- **THEN** "Build my plan" is inside the visible screen
