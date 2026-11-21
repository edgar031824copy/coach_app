## Purpose

Defines how a merged change reaches the live app on the free-tier hosts: a fixed order of steps behind green CI, a clear outcome when a step fails, and a client that copes with a sleeping server. E1 is built and run locally until this last task.

## ADDED Requirements

### Requirement: Deploy order behind green CI
When a PR merges to `master` and CI is green, a GitHub Actions workflow SHALL run in this order: migrate the database, deploy the server, deploy the client, run a smoke test against the live URLs. The hosting providers' own auto-deploy SHALL be disabled, and a red CI SHALL NOT deploy.

#### Scenario: Green merge deploys in order
- **WHEN** a PR merges to `master` and CI is green (manual-verified at the first deploy)
- **THEN** the workflow migrates the database, deploys the server, deploys the client, and runs the smoke test, in that order

#### Scenario: Red CI does not deploy
- **WHEN** CI is red (manual-verified at the first deploy)
- **THEN** nothing is deployed

#### Scenario: Provider auto-deploy is off
- **WHEN** a push reaches `master` (manual-verified at the first deploy)
- **THEN** only the workflow deploys, not the providers' own auto-deploy

### Requirement: Failure handling
The system SHALL stop at the first failing step: a failed migration deploys nothing, a failed server deploy does not deploy the client, and a failed smoke test is reported on the commit. There is no automatic rollback in E1.

#### Scenario: Migration fails
- **WHEN** the migration fails (manual-verified with a forced failing step)
- **THEN** neither the server nor the client is deployed

#### Scenario: Server deploy fails
- **WHEN** the server deploy fails (manual-verified with a forced failing step)
- **THEN** the client is not deployed

#### Scenario: Smoke test fails
- **WHEN** the smoke test fails (manual-verified with a forced failing step)
- **THEN** the failure is reported on the commit as a failed status

### Requirement: Live health
After a deploy, `GET /health` SHALL return `{"status":"ok"}` and the full flow (onboarding to a shown plan) SHALL work from the live client URL.

#### Scenario: Health check
- **WHEN** `GET /health` is called on the live server
- **THEN** it returns `{"status":"ok"}`

#### Scenario: Full flow on the live URL
- **WHEN** an athlete completes the onboarding on the live client URL (manual-verified once at the first deploy, because an automated run would spend a real coach call)
- **THEN** a plan is generated and shown

### Requirement: Write path is live
After a deploy, the smoke test SHALL show that `POST /api/plan` is routed and CORS-enabled for the client origin, without spending a coach call.

#### Scenario: Invalid POST is refused without a coach call
- **WHEN** the smoke test sends `POST /api/plan` with an invalid body from the client origin (manual-verified at the first deploy)
- **THEN** the response is 400 and the coach is not called

### Requirement: Cold-start experience
When the server has been idle and a request has had no response after 3 s 🔶, the client SHALL show a "waking up the coach" state. The client's request timeout SHALL exceed the time a cold server takes to wake plus the coach's own timeout.

#### Scenario: Server is waking up
- **WHEN** a request has had no response after 3 seconds
- **THEN** the client shows a "waking up the coach" state

#### Scenario: Timeout covers a cold start
- **WHEN** a request hits a sleeping server and the coach then takes its full timeout
- **THEN** the client has not timed out

### Requirement: No secrets and restricted origin
No secret SHALL appear in the repository or the client bundle, and the server SHALL allow cross-origin requests only from the client origin.

#### Scenario: No secret in the repo or bundle
- **WHEN** the repository and the built client bundle are scanned
- **THEN** no secret is found

#### Scenario: Other origins are refused
- **WHEN** a request comes from an origin other than the client origin
- **THEN** the server does not allow it
