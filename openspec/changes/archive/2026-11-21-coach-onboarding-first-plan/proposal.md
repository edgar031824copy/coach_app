## Why

Hybrid athletes (running + CrossFit) get a running plan and a box programming that never see each other, so nobody adds up the combined load. A new athlete often already follows a multi-week running plan, and a coach has to work with it, not replace it. E1 is the first slice that makes the product real: an athlete with no Garmin data and no login gets a combined one-week plan.

Brief: `docs/epics/E1-onboarding-first-plan.md`. PRD: `prd-coach-app.md` §7.1 (E1), items M2 and M3, use case UC1.

## What Changes

- A fixed onboarding form, with an optional pasted running plan.
- One-week combined plan generation by the coach (server side), validated before saving.
- A pasted running plan is kept exactly as written; the coach adds only CrossFit sessions, a combined-load note, and non-binding recommendations.
- Pain or injury reports get a safety note that refers the athlete to a professional, with no diagnosis.
- The plan is saved, shown day by day, and reloads without a new coach call; "Plan next week" pre-fills the form.
- A daily cap on coach calls, since there is no login.
- Greenfield scaffolding first, and a deploy workflow as the last task.

## Capabilities

### New Capabilities
- `onboarding`: validating the form before any coach call.
- `plan-generation`: building and validating the seven-day combined plan.
- `running-plan-import`: reading a pasted plan and keeping its sessions unchanged.
- `plan-storage`: saving, reloading, showing, and planning the next week.
- `cost-cap`: the daily limit on coach calls.
- `safety`: pain and injury handling (PRD Principle 6).
- `deploy`: migrate, deploy server and client, smoke test, behind green CI.

### Modified Capabilities
None. `openspec/specs/` is empty.

## Impact

New code in `client/`, `server/`, a `shared/` package (types and schemas), and an `evals/` folder; tables `plans` and `coach_call_counts`; and a deploy workflow. The owner creates the Vercel, Render, and Supabase accounts and sets an Anthropic spend limit before the deploy task.

## Non-goals

Garmin (E2); load model, suggestions, plan view with history, validation logging (E3 to E6); login, multiple athletes, quotas, bring-your-own key, billing (E7+); changing the athlete's pasted plan; adjusting a plan from training load; pasting the box's CrossFit programming; file upload; confirm-or-correct of the plan reading; plans longer than one week or generated automatically; manual editing; regenerating the same week; week-to-week progression; weight, age, sleep, stress, PAR-Q; a model-written questionnaire.
