# PRD changelog

History of `prd-coach-app.md`, newest first. Each version lists what was added, changed, or removed, and why. The PRD itself keeps only the current version and a one-line summary. Rules for changing the PRD: `docs/workflow.md` §7.2. Reasons behind technical choices: `docs/decisions/`.

Dates come from the git history and the working sessions; for exact diffs, use `git log -- prd-coach-app.md`.

## 1.5 (2026-11-05)

**Added**
- Epic **E8, Daily WOD check**: the athlete photographs the box's workout (or pastes its text), confirms what the model read, adds a quick check-in, and gets a reasoned suggestion (as written, or scaled). Promotes C5 and C7. Depends on E1 and spike X3; its place in the order is decided after E1.
- Spike **X3**: try 5 to 10 real photos of the box's board with the model before designing E8.
- Risk **R12**: the coach's generated CrossFit plan may not match what the box really programs, and vision reading of a whiteboard may be inaccurate.
- The **deployment rule**: E1 is built locally, its last task deploys the scaffold, and every later merged epic deploys through GitHub Actions after CI passes.
- An **access-gate precondition** before E2: before real Garmin data is stored on the deployed app, an owner-password gate exists (or E7 is brought forward).

**Changed**
- The fixed "4-week personal trial" became a **validation checkpoint** measured in rated suggestions (20, or 6 weeks, whichever comes first), with an offline replay of the author's history, blind rating, an outside rater, and thresholds decided in advance (§9, §10, E6). Reason: with one user and suggestions only on overload days, four weeks gives too few data points to judge.
- §13 Technical Decisions became a short summary that points to the decision records in `docs/decisions/`. The revision history moved from the PRD to this file.

## 1.4 (2026-11-04)

**Added**
- The **roadmap and epics** (§7.1): seven epics (E1 to E7) with outcomes, dependencies, scope and exit criteria; two exploration spikes (X1 Garmin access, X2 load definition); a map from every Must and Should item to one epic.
- §14 now names the first epic, E1.

**Removed**
- The Estación 7 course framing. It was an example, not a constraint.

## 1.3 (2026-11-02)

**Added**
- The **cost model** and the path from one athlete to accounts and credits: athlete accounts with social login (S4), per-athlete usage quotas (S5), bring-your-own API key (C8).
- Risk **R11**: with no login, the deployed app is open, so anyone with the URL can read the saved plan or spend API credits.
- Two open questions: the free allowance per athlete, and what Anthropic's terms allow beyond an API key.

**Changed**
- The first slice stays without login.

## 1.2 (2026-11-01)

**Added**
- **Principle 6**, know when not to coach: the coach never diagnoses and refers pain or injury reports to a professional.
- **Use cases with acceptance criteria** (§6).
- The **AI behavior and evaluation plan** (§8).
- **Metrics rebuilt** with a north star, baselines, and timeframes (§9).
- **Risks and mitigations** (§11).

**Removed**
- "Edge" from the competitor list in §2, because it had no entry or source in the appendix.

## 1.1 (2026-11-01)

**Added**
- **Principle 5**, respect the plan the athlete already has: an optional pasted running plan is kept as is.
- The stack and deployment decisions (§13) and the first slice (§14).

**Changed**
- Onboarding and M3 accept an optional existing running plan.

## 1.0 (2026-11-01)

Initial PRD.
