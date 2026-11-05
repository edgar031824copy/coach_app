# Development workflow: how coach_app is built

This document explains how coach_app is built, and the harness that enforces it, so a new reader can understand it without the chat history that produced it. It is a living document: change it through a PR like anything else.

**The harness is not this file.** The harness is the machinery: hooks and settings in `.claude/`, the reviewer agents, skills, scripts, CI workflows, and branch protection. This document explains the intent and gives the map. When a piece is built, the file that implements it is the source of truth, and this document links to it; if the two disagree, the file wins and this document gets fixed. Rules that must never have exceptions live in hooks and CI, not in prose.

**Status legend:** ✅ built · 🔲 planned (designed, not built yet). At the time of writing, everything below is 🔲 except this document and `CLAUDE.md`.

## 1. What the harness is, and why

A harness is the deterministic skeleton around the model: state, tools, gates, and handoffs. The model reasons; the harness decides what is allowed to count as done. Design principles, taken from Anthropic's harness and context-engineering articles and the "What is an Agent Harness?" paper:

| Principle | How we apply it |
|---|---|
| Externalize state | `docs/.phase`, OpenSpec artifacts, and git hold state, not the model's memory |
| Deterministic gates | Tests, typecheck, CI, and hooks decide pass/fail. A model's opinion is never the only gate for code |
| Independent verification | A read-only reviewer that did not write the code reviews it against the spec |
| Fail loud and stop | Hooks exit non-zero with a reason; the flow halts instead of improvising |
| Least privilege | Reviewers can read but not edit. Auto mode never covers merge, deploy, or secrets |
| Human at high-risk boundaries | The owner approves the design (G1) and every merge (G5) |
| Simplest thing that works | One agent plus two read-only reviewers. No orchestrator, no multi-agent chain |

Where a check cannot be deterministic (a design document cannot be "run"), we say so and treat it as a soft gate that supports, but does not replace, human judgment.

## 2. Vocabulary

- **Epic:** a coherent capability from the PRD (for example "onboarding and plan generation"). Planned by a short brief before any artifact is generated.
- **Change:** an OpenSpec unit of work. **One epic = one change.** Follow-up work is a new change linked by an `epic:` tag.
- **Task:** one checklist item in a change's `tasks.md`.
- **Scenario:** a WHEN/THEN requirement in a spec. The unit that must have a test.
- **Gate:** a check that must pass before the flow advances (G0 to G5, section 5).
- **Phase:** the current stage of a change, recorded in `docs/.phase`.

## 3. Lifecycle

```
INCEPTION
  explore / brief ─► G0 Definition of Ready ─► /opsx:new ─► /opsx:continue (proposal → specs → design → tasks)
                                                            │
                                         G1 design gate: design-reviewer + owner approval
                                                            │  Spec PR merged  (phase = approved)
CONSTRUCTION                                                ▼
  /opsx:apply  task by task, test first, on feature branches (phase = building)
      per PR:  G2 build gate (hard) ─► G3 review (code-reviewer + @claude on the PR) ─► owner merges (G5)
                                                            │
EPIC CLOSE                                                  ▼
  /opsx:verify ─► G4 epic gate (hard) ─► /opsx:archive (specs synced) in the last PR ─► G5 merge (phase = archived)
```

The **expanded path** is used because it gives one artifact per step (`/opsx:continue`) and a verify step. Once routine, `/opsx:ff` may replace `/opsx:continue` for epics whose requirements were fully defined at G0.

## 4. Who or what does each stage

There is no multi-agent chain. Roles are **stages that produce artifacts**; the same Claude session does the work, plus two read-only reviewers.

| Stage | Actor | Artifact |
|---|---|---|
| Epic definition ("PM") | Owner + Claude (Claude asks questions, owner answers) | `docs/epics/E<n>-<slug>.md` |
| Design ("tech lead") | Claude via OpenSpec | `proposal.md`, `specs/`, `design.md`, `tasks.md` |
| Design review | `design-reviewer` subagent 🔲 | Review notes in the Spec PR |
| Build ("dev") | Claude via `/opsx:apply` with TDD | Code, tests, PRs |
| Code review | `code-reviewer` subagent 🔲 and `@claude` on the PR | Review comments |
| QA | CI (unit, integration, Playwright end-to-end) and the G4 gate, plus an exploratory pass with `/verify` | Pass/fail, plus findings |
| Release | Owner | Merge, archive |

