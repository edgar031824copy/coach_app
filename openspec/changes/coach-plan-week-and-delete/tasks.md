## 1. Week and deletion on the server (first PR)

- [ ] 1.1 Add the week arithmetic and the week validation to `shared/`, and the schema changes.
  - Done when: `shared/src/week.ts` has `mondayOf`, `addDays` and `isMonday` on `YYYY-MM-DD` strings computed with UTC date parts; `validateWeekStart(value, today)` accepts a real Monday within 26 weeks of the Monday of the current week and returns the field error otherwise; `PlanRecordSchema` has `weekStart`; `ApiErrorSchema` has `not_found`; the `shared` build and every existing test stay green.
  - Test plan: table tests for the week functions (month end, year end, a leap day, a Sunday, a Monday) and for `validateWeekStart` (a Tuesday, `2026-13-40`, `"next monday"`, a number, exactly 26 weeks, 27 weeks, absent); mutation checks on the Monday rule and the limit.
  - Scenarios: none directly (they are proved at the route in 1.3); these are the functions behind them.
- [ ] 1.2 Add migration 002 and extend the plan store with the week and with deletion.
  - Done when: `server/migrations/002_plan_week.sql` adds `week_start date`, fills every existing row with the Monday of its creation week in UTC, then sets `not null` with a default of the Monday of the current UTC week; `PlanStore.save(plan, onboarding, weekStart)`, `latest()` and a new `delete(id): Promise<boolean>` work; a row inserted the old way (no week) after the migration still succeeds.
  - Test plan: store tests against real Postgres in a throwaway schema: run 001, insert rows made the old way with different creation times (including a Sunday night and a year end), run 002, check each week and that nothing else changed; save with a week and read it back; insert without a week; `delete` returns true then false and leaves the other rows; a mutation check on the backfill expression.
  - Scenarios: `plan-week/every-plan-has-a-week/earlier-plans-get-a-week`.
- [ ] 1.3 Accept `weekStart` on `POST /api/plan` and return it on `POST` and `GET`.
  - Done when: the body's optional `weekStart` is validated with the onboarding (a refusal is a 400 with the field `weekStart`, before the cap, so nothing is saved, no coach call and no count); absent means the Monday of the current UTC week; the saved record and both answers carry `weekStart`; a request from an old client (no `weekStart`) behaves as before.
  - Test plan: supertest with the fake coach: with a week, without a week at a fixed clock, every refusal (the cap and the coach are not touched), exactly 26 weeks accepted, the answer and a later `GET` carry the week; mutation checks (a refusal that still spends a call, the default taken from the wrong day).
  - Scenarios: `plan-week/every-plan-has-a-week/week-is-saved-and-returned`, `plan-week/every-plan-has-a-week/week-defaults-to-the-current-week`, `plan-week/every-plan-has-a-week/only-a-monday-is-accepted`, `plan-week/every-plan-has-a-week/a-value-that-is-not-a-date-is-refused`, `plan-week/every-plan-has-a-week/a-week-far-from-today-is-refused`, `plan-storage/reload-without-a-coach-call/record-carries-its-week`.
- [ ] 1.4 Add `DELETE /api/plan/:id` and allow it through CORS.
  - Done when: a stored id gives 204 with no body and the row is gone; an unknown or already deleted id gives 404 `not_found`; an id that is not a positive whole number gives 400; the coach and the cap are never touched; `GET` never returns the deleted plan; the preflight for the client origin lists `DELETE` and any other origin is refused as before; a store error gives 500 `server_error`.
  - Test plan: supertest with real Postgres: delete the newest of three and `GET` returns the next, delete the only one and `GET` returns `null`, the other plans are unchanged, ids `abc`, `0`, `-3`, `1.5`, a second delete of the same id, the call count before and after, the CORS preflight from the client origin and from another; mutation checks (deleting every row, a refund of the call count, `DELETE` missing from the allowed methods).
  - Scenarios: `plan-deletion/deleting-a-plan/*`.

## 2. Client: the week and deleting a plan (second PR)

- [ ] 2.1 Send the right week with every plan request.
  - Done when: `api.postPlan(onboarding, weekStart)` sends `{ ...onboarding, weekStart }`; the client computes the Monday of the current week from the athlete's local calendar; the first plan and "New plan" send it, "Plan next week" sends the shown plan's `weekStart` plus 7 days, and "Try again" repeats the same week; the athlete cannot edit it.
  - Test plan: API and App tests with a fixed clock (26 November 2026 gives `2026-11-23`; a shown week of `2026-11-23` gives `2026-11-30`; `2026-12-28` gives `2027-01-04`; New plan after another week; a retry keeps the week; the pre-filled form is unchanged); a test that the local calendar is used (a time zone setting near midnight); mutation checks on the +7 and on the retry.
  - Scenarios: `plan-week/the-client-asks-for-the-right-week/*`.
