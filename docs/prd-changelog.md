# PRD changelog

History of `prd-coach-app.md`, newest first. Each version lists what was added, changed, or removed, and why. The PRD itself keeps only the current version and a one-line summary. Rules for changing the PRD: `docs/workflow.md` §7.2. Reasons behind technical choices: `docs/decisions/`.

Dates come from the git history and the working sessions; for exact diffs, use `git log -- prd-coach-app.md`.

## 1.8 (2026-11-21)

**Added**
- Epic **E1c, Plan quality**: the coach's plan names concrete CrossFit movements with sets and reps (S7) and differs in structure between levels, with the safety rules that it never prescribes loads, respects reported pain, and labels everything a suggestion. Depends on E1 and follows E1b, because the response schema and the plan view change. Its exit criteria extend the golden set and rewrite `evals/baseline.json`.

**Changed**
- Should item S7 is now assigned to E1c (it was unscheduled in 1.7). The critical path reads E1, spikes, E1b, then E1c, then E2.

**Why:** the first live check of E1 showed plans that are correct but basic. E1 passed its exit criteria as written, so the improvement is a new epic, and it is small because the eval harness and the deploy already exist. E1's scope and exit criteria are unchanged.

## 1.7 (2026-11-21)

**Added**
- Should item **S7**, concrete CrossFit movements in the plan: the coach names movements and sets for the CrossFit days it suggests, within safety limits and labeled as a suggestion, not as the box's programming.

**Why:** at the first live check of E1 the generated plan described CrossFit days only as "strength focus plus short metcon", which the author found too basic to train from. S7 is not scheduled yet: it needs an epic chosen after E1b, and its sessions can differ from what the box programs (risk R12), so it fits with the plan-quality work and the box-board reading of E8. E1's scope and exit criteria are unchanged.

## 1.6 (2026-11-16)

**Added**
- Epic **E1b, UI foundation**: apply a designed interface to the E1 screens (page structure and navigation, a small design system, mobile layout, wording of labels and errors, accessibility baseline) with no change in behavior. Depends on E1 and spike X4; placed after E1 and before E2, so later epics build their screens on it.
- Spike **X4, UI direction**: compare current fitness and coaching apps and the available design tools before E1b is designed; ends in a decision note the owner approves.
- Should item **S6**, a designed, usable interface, so the new epic traces to a scope item.

**Changed**
- The critical path now reads E1, then spikes X1, X2 and X4 in parallel, then E1b, then E2.

**Why:** E1 delivers working but deliberately unstyled screens (its specs say nothing about visual design), and every later epic adds more UI. Designing once, early, avoids restyling everything at E5. E1's own scope and exit criteria are unchanged.

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