## 5. Gates

| Gate | When | Kind | Enforced by | Decides |
|---|---|---|---|---|
| **G0 Definition of Ready** | Before `/opsx:new` | Soft | design-reviewer checks the brief against section 6 | Owner |
| **G1 Design** | End of inception | Soft | design-reviewer notes, then Spec PR review | **Owner approves** |
| **G2 Build** | Every PR | **Hard** | Stop hook locally 🔲; CI required check `ci-complete` 🔲 (tests, typecheck, lint, secret scan, dependency audit) with branch protection | CI |
| **G3 Review** | Every PR | Soft, independent | `code-reviewer` before opening the PR 🔲; `@claude review` on the PR | Owner reads findings |
| **G4 Epic** | Before archive | **Hard** | All scenarios traced to passing tests (section 8), Playwright end-to-end tests in CI (section 9.1), golden-set evals for AI epics (section 9.2); exploratory QA and `/opsx:verify` as extra soft checks | CI plus owner |
| **G5 Merge** | Every PR | Human | Owner clicks merge; auto mode never merges | **Owner** |

`/opsx:verify` is an LLM step with no exit code; it supports G4 but does not replace the hard checks.

**When a gate fails:** the agent gets at most 3 fix attempts per failing check on the same PR. After that it stops, records what failed and why in the PR, and waits for the owner. It never weakens, skips, or deletes a test or a CI check to get green.

## 6. Definition of Ready and Done (per epic)

**Ready**, checked at G0, before any artifact is generated:
- Problem and user are stated, and trace to a PRD item.
- Every requirement has at least one WHEN/THEN scenario, including error and edge cases.
- Out of scope is explicit.
- Data and API contracts are described.
- Risks and the test strategy are written.
- Dependencies are named, and no open question remains unanswered (or it is explicitly deferred).
- If the epic changes AI behavior, evaluation scenarios are listed.

**Done**, checked at G4:
- Every scenario has a passing test (section 8).
- CI is green on the final PR (including end-to-end and security checks); the code review has no open high-severity finding.
- For AI epics, the golden-set evals meet their thresholds.
- Specs are synced, and the change is archived.
- `docs/.phase` reads `archived`.

## 7. Branches and pull requests

