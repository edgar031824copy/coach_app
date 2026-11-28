## Context

Today every build inserts a new row in `plans` (id, plan, onboarding, `created_at`, `week_start`), `GET /api/plan` returns the row with the latest `created_at`, and the client holds one plan (`saved.record`, or `latest` for the one made in this visit). `DELETE /api/plan/:id` removes one row. So a week can have several rows, only the newest shows, and deleting walks back through rows the athlete cannot see. See proposal.md - Why. The real data that showed it: three rows, all for the week of 2026-11-16.

## Goals / Non-Goals

**Goals:** at most one plan per week, enforced by the database; every stored plan reachable from the page; a deletion that always lands on a plan the athlete can see; a replace that is announced before it happens and cannot lose the old plan to a failed build; a migration that is safe to run on production data and says what it removed.

**Non-Goals:** everything in the proposal's Non-goals, and a look decided in advance: the specs fix the behavior, names and sizes of the switcher, not its colors or spacing, which the owner approves on screenshots of the real page in the client PR.

## Decisions

### 1. One plan per week, enforced by a unique index

Migration `003_one_plan_per_week.sql` (forward-only, like the others):

```sql
-- a copy of what is about to go, so a mistake is recoverable; drop it when the owner is sure
create table if not exists plans_merged as select * from plans where false;
insert into plans_merged select p.* from plans p
  where exists (select 1 from plans q where q.week_start = p.week_start and (q.created_at, q.id) > (p.created_at, p.id));
delete from plans p
  where exists (select 1 from plans q where q.week_start = p.week_start and (q.created_at, q.id) > (p.created_at, p.id));
create unique index if not exists plans_week_start_key on plans (week_start);
```

A plan is deleted when another plan of its week is newer by `(created_at, id)`, so the newest remains and a tie goes to the highest id. Running it again deletes nothing (the index already exists and no duplicate is left). This migration deliberately breaks the runner's own rule (`server/src/db/migrate.ts`: migrations "must be backward compatible (add, never drop or rename)", because they run while the old server is up): it deletes rows and adds a unique index, so an old server's rebuild of an existing week fails until the new server is live (Decision 9). The owner approved it. `plans_merged` is a plain table with the same columns; nothing reads it. A unique *index* (not a constraint) is enough for `on conflict`.
*Alternatives:* a `superseded` flag that hides old rows (hidden state again, the problem this change removes); deleting with no copy (simpler, but this is the first migration that destroys data on production, and the copy is three lines); making the athlete pick which plan to keep (no UI for it, three test rows).
**Needs an ADR?** Yes: "plans are keyed by calendar week" is read by E3 (load model) and E6 (log), so task 3.3 writes ADR 0008 as Proposed; accepting it is the owner's act, and he can strike the task at G1. The capability is called `stored-plans`, not "plan history", because the PRD's S1 "Plan history / adjustment log" is a different thing (what was suggested and done).

### 2. Saving is an upsert

`PlanStore.save(plan, onboarding, weekStart)` keeps its signature and runs

```sql
insert into plans(plan, onboarding, week_start) values ($1, $2, $3)
on conflict (week_start) do update
  set plan = excluded.plan, onboarding = excluded.onboarding, created_at = now()
returning <columns>
```