- [ ] 2.2 Show the week and the date made in the plan view.
  - Done when: the summary card shows "Week of 23 Nov" and "Made 26 Nov" for every plan, with "Week N of your running plan" kept for pasted plans; the format is `en-GB` day and short month; "Made" is the day of `createdAt` in the browser's time zone; the E1b tests for the summary stay green.
  - Test plan: component tests (a plan with and without a pasted plan, both labels together, month names, a creation time near midnight with `TZ` set two hours ahead of UTC), a check that the lines wrap at 360 px (Playwright in 3.1); mutation checks (the week taken from `createdAt`, the made date taken in UTC).
  - Scenarios: `plan-presentation/summary-of-the-week/week-and-date-made-are-shown`, `plan-presentation/summary-of-the-week/shown-without-a-pasted-plan`, `plan-presentation/summary-of-the-week/both-week-labels-with-a-pasted-plan`, `plan-presentation/summary-of-the-week/date-made-is-in-the-athletes-calendar`.
- [ ] 2.3 Add the "Delete this plan" button and its confirmation.
  - Done when: `api.deletePlan(id)` accepts the empty 204 answer; `Button` has a `danger` variant (white text on `--error`) and the pair `brand-fg` on `error` is in `token-pairs.json` and `docs/design-system.md`; the plan view offers "Delete this plan" beside the two others; pressing it replaces the three buttons with the confirmation, focus on "Cancel"; "Cancel" restores them with focus on "Delete this plan"; "Yes, delete" sends the deletion with both buttons disabled while it runs; on 204 or 404 the plan is cleared and the empty form opens with the "New plan" heading focused; every view change resets the confirmation.
  - Test plan: component tests for each step (button offered only with a plan, nothing sent before confirming, focus on each move, Cancel, success, 404 counts as success, disabled while running, no earlier answers in the new form, no request to the coach), a hook test for the contrast pair, a test that the cleared plan is not offered under "My plan"; mutation checks (deleting without the confirmation, focus left behind, the plan still shown after success).
  - Scenarios: `plan-deletion/delete-button-with-a-confirmation/button-is-offered-with-a-plan`, `.../confirmation-comes-first`, `.../cancel-keeps-the-plan`, `.../confirming-deletes-the-plan-and-opens-a-new-form`, `.../buttons-are-disabled-while-deleting`, `.../a-plan-that-is-already-gone-counts-as-deleted`.
- [ ] 2.4 Handle a failed deletion.
  - Done when: after a server error, a network error or a timeout the plan stays shown, the three buttons are back, and an alert "The plan could not be deleted. Nothing was changed. You can try again." takes focus; pressing "Delete this plan" again works and the alert goes; the alert clears on every view change.
  - Test plan: component tests for each failure kind, the second attempt after a failure, the alert cleared by a view change, the focus; mutation checks (the plan hidden after a failure, the alert without its role).
  - Scenarios: `plan-deletion/delete-button-with-a-confirmation/a-failed-deletion-keeps-the-plan`.

## 3. Checks, documentation, and finish (last PR)

- [ ] 3.1 Extend the Playwright checks.
  - Done when: the E1 journey shows "Week of …" and "Made …" for the first plan, "Plan next week" shows the following week, a deleted plan is gone after a reload (the database holds no such row), and the earlier plan, if any, is what a reload shows; the confirmation and a failed deletion are added to the shared states, so the layout (360, 768, 1280), target-size, focus-ring, reduced-motion and axe checks cover them.
  - Test plan: run `npm run e2e -w e2e` locally and in CI; mutate a target size in the confirmation and a ring to see the checks fail.
  - Scenarios: `plan-deletion/delete-button-with-a-confirmation/a-reload-does-not-show-the-deleted-plan`, `plan-deletion/deleting-a-plan/only-the-client-origin-may-delete`; the existing layout, target and axe scenarios keep their tags.
- [ ] 3.2 Update the documentation and record the size.
  - Done when: `docs/design-system.md` lists the `danger` variant and the inline confirmation pattern; the bundle size is measured by hand and compared with the 116,121 bytes at the end of E1b; the README setup is unchanged.
  - Test plan: the documentation test; read the document against the code.
  - Scenarios: none new (the E1b design-system scenarios keep covering the document).
- [ ] 3.3 Manual checks on the live app, gate G4 and archive.
  - Done when: after the deploy the owner builds plans on the live app, sees the week on each, uses "Plan next week", deletes a plan, reloads, and says it is good, with a note in `docs/` and no URLs; `scripts/trace` covers every scenario; `/opsx:verify` has no critical finding; the change is archived.
  - Test plan: the manual run recorded; `scripts/trace`; the CI result.
  - Scenarios: all scenarios (traceability).