| PR | Contains | Gate |
|---|---|---|
| **Spec PR** | The four OpenSpec artifacts, and the epic brief if it has not already landed (E1's brief merged earlier, in the baseline PR); no code | G1, owner approves |
| **Implementation PRs** | A group of related tasks each (roughly 2 to 5 tasks, about 400 lines); commit per task | G2, G3, G5 |
| **Last implementation PR** | Final tasks plus the archive (specs synced) | G2 to G5, with G4 passed first |

Branch names: `spec/<change>` and `feat/<change>-<n>`. Squash-merge into `master`. Direct pushes to `master` are blocked. A new feature, a spec change, or a fix to archived behavior is a **new change**, never an edit to an approved one.

### 7.1 Deployment

- **E1 is built and run locally.** Its last task creates the deploy workflow and puts the base scaffold on a URL.
- **From then on, every merged epic deploys through GitHub Actions** (`deploy.yml` 🔲): it runs on a push to `master`, only after CI passes. Order: migrate the database, deploy the server, deploy the client, run a smoke test against the live URLs. Secrets live in GitHub Actions secrets.
- **The providers' own Git auto-deploy is disabled,** so nothing deploys twice and nothing deploys past a red CI.
- **Merging is the deploy approval (G5).** No separate approval step for now; a GitHub "production" environment with a required reviewer can be added later.
- **No staging environment.** Local development, CI with a fake coach, and one production environment.
- Before real Garmin data is stored on the deployed app (E2), an access gate must exist (PRD §7.1, E2 precondition).

## 8. Test traceability

This replaces a hand-maintained feature list with something derived, so there is one source of truth.

- Each scenario in `openspec/specs/**` has an id: `<capability>/<requirement-slug>/<scenario-slug>`.
- Every test that proves a scenario includes `@spec(<id>)` in its title.
- A script (`scripts/trace`) 🔲 lists every scenario in the canonical specs and the scenarios of the open change, and fails if any scenario has no test or if a tagged test that existed on `master` was removed.
- "Passes" comes from the test run in CI, not from a stored flag, so nobody can flip it by hand.

This protects against the failure noted in the solo-mode review: a later epic loosening an earlier epic's tests.

## 9. Verification beyond unit tests

### 9.1 End-to-end tests and QA

- **Deterministic E2E (hard):** Playwright tests in `e2e/` 🔲, run in CI against the local stack: the real server, a real Postgres service container, and a **fake coach**, so there is no cost and no flakiness.
- Each E2E test carries `@spec(<id>)` and covers a user journey from the scenarios the owner approved at G1. They are derived from those scenarios and written first, so the agent is not grading its own homework.
- After a deploy, a smoke test runs against the live URLs (the last task of E1).
- **Exploratory QA (soft):** at G4, Claude drives the running app in a browser (`/verify`) looking for problems scripted tests miss. Findings are triaged by the owner; a confirmed bug becomes a test.
- There is no dedicated QA agent for now. If exploratory passes keep finding real bugs, add a read-only `qa-reviewer` later.

### 9.2 Golden-set evals (AI epics)

Unit tests cannot judge whether coaching advice is good. For epics that change AI behavior, the coach is tested against a **golden set**.

- **The set:** about 30 fixed scenarios (PRD §8.3) in `evals/` 🔲. Each is an input plus the properties the answer must have, not a stored sentence.
- **Checks are code first.** Structured coach output lets code test: a suggestion exists, it cites metrics, the referral flag is set, nothing was auto-applied. A binary pass/fail AI judge (a different or stronger model, calibrated against the owner's own labels) is used only for fuzzy criteria such as "plain and sensible reason".
- **Repeats:** each scenario runs N times (default 3 🔶) because answers vary. Safety checks (pain referral, no diagnosis, nothing auto-applied) must pass on **every** run; quality checks must pass on at least a set share of runs (default 2 of 3 🔶).
- **Baseline:** pass rates are stored in `evals/baseline.json`. After any change to the prompt or the model, rerun and compare. A safety drop, or a quality check below its threshold, blocks the change.
- **Cost:** it calls the real model, so it runs on demand and at G4, never on every PR.
- **It grows:** every bad answer found in testing or the validation checkpoint becomes a new scenario.
- The validation checkpoint (PRD §10) is separate: it judges real use over about 20 rated suggestions and compares the coach with the threshold rule.

## 10. State: `docs/.phase`

One line, written by a script 🔲 (`scripts/phase`), never by hand or by the model:

```
change=coach-onboarding-plan-gen epic=E1 phase=building task=3/10 branch=feat/coach-onboarding-plan-gen-2 gate=G2:pass
```

Phases: `defining` → `proposed` → `approved` → `building` → `verifying` → `archiving` → `archived`. A `SessionStart` hook 🔲 prints this line and `openspec list` so a new session knows what is in flight without rereading everything. `.phase` records where we are; git and the PR remain the record of what happened.

## 11. Hooks (settings in `.claude/settings.json`, 🔲)

| Hook | Rule | Why a hook |
|---|---|---|
| `Stop` | Run tests and typecheck for the touched packages; exit code 2 blocks finishing | The harness, not the model, decides the work is not done. Claude Code overrides after 8 consecutive blocks, so CI remains the final gate |
| `PreToolUse` scope freeze | While phase is `approved`, `building`, or `verifying`, block edits to the active change's `proposal.md`, `design.md`, and `specs/`. `tasks.md` stays editable | Enforces "additions are a new change" |
| `PreToolUse` protect specs | Block edits to `openspec/specs/` unless phase is `archiving` | Canonical specs change only through sync/archive |
| `SessionStart` | Print `.phase` and active changes | Cheap resumability |

Keep the set small: a hook is for a rule with zero exceptions; everything else stays in `CLAUDE.md`. Permission deny rules cover merging, pushing to `master`, deploying, and reading secret files.

## 12. Reviewers

Both are subagents in `.claude/agents/` 🔲 with `tools: Read, Grep, Glob` only: they can read and report, not edit. They start with no memory of how the work was done, which is the point.

- **`design-reviewer` (G0, G1):** checks the epic brief and artifacts against section 6 and three lenses adapted from the course's evaluate-spec: product (problem, scope, out of scope, rules), testability (every requirement observable, error and edge cases present), and design (components, contracts, constraints). Output: findings ranked by severity, ending with a verdict. Soft gate: it informs the owner, it does not approve.
- **`code-reviewer` (G3):** compares the diff against the change's specs and design: scenarios covered by tagged tests, behavior that is in the diff but not in the spec, security and data-handling problems, and risky patterns. It is told to skip style nits, because a reviewer asked to find problems will always find something. Blocks only on high-severity findings.

A second review runs on GitHub: the owner comments `@claude review against openspec/changes/<change>` on the PR.

## 13. Autonomy and permissions

The owner approves G1 and G5. Between them the agent works task by task. Autonomy increases only after several epics run cleanly: first the owner reads every PR; later, low-risk PRs could merge on green CI plus a clean review. The owner switches between Claude Code's auto mode and manual approval. Auto mode is a model judging risk, not a hard rule, so deny rules and hooks cover the actions that must never happen.

## 14. Epics

Epics, their order, dependencies, and exit criteria are owned by the PRD: see `prd-coach-app.md` §7.1. This document defines only how an epic is run. Current state: E1 is next, with its brief drafted in `docs/epics/E1-onboarding-first-plan.md` and waiting for G0; E2, E3, and E8 each need an exploration spike first (X1 Garmin access, X2 load definition, X3 reading a real whiteboard). Spike notes go in `docs/spikes/`; epic briefs go in `docs/epics/`.

## 15. Build order for the harness itself

1. **Bootstrap PR (not an OpenSpec change):** the `@claude` workflow (PR #1) is merged ✅; `openspec init` with a Solo `config.yaml` (greenfield context, task rules); switch OpenSpec to the expanded profile; CI workflow with one required check `ci-complete`; branch protection; `.claude/settings.json` with hooks and deny rules; the two reviewer agents; `scripts/phase` and `scripts/trace`; `docs/.phase`. CI also gets secret scanning and a dependency audit.
   - During E1: Playwright E2E with a fake coach, and the deployed smoke test. The golden-set runner arrives with E4; a small first set (the pasted-plan check) can start in E1.
2. **E1 epic brief** (drafted), passes G0, then the Spec PR, then implementation PRs.
3. Update the status legend in this file as each piece lands.

## 16. Known unknowns, to test in E1

- How `/opsx:sync` behaves on the expanded path, and what `/opsx:verify` actually checks.
- The Claude GitHub Action can post review comments with its current permissions (confirmed on PR #2, where it reviewed the baseline). Still to test: whether `@claude` mentions made by the agent itself trigger it.
- Whether `pg-mem` supports what the store needs.
- Whether the scope-freeze hook blocks legitimate edits too often.

## 17. Token and cost discipline

Simple rules, so the harness does not burn context or money:

- **Keep always-loaded context small.** `CLAUDE.md` stays short; this file is read only when defining an epic, opening a Spec PR, running a gate, or changing the harness. Long procedures become skills, which load only when used.
- **Subagents only for review.** Each one starts a separate context, so they are not used for building. The harness has two.
- **Start each task from state, not chat history:** `.phase` and the active change. Use `/clear` between tasks, and `/compact` around 50 to 60% with a note of what to keep.
- **Right model per reviewer:** `code-reviewer` on the default model; `design-reviewer` on a stronger model, only at G0 and G1 (once per epic).
- **Evals and exploratory QA are on demand.** During development run only the affected scenarios; run the full set at G4. Repeats and set size are configurable.
- **CI calls Claude only when someone comments `@claude`.** No automatic review on every push.
- **Short command output:** RTK compresses shell output, and hooks print only failures.
- Measuring tokens and cost per epic comes later, with observability.

## 18. Not in scope for now

Observability (cost and tokens per epic, CI timing, eval trends) comes at the end. Multi-agent orchestration, a state-machine library, and AIDLC are deliberately not used: the problem is one builder and one app. The Estación 7 course material is not part of this process; the only ideas borrowed are the three review lenses (section 12) and the task format (scope, acceptance criteria, test plan), which `openspec/config.yaml` should encode for `tasks.md`.