One statement, so it is atomic: two builds of one week leave one row, the later writer wins, and the id stays (the client's `shown.id` and a deletion in flight stay valid). `generatePlan` calls the coach first and saves only a valid plan, so a failed or invalid build never reaches the store and the old plan stays untouched. The call count is unchanged: a rebuild is a coach call like any other. `latest()` stays (it serves `GET /api/plan`, see Decision 9).
*Alternatives:* delete then insert in a transaction (a new id, and two builds can deadlock or lose one); select then update (a race); a client-side "delete the old one first" (two calls, and a failure between them loses the plan).

### 3. `GET /api/plans` returns full records

Contract, in `shared/`: `PlansResponseSchema = z.object({ plans: z.array(PlanRecordSchema) })`, answered by `GET /api/plans`, ordered by `week_start` ascending (a new store method `list()`: `select <columns> from plans order by week_start asc`). It never calls the coach or the cap. A store failure is a 500 `server_error` with no detail, as for the other routes. CORS is unchanged (`GET` is already allowed).
**Why full records, not summaries:** one request, and moving between weeks is instant with no per-week loading or error state to build, test and explain. A plan record is a few KB 🔶 (to be measured in task 3.3); the 26-week window keeps a normal athlete to a few dozen plans for a long time.
*Alternatives:* a summary list plus `GET /api/plan/:id` (a loading and a failure state for every move, and a second endpoint); pagination (nothing needs it yet, see Risks).

### 4. The client holds the list

`App` replaces `saved.record` and `latest` with `plans: PlanRecord[]` (ascending by `weekStart`) and `shownId`. The shown plan is derived: `plans.find((p) => p.id === shownId)`. All the list logic is pure functions in `client/src/plans.ts`, unit-tested without React:

- `pickStart(plans, currentMonday)`: the plan whose `weekStart` equals `currentMonday`, else the one with the latest `createdAt` (highest id on equal times).
- `withPlan(plans, record)`: replaces the entry with the same `weekStart`, or inserts in order.
- `without(plans, id)` and `nearestAfter(plans, id)`: the next later plan if there is one, else the previous.
- `neighbour(plans, id, ±1)`: the switcher's step, `null` at the ends.

A successful build calls `withPlan` and shows the record it got back. `api.getPlans()` reads the list once on start; there is no refetch after a move, a build or a deletion (the athlete's own actions update the held list; a second tab shows its changes after a reload, see Risks). `getPlan()` is no longer called by the client (Decision 9). One exception to "no refetch": when the start read failed, the list is incomplete, so the first successful build reads `GET /api/plans` again; if that also fails the client keeps the plan just built alone. The replace note (Decision 7) cannot warn before that first build, because the client does not know the stored weeks; the server still replaces, and the athlete was told that the saved plans could not be loaded.

### 5. The week switcher

In `PlanView`'s header, when `plans.length >= 2`, the "Week of 23 Nov" line becomes the switcher: `[‹] Week of 23 Nov · 2 of 5 [›]` with "Made 26 Nov" below it. The label has `aria-live="polite"`. The buttons are icon-only (two new inline icons, `ChevronLeftIcon` and `ChevronRightIcon`), named "Earlier plan" and "Later plan" (not "Previous"/"Next week", which would clash with "Plan next week"), 44 px on touch like the trash button. At an end the button stays in the tab order and carries `aria-disabled="true"` with a handler that does nothing: a real `disabled` attribute would drop focus when the athlete steps onto the last plan. While a deletion runs they are really `disabled`. With one plan the header is as it is today. `PlanView` receives a `switcher` prop (`{ position, total, onEarlier, onLater, disabled }`), so it stays presentational.
*Alternatives (offered to the owner, who chose the first):* a dropdown of every week, or scrolling week chips. Both show everything at once but need a new component, more width at 360 px and more states; the arrows plus "2 of 5" already say how many plans there are.

### 6. Deleting lands on a plan the athlete can see

`deleteShown` keeps its structure. On a 204 or a 404 it removes the plan with `without`; if plans remain it shows `nearestAfter`, sets the status line "Deleted the plan for the week of 23 Nov. Showing the week of 30 Nov." (a new `status` field of `DeletionProps`, rendered by the control's panel as an `Alert` with `role="status"`; the status region is rendered empty in the card from the start and filled afterwards, so screen readers announce the text), and asks for the plan heading to take focus (the same `wantHeadingFocus` path as every view change); if none remain it calls `go('form')` as now. The confirmation question gains " Your other plans stay." when `plans.length > 1`. Moving the switcher, `go()`, and opening the question clear the status line and the failure alert (the existing `deleteNotice` reset, extended). The switcher buttons are disabled while `deleting`, so an answer can never arrive for a plan that is no longer shown.
Scenario titles of the existing spec are kept (their meaning is modified), because `scripts/trace` fails when a tag that exists on `master` disappears and it does not understand `REMOVED` yet (workflow §8).

### 7. The warning before a replace

When the form opens, `go()` already records the target week (`targetWeek`, or the current Monday for "New plan" and the first plan). `App` keeps that week in the form's seed state, so it does not change while the athlete types, and shows `<Alert role="note">You already have a plan for the week of 30 Nov. Building a new one replaces it.</Alert>` above the form when `plans.some((p) => p.weekStart === week)`. Information only: nothing is blocked. A retry sends the same week as before (existing rule), so the note cannot disagree with the request.
*Alternatives:* a confirmation after "Build my plan" (a second step on the main action for a case that is common while testing); no note (a silent replace is the surprise this change exists to remove).

### 8. Tests

Server, against real Postgres in a throwaway schema: the migration (run 001 and 002, insert duplicates including a tie and a week with one plan, run 003; the newest remains, `plans_merged` holds the others; the test then executes the file's SQL a second time by hand, since the runner itself never runs a file twice, and nothing changes), the store (id kept, `created_at` moves, other weeks untouched, two builds at once on two connections), the routes (rebuild replaces, a failed coach keeps the plan, `GET /api/plans` order, no coach call, no count, 500 without detail, CORS). Client: the pure functions as tables; `App` flows with the fake API and fixed `Date` and `TZ` (start state and the plan shown, build replaces or adds, the switcher, delete lands on the nearest week, the warning). Playwright on the real stack: two weeks, the switcher, a rebuild with its warning (one row remains), delete lands on the nearest week, a reload opens the current week; the new states join the shared layout, target-size, focus, reduced-motion and axe checks. Mutation checks on each behavior, as before.

### 9. Compatibility and the deploy order

The deploy order stays migrate, server, client, and `deploy.yml` builds and deploys the client only after the Render deploy has finished (steps 1, 2, 3a, 3b), so a new client never meets the old server in a normal deploy; it can only after a rollback of the server alone, where `GET /api/plans` answers 404 and the client shows "Could not load your saved plan" while building still works. `GET /api/plan` stays as it is (latest by creation time): an old client keeps working against the new server, and a rollback of the client needs nothing. Between the migration and the new server going live (seconds), the old server inserts without `on conflict`, so building a week that already has a plan answers a 500 `server_error` ("Nothing was saved"), never a lost plan. A rollback of the *server* alone leaves the unique index in place and has the same effect on rebuilds until the new code returns; there is no down-migration (forward-only, ADR 0005). `plans_merged` is not touched by any code. `GET /api/plan` stays until no old client can be live (the client no longer calls it); removing it is a later change.

## Risks / Trade-offs

- **The migration deletes data on production** → the owner approved keeping the newest plan per week for the three test rows; the removed rows are copied to `plans_merged` in the same migration; the migration test proves what stays and what goes; the PR that carries it says so, and merging it (G5) is the owner's act. I do not run it on production.
- **A rebuild replaces the earlier plan of that week and there is no undo** → the warning on the form; the earlier plan is the one the owner chose to redo.
- **Full records in one list grow with the number of plans** 🔶 → measured at 3.3; revisit (summaries or a window) if an athlete has more than about 100 stored plans.
- **A second tab is stale until reload** → deleting a plan another tab already deleted is a 404, which counts as deleted; building a week another tab built replaces it by design.
- **`aria-disabled` buttons that do nothing** → tested for focus and the attribute; the text says the position, so nothing is silent.
- **"Plan next week" from an earlier week can replace a later week's plan** → the warning names that week before anything is sent.
- **Old server briefly 500s on a rebuild during a deploy or a server rollback** (Decision 9) → seconds, never data loss, and the error text says nothing was saved.

- **The timeout hints promise too much** → the canonical wording of the build timeout ("Your plan may still have been saved: reload the page to check") and of the deletion timeout stays as approved; after this change a reload opens the current week, so a plan built for another week is found with the switcher. Accepted, and noted in the manual check; changing the text would restate the whole "Failures" requirement for one clause.
- **A failed start read leaves the list incomplete until the first build** → the re-read described in Decision 4; the replace note is missing only for that first build.
- **`plans_merged` holds copies of onboarding data in the production database** (same exposure as `plans`) → the owner drops it in a later migration once he has looked at production and is sure; no code reads it.

## Migration Plan

Merge order: Spec PR, then server PR (migration, store, routes), then client PR, then the e2e/docs PR, then the archive PR. The deploy of the server PR runs migration 003 on production through `deploy.yml`; until the client PR is deployed, the old client keeps working against the new server (Decision 9). Rollback: redeploy the previous commit (the index and `plans_merged` stay; see Decision 9). To undo the merge itself, copy rows back from `plans_merged` by hand.

## Open Questions

- None that blocks the build. The owner decides when `plans_merged` is dropped (after he has looked at production), and whether task 3.3's ADR 0008 stays.
