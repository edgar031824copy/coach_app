## MODIFIED Requirements

### Requirement: Summary of the week
The plan view SHALL show a summary with the number of running sessions, the number of CrossFit sessions, and the number of rest days, counted from the plan's own sessions and days, and SHALL show "Week N of your running plan" when the pasted-plan week is known. It SHALL also show the week the plan is for as "Week of 23 Nov" (the Monday's day and a three-letter English month name: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) and the day it was made as "Made 26 Nov" (in the athlete's own calendar), for every plan.

#### Scenario: Counts match the plan
- **WHEN** a plan has 3 running sessions, 5 CrossFit sessions and 1 rest day
- **THEN** the summary shows "3 runs", "5 CrossFit" and "1 rest day" (the number, then the singular "run" or "rest day" when it is 1 and "runs" or "rest days" otherwise, and always "CrossFit")

#### Scenario: Two sessions on a day count twice
- **WHEN** one day has a running and a CrossFit session
- **THEN** both sessions are counted and the day is not counted as a rest day

#### Scenario: Week label
- **WHEN** the saved onboarding has a pasted-plan week of 3
- **THEN** "Week 3 of your running plan" is shown, and with a null week no such label is shown

#### Scenario: Week and date made are shown
- **WHEN** a plan whose week starts on 2026-11-23 was made on 26 November 2026
- **THEN** the summary shows "Week of 23 Nov" and "Made 26 Nov"

#### Scenario: Shown without a pasted plan
- **WHEN** the saved onboarding has no pasted plan
- **THEN** "Week of …" and "Made …" are shown and no "of your running plan" label is shown

#### Scenario: Both week labels with a pasted plan
- **WHEN** the saved onboarding has a pasted-plan week of 3 and the plan's week starts on 2026-11-23
- **THEN** "Week 3 of your running plan" and "Week of 23 Nov" are both shown

#### Scenario: Date made is in the athlete's calendar
- **WHEN** a plan was saved at 23:30 UTC on 26 November 2026 and the athlete's time zone is two hours ahead of UTC
- **THEN** the summary shows "Made 27 Nov"

#### Scenario: Month names have three letters
- **WHEN** a plan's week starts on 2026-09-07
- **THEN** the summary shows "Week of 7 Sep"
