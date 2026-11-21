# Deploy evidence (E1, task 8.3)

Manual and recorded checks for the `deploy` scenarios of `coach-onboarding-first-plan`. No URL, host or secret is recorded here: the repository is public. Run IDs refer to this repository's Actions tab. First deploy: 2026-11-21, merge of PR #21 (commit `5c4fcbf`).

Legend: ✅ observed on the real stack · 🔶 not observed on the real stack, covered another way (said so in each case).

## Green merge deploys in order

@manual(deploy/deploy-order-behind-green-ci/green-merge-deploys-in-order)

✅ After PR #21 merged, CI ran on the push, then `Deploy` started by itself (event `workflow_run`) and succeeded in about 2 minutes. Its steps, in order, all `success`: newest-commit guard, migrate (`applied 001_init.sql`), Render deploy (`build_in_progress`, `update_in_progress`, `live`), client build and bundle scan, Vercel deploy, smoke test, commit status. A `deploy` status `success` is on the commit.

## Red CI does not deploy

@manual(deploy/deploy-order-behind-green-ci/red-ci-does-not-deploy)

🔶 No red CI run has happened on `master`, so no red run was seen to skip the deploy on the real stack. What was observed: the first CI run of PR #21 was red (a secret-scan finding) and the Actions tab shows exactly one `Deploy` run, the one after the merge, so the red run did not deploy; that run was a `pull_request` run, which the `branches: [master]` filter already excludes. The rule for a red push run is in `deploy.yml`: the job runs only when the CI run's conclusion is `success` and its event is `push`.

## Provider auto-deploy is off

@manual(deploy/deploy-order-behind-green-ci/provider-auto-deploy-is-off)

Settings made by the owner in the dashboards: Render auto-deploy Off, Vercel Git connection disconnected. Check after the first merge: the Render deploys list shows one deploy for the merge commit (trigger: API), and Vercel shows one production deployment. Owner to confirm: ______

## Failure handling

@manual(deploy/failure-handling/migration-fails)
@manual(deploy/failure-handling/server-deploy-fails)
@manual(deploy/failure-handling/smoke-test-fails)

🔶 No forced failure was run on the real stack (it would have needed a deliberately broken deploy on `master`). Covered instead:
- **Migration fails:** `migrate-run.test.ts` (a failing migration exits 1, rolls back, applies nothing after it, and prints only the error name and code) and the workflow order: the migrate step is first, and every later step has the default `success()` condition, so a failure skips the server and the client.
- **Server deploy fails:** `render-deploy.test.ts` (each of `build_failed`, `update_failed`, `canceled`, `pre_deploy_failed`, `deactivated` and a timeout exits 1); the client steps come after it and are skipped the same way.
- **Smoke test fails:** `smoke-test.test.ts` (one deliberate fault per step, each exits 1) and the last workflow step, which posts a `deploy` status `failure` with `if: always()` from `job.status`.

## Live health, write path, full flow

@manual(deploy/write-path-is-live/invalid-post-is-refused-without-a-coach-call)

✅ The smoke test in the first run: `PASS invalid POST is refused with 400, no coach call`, together with `PASS server health`, `read path`, `client page` and both CORS steps.

@manual(deploy/live-health/full-flow-on-the-live-url)

✅ The owner filled the onboarding on the live client (goal, both levels, running and CrossFit days, weekly numbers, a target event) and pressed "Build my plan". A plan appeared for Monday to Sunday with a rest day, same-day run and CrossFit notes, and coach suggestions including one about the event date; the real coach was called (about 25 seconds, no error). After a reload the same plan was shown without a new request for it, so it was saved and read back from the database. Other level and distance choices gave plans that matched the entered levels and volume.
