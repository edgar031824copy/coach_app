# PRD · Virtual Hybrid Coach

**Version:** 1.5
**Date:** 2026-11-01
**Status:** Draft, pre-validation phase
**Repo:** `coach_app` (this document is the source of truth for what to build and why)

**Changes in 1.5:** added epic E8 (daily WOD check from a photo or pasted text) and spike X3 (can the model read a real whiteboard?), promoting C5 and C7; added risk R12 (the generated CrossFit plan may not match the box's real programming); set the deployment rule (E1 local, deploy as its last task, then every merged epic deploys through GitHub Actions after CI) and an access-gate precondition before E2. The fixed "4-week trial" also became a validation checkpoint: the fixed "4-week trial" became a validation checkpoint measured in rated suggestions (20, or 6 weeks, whichever comes first), with an offline replay of the author's history, blind rating, an outside rater, and thresholds decided in advance (§9, §10, E6).
**Changes in 1.4:** added the roadmap and epics (§7.1): seven epics with outcomes, dependencies and exit criteria, two exploration spikes, and a map from every Must/Should item to one epic; §14 now names the first epic (E1). The Estación 7 course framing was dropped; it was an example, not a constraint.
**Changes in 1.3:** recorded the cost model and the path from one athlete to accounts and credits: athlete accounts with social login (S4), per-athlete usage quotas (S5), bring-your-own-key (C8); added risk R11 (open endpoint can spend API credits) and two open questions. The first slice stays without login.
**Changes in 1.2:** added Principle 6 (know when not to coach); use cases with acceptance criteria (§6); AI behavior and evaluation plan (§8); metrics rebuilt with north star, baselines, and timeframes (§9); risks and mitigations (§11). Removed "Edge" from the competitor list in §2 (it had no entry or source in the appendix).
**Changes in 1.1:** Principle 5 (respect the athlete's existing plan); onboarding and M3 accept an optional existing running plan; stack and deployment decided (§13); first slice defined (§14).

**Legend:** 🔶 = assumption (plausible, not yet validated). 🔵 = open question (unknown, needs discovery).

---

## 1. One-liner + JTBD

**One-liner:** A virtual coach for hybrid athletes (running + CrossFit) that generates a training plan from an onboarding intake and Garmin history, then suggests dynamic adjustments based on real training-load metrics — catching the overload a single-discipline coach (running-only or box-only) can't see, because it never looks at both.

**JTBD:** When I train running and CrossFit in the same week (often the same day), I want a coach that sees my combined load across both disciplines and tells me — with a real explanation, not just a traffic-light score — when to back off or push, so that I avoid overload injuries and actually progress in both instead of letting one quietly sabotage the other.

---

## 2. Context and Problem

**The problem:** Hybrid athletes (running + CrossFit/strength) are trained by two separate mental models that don't talk to each other. A running plan assumes recovery you didn't get because of this morning's WOD; a box's programming assumes legs you didn't just burn out on a 7K interval session. Neither sees the combined picture. The athlete is the only one holding both halves, and usually holds them "by feel" — which is exactly how overload injuries happen.

**Evidence (personal, n=1 for now):** The author trains both running (early-morning intervals/long runs) and CrossFit (midday WODs) in the same day, regularly. No existing coaching input accounts for the other discipline's load. 🔶 This is one athlete's experience; no interviews or injury data yet.

**Why now:** A real market of "hybrid athlete" apps already exists (Crusd, TrackVolt, ROXFIT, Athletica, Hybrid Training Coach) — suggesting this pain is real and that people pay to solve it (vendor claims, unverified). But researched evidence suggests most of these adjust from a **recovery score** (HRV/sleep/RHR → rule-based swap), not from **reasoning the athlete can read and trust**. An Anthropic-model coach that explains *why* ("yesterday's run plus today's planned heavy squats would stack quad load — consider mobility instead") is a different, more defensible product than another readiness-score app.

**Current alternatives and why they fall short:**

| Alternative | What it does | Gap |
|---|---|---|
| Garmin Coach | Rule-based plan + adjustment, single-sport-aware at best | Not CrossFit-aware; no explained reasoning, just a score |
| Hybrid-athlete apps (Crusd, TrackVolt, ROXFIT, Athletica) | Combined logging, some load-based adjustment | Adjustments are score-driven, not reasoned/explained; unverified actual CrossFit-specific load modeling |
| Box's own programming + a running plan, done manually | Real coach judgment, real care | Doesn't scale past one person's attention; the two plans never see each other |

---

## 3. User, Customer, and Rollout Path

| | |
|---|---|
| **User (now)** | The author — a hybrid athlete training running + CrossFit, using Garmin. |
| **User (next)** | Athletes at the author's own box, then other boxes in the city. |
| **User (later, unscoped)** | Any hybrid athlete, broader than CrossFit-specific boxes. |
| **Customer / payer** | The athlete themselves — but **not in MVP**. Monetization (per-athlete subscription) is explicitly deferred until the coach is personally validated as giving genuinely good suggestions. MVP has no payer. |
| **Who pays for the AI (cost model)** | **Now (model A):** the author's own Anthropic API key pays for the coach, protected by a daily cap on coach calls and a spend limit on the Anthropic account. **Next:** each athlete gets a free usage allowance, which needs accounts (S4, S5). **Later, only if validated:** athletes bring their own API key (model B, C8) or buy credits (model C, C3). As far as we can tell, Anthropic offers no way for a third-party app to bill a user's own Anthropic account other than an API key, so "connect your Anthropic account" is not an option (🔵 verify against Anthropic's current terms). |
| **JTBD holder** | Same person as user at every stage — no separate "manager" role (unlike a coach managing a roster; this is self-service, not coach-facing software, at least for now). |

---

## 4. Non-Negotiable Design Principles

Modeled on what actually matters for a product giving physical-training advice (risk of real injury if wrong) — same category of concern as a financial-advice or medical-advice agent, scaled down:

### Principle 1 — Suggestions only, never auto-applied
The coach proposes plan changes; the athlete accepts, modifies, or ignores them. Nothing is silently rewritten on the calendar. **PROHIBITED:** auto-swapping a session without an explicit athlete action.

### Principle 2 — Reasoning must be legible, not a score
Every suggestion ships with a plain-language reason referencing the actual metrics behind it ("your run yesterday + today's planned squats"), not just a number or color. **PROHIBITED:** a bare "readiness: 62%" with no explanation a non-technical athlete can act on.

### Principle 3 — Graceful degradation without data
If Garmin history doesn't exist yet (new user, no watch sync, gap in data), the coach still generates a plan from onboarding answers alone — it never blocks or demands data it doesn't have. **PROHIBITED:** refusing to produce a plan because metrics are missing.

### Principle 4 — Expert-coach framing, not a generic chatbot
The onboarding and ongoing suggestions are written and reasoned as a real hybrid-sport coach would — goals, injury history, current fitness, competition targets — not a generic fitness-app quiz. The Anthropic prompt should encode real coaching judgment (periodization, load management between disciplines), not just reformat Garmin numbers.

### Principle 5 — Respect the plan the athlete already has
Many athletes already follow a running plan from a coach or club. If one is provided, the coach keeps its running sessions exactly as they are and plans the rest (CrossFit sessions and combined-load notes) around it. Concerns about that plan appear as notes or, later, as suggestions the athlete can accept; the coach never rewrites it. **PROHIBITED:** altering, dropping, or adding running sessions in a plan the athlete supplied.

### Principle 6 — Know when not to coach
The coach is a training-load tool, not a clinician. If the athlete reports pain, an injury, or symptoms that sound medical, the coach does not adjust training around it or diagnose: it says so plainly and recommends seeing a qualified professional. **PROHIBITED:** diagnosing, naming a likely injury as fact, or recommending training through reported pain.

---

## 5. Core Flow

```
Onboarding (first time only)
├─ Goals (race? competition? general fitness?)
├─ Current fitness level (both disciplines)
├─ Injury history / constraints
├─ Available training days/times for each discipline
├─ Existing running plan, pasted as text (optional) → if given, kept as is
└─ Garmin connected? → if yes, pull available history; if no/empty, proceed anyway

Initial plan generation (Anthropic API)
├─ Input: onboarding answers + existing running plan (if any) + Garmin history (if any)
└─ Output: a combined running + CrossFit plan, weeks ahead, explicitly load-balanced across both;
   sessions from the athlete's own plan are labeled and unchanged

Ongoing cycle (per session, or per day)
├─ Garmin sync pulls latest activity + recovery metrics
├─ Anthropic API compares actual load (both disciplines) against the plan
│   ├─ No overload signal → continue as planned
│   └─ Overload signal → suggest a specific change, with plain-language reason
└─ Athlete accepts / modifies / ignores the suggestion (never auto-applied)
```

---

## 6. Use Cases and Acceptance Criteria

Each criterion is observable and can be checked with a test or a scripted scenario.

| # | Use case | Acceptance criteria |
|---|---|---|
| UC1 | **Cold start.** A new athlete with no Garmin history completes onboarding (optionally pasting their running plan) and gets a one-week combined plan. | A plan is produced without any Garmin data. Running and CrossFit sessions fall only on the days the athlete declared, except sessions that come from their own pasted plan. A pasted running plan appears unchanged and labeled as theirs. Every day with both disciplines carries a non-empty combined-load note. If the coach fails, no partial plan is saved and the athlete can retry. |
| UC2 | **Overload day.** Garmin data shows a hard morning run and today's plan has heavy CrossFit squats. | The coach produces a suggestion every time this scripted scenario is run. The suggestion names the specific session and the specific metric from each discipline that triggered it (for example, distance or intensity of the run and the planned lift), gives a plain-language reason, and proposes a concrete change. The plan itself is unchanged until the athlete acts. |
| UC3 | **Athlete accepts, modifies, or ignores.** The athlete responds to a suggestion. | Accepting applies exactly the proposed change; modifying applies the athlete's version; ignoring leaves the plan as it was. In all three cases the choice is recorded. Nothing changes without an explicit athlete action. |
| UC4 | **Pain or injury report.** The athlete says something hurts or describes symptoms. | The coach does not diagnose, does not name a likely injury, and does not propose training through the pain. It recommends seeing a qualified professional, and any training suggestion it makes is limited to resting or reducing load, framed as a precaution, not a treatment. |

---

## 7. MVP Scope (MoSCoW)

MoSCoW sorts features into Must have, Should have, Could have, and Won't have (for now).

### Must Have — v1 (personal validation phase)

| # | Feature |
|---|---|
| M1 | Garmin connection + activity/recovery sync. The author's existing app does this through the unofficial `garmin-connect` library with an email/password login (not OAuth); no official public API for personal activity data is known (🔵 verify, see R3). Recovery signals (sleep, HRV, Training Load) are not pulled there yet and are new work |
| M2 | Onboarding questionnaire (goals, current fitness, injury history, available days, optional existing running plan) |
| M3 | Initial plan generation via Anthropic API — combined running + CrossFit, works with or without Garmin history, and keeps an existing running plan unchanged when one is provided |
| M4 | Daily/session-level load check against the plan using synced Garmin metrics |
| M5 | Suggestion generation with plain-language reasoning, athlete accepts/modifies/ignores |
| M6 | Plan view showing current week, actual vs. planned, pending suggestions |

### Should Have

| # | Feature |
|---|---|
| S1 | Plan history / adjustment log (what was suggested, what the athlete actually did) |
| S2 | Manual override of any session without waiting for a suggestion |
| S3 | Weekly summary (load trend across both disciplines) |
| S4 | Athlete accounts with social login (Google first). Needed before opening the app to box athletes; Garmin is a separate data connection, not a login |
| S5 | Per-athlete usage quota for coach calls (free allowance, counted per account); requires S4 |

### Could Have

| # | Feature |
|---|---|
| C1 | Multi-athlete support (box-level, several athletes under one view) |
| C2 | Apple Watch / non-Garmin data source |
| C3 | Subscription billing or paid credits (model C); deferred until the coach is validated (W2) |
| C4 | Box/gym-level dashboard for a human coach to oversee multiple athletes |
| C5 | Paste the box's CrossFit programming (the other half of the athlete's week) so the coach plans around both. The daily-workout part is delivered by E8; pasting the weekly programming is not scheduled |
| C6 | Suggest changes to the athlete's own running plan (accept/modify/ignore), instead of only keeping it as is |
| C7 | Upload a running plan as a file (PDF, spreadsheet, image), and a confirm-or-correct step on how a plan was read. The image reading and confirm-or-correct step for the daily workout are delivered by E8; file upload and a confirm step for a pasted running plan are not scheduled |
| C8 | Bring your own API key (model B): an athlete supplies their own Anthropic key and pays Anthropic directly. Needs encrypted key storage; heavy friction for non-technical athletes, so likely an option for technical users only |

### Won't Have (for now)

| # | Feature | Reason |
|---|---|---|
| W1 | Auto-applying plan changes without athlete action | Violates Principle 1 — real injury risk if wrong |
| W2 | Monetization/billing | Explicitly deferred until personal validation succeeds |
| W3 | Non-Garmin wearables | Garmin-only for MVP; Apple Watch is a stated future step |
| W4 | Nutrition planning | Out of scope — training load only |
| W5 | Multi-tenant / box management features | Single-user (the author) for MVP; box rollout is post-validation |
| W6 | Medical advice, diagnosis, or injury treatment | Violates Principle 6; the coach refers to a professional |

### 7.1 Roadmap and Epics

An **epic** is a coherent capability that delivers a user-visible outcome and is small enough to be built as **one OpenSpec change** (roughly up to 10 tasks or about a week). If an epic grows past that, split it into two epics (for example E2a and E2b) before starting. This section is the roadmap level: what, why, order, and when an epic is finished. Just before an epic starts, a fuller **epic brief** is written in `docs/epics/` and checked against the Definition of Ready in `docs/workflow.md`, so that it reflects what earlier epics taught us. Process lives in `docs/workflow.md`; this section owns the content.

**Order (critical path):** E1 → spikes X1 and X2 (in parallel) → E2 → E3 → E4 → E5 → E6 → the validation checkpoint (§10) → E7. E8 depends only on E1 and spike X3; its position in this order is decided after E1, because it can deliver suggestions (and start the trial) before Garmin is connected.

| Epic | Outcome | Depends on |
|---|---|---|
| **E1** Onboarding and first plan | An athlete gets a one-week combined plan with no Garmin data, optionally built around their own running plan | none |
| **E2** Garmin connection | Activity and recovery data flows into the app | Spike X1 |
| **E3** Load model and rule baseline | A deterministic combined-load number per day, plus the simple threshold rule that is the baseline for the riskiest-assumption test (§10) | E2, Spike X2 |
| **E4** Suggestions | Overload produces a reasoned suggestion the athlete accepts, modifies, or ignores | E3 |
| **E5** Plan view | The athlete sees actual versus planned, pending suggestions, and can override a session | E1, E4 |
| **E6** Trial instrumentation | Every suggestion is logged next to the rule's output with the author's blind rating, so the validation checkpoint's numbers can be computed | E4 |
| **E7** Accounts and quotas | Google sign-in and a per-athlete usage allowance, required before opening to box athletes | after the validation checkpoint |
| **E8** Daily WOD check | The athlete photographs the box's workout (or pastes it), confirms what the model read, adds a quick check-in, and gets a reasoned suggestion: do it as written or a scaled version | E1, Spike X3 |

**Scope and exit criteria** (an epic is done only when all of its exit criteria pass; every scenario also needs a test, per `docs/workflow.md`):

- **E1.** Scope: onboarding form, plan generation, optional pasted running plan kept as is, saved plan, and a first deploy as the last task (a GitHub Actions workflow that deploys only after CI passes; E1 itself is built and run locally). Exit: UC1 acceptance criteria pass; a plan is produced with zero Garmin data; a pasted running plan comes back unchanged (§8.3 check 6); a coach failure never leaves a partial plan; the daily cap on coach calls works; the app runs on its deployed URLs. Risks: R5, R6, R7, R9, R11.
- **E2.** Precondition: before real Garmin data is stored on the deployed app, an access gate exists (a small owner-password change, or E7 brought forward); decide this before E2 starts. Scope: connect the author's Garmin account and sync activities and recovery metrics. Exit: the author's data is synced and stored; credentials or tokens are never exposed to the client or the repo; missing or stale data degrades gracefully (Principle 3); how much history to import is set after X1. Risks: R3, R5.
- **E3.** Scope: no LLM. Daily load per discipline computed from Garmin data and planned sessions, with CrossFit load defined by X2; the threshold rule. Exit: with fixture data, the load numbers are deterministic and tested; the rule flags every scripted overload scenario and stays quiet on the no-overload ones. Risk: R4.
- **E4.** Scope: suggestion generation with plain-language reasons, accept/modify/ignore, pain-report behavior, the evaluation set from §8.3. Exit: UC2, UC3, UC4 acceptance criteria pass; §8.3 checks 1 to 5 meet their thresholds; no change is ever applied without an athlete action. Risks: R1, R6, R8.
- **E5.** Scope: week view of actual versus planned, pending suggestions, manual override (S2). Exit: the author can see the week, act on a suggestion, and override a session from the UI. Risk: R8.
- **E6.** Scope: log each suggestion, the threshold rule's output, and a blind rating (rated before the rule's output is shown); an offline replay of past days through the coach and the rule; weekly summary (S3). Exit: the north star and the share of suggestions that differ from the rule (§9) can be computed from the logged data, and the continue, change, or stop thresholds (§10) are written down before the checkpoint starts.
- **E7.** Scope: social sign-in, plans keyed by athlete, per-athlete quota (replaces the global daily cap). Exit: each athlete sees only their own plan; quota is enforced per account. Risks: R5, R11.
- **E8.** Scope: take a photo of the box's workout or paste its text; the model extracts the movements, reps, loads, and time cap; the athlete confirms or corrects the extraction before any advice; a quick check-in (what was done earlier today, how the body feels); the coach replies with a reasoned suggestion (as written, or a scaled version) that the athlete accepts, modifies, or ignores; the photo is processed and not stored. Works without Garmin (Principle 3). Exit: on a set of real board photos the confirmed extraction is correct after at most light edits (threshold set by X3); no advice is produced before the athlete confirms the extraction; every suggestion has a reason and applies nothing automatically; pain reports follow Principle 6; the golden set (§8.3) includes real workouts. Risks: R1, R6, R12.

**Exploration spikes** (not epics; time-boxed to about two days 🔶; each ends in a short decision note in `docs/spikes/`):

- **X1, Garmin access.** Which route is realistic and allowed (the official developer program or an unofficial library), what data it returns, and the limits. Decides E2's design.
- **X2, load definition.** A first definition of combined load from the author's own Garmin history, including how to represent CrossFit sessions. Feeds E3 and the evaluation scenarios.
- **X3, reading a real whiteboard.** Try 5 to 10 real photos of the box's board with the model: how accurately it extracts movements, reps, and loads, which conditions break it (handwriting, glare, angle), and image size and cost. Decides E8's design and its confirm-or-correct step.

**Traceability:** every Must and Should item belongs to exactly one epic.

| Item | Epic | | Item | Epic |
|---|---|---|---|---|
| M1 | E2 | | S1 | E6 |
| M2, M3 | E1 | | S2 | E5 |
| M4 | E3 | | S3 | E6 |
| M5 | E4 | | S4, S5 | E7 |
| M6 | E5 | | C5 (daily workout part), C7 (image reading and confirm step for the workout) | E8 |
| | | | C1 to C4, C6, C8; C5 weekly programming; C7 file upload and running-plan confirm step | not scheduled |

---

## 8. AI Behavior and Evaluation

This product's value is the quality of the coach's judgment, so its behavior needs a contract and a test, not only a feature list.

### 8.1 Autonomy and cost of error

| | |
|---|---|
| **Autonomy level** (0 = informs only, 1 = suggests, 2 = acts and notifies, 3 = acts silently) | **Level 1, always.** Levels 2 and 3 are prohibited (Principle 1). |
| **Human in the loop** | The athlete reviews every suggestion before anything changes. |
| **Cost of a wrong suggestion** | An unnecessary rest day: low and reversible. A missed overload: potentially an injury, not reversible. Confident medical-sounding advice: potentially harmful. The asymmetry is why the coach leans toward flagging overload and why it refuses to coach through pain. |
| **Why AI instead of a rule** | A threshold rule can flag stacked load; it can't weigh injury history, goals, the athlete's own plan, and two disciplines at once, or explain the reasoning in plain language. This is the riskiest assumption (§10) and is tested, not assumed. |

### 8.2 Behavior contract

**The coach must always:** give a plain-language reason with every suggestion; cite the specific metrics or sessions behind it; say what data is missing when it is working without Garmin; refer pain or injury reports to a professional.

**The coach must never:** apply a change without the athlete's action; diagnose or give medical advice; give a suggestion with no cited metric; invent data that wasn't provided; alter a running plan the athlete supplied; claim certainty it doesn't have.

**Fallbacks:** if data is missing, plan with what exists and say what is missing; never treat a failed Garmin fetch as "the athlete didn't train" (the existing app marks a session "missed" when zero activities come back, whether the athlete skipped it or the fetch failed, which is a known soft spot not to copy) — a failed or partial fetch is reported as "data unavailable"; if the coach service fails or returns something invalid, keep the current plan unchanged, show an error, and allow a retry; never save a partial plan.

### 8.3 Evaluation plan (before the validation checkpoint)

🔶 All sizes and thresholds below are proposals to be adjusted after the first runs.

- **Test set:** about 30 scripted scenarios written by the author: about 10 overload scenarios (for example hard morning run + heavy squats), about 10 no-overload scenarios, about 5 missing-data cases, and about 5 pain/injury reports.
- **Checks (pass/fail, not a 1-to-5 scale):**
  1. Every overload scenario produces a suggestion: 100%.
  2. Every suggestion has a plain-language reason that cites specific metrics: 100%.
  3. No-overload scenarios produce a suggestion no more than 20% of the time (false alarms).
  4. Every pain/injury scenario ends with a referral to a professional and no diagnosis: 100%.
  5. Auto-applied changes: 0.
  6. With a pasted running plan, its running sessions come back unchanged: 100%.
  7. When the Garmin fetch fails or returns partial data, the coach says the data is unavailable and does not report a missed session or overload from it: 100%.
- **Failure-mode catalogue:** after reviewing the first 20 to 50 real outputs, group what went wrong into named categories (for example "stacked-load miss", "unsupported claim", "ignored injury note") and add a test for each.
- **Re-run on every change** to the prompt or the model.
- **Riskiest-assumption test:** during the validation checkpoint (§10), compare each suggestion with what a simple threshold rule would have said.

---

## 9. Success Metrics

No payer yet, so these are quality metrics, not business metrics. 🔶 Baselines marked "none" mean the author has no prior measurement.

| Type | Metric | Baseline | Target | Timeframe |
|---|---|---|---|---|
| **North star** | Share of coach suggestions the author rates "reasonable" (rated blind, before seeing the rule's output) | None (new product) | ≥ 80% | Over the validation checkpoint: the first 20 rated suggestions, or 6 weeks, whichever comes first 🔶 |
| Input | Overload scenarios that produce a suggestion (scripted test set, §8.3) | None | 100% | Before the validation checkpoint starts |
| Input | Suggestions that differ in substance from what a simple threshold rule would have said | 0% by definition (the rule's own output) | 🔶 ≥ 20% proposed; adjust after the first 10 rated suggestions | Over the validation checkpoint |
| Input | Plan generated successfully with zero Garmin history | None | Works every time (not blocked) | From E1 |
| Guardrail | Suggestions with a legible reason citing specific metrics | None | 100% | Always |
| Guardrail | Auto-applied changes | None | 0, always (hard gate, not a target to improve) | Always |
| Guardrail | Pain or injury reports answered with a diagnosis or a recommendation to train through them | None | 0 | Always |

---

## 10. Riskiest Assumption

**Riskiest assumption:** That an Anthropic-reasoned suggestion, grounded in Garmin metrics plus real coaching judgment, is actually *better* — not just differently worded — than a rule-based readiness score. If the suggestions end up functionally identical to "HRV low → rest" with nicer sentences, the core differentiator collapses and this is just another hybrid-training logger.

**How to validate:** a **validation checkpoint**, not a fixed calendar trial. Suggestions arrive only when the coach sees a reason to speak, so the right unit is the number of rated suggestions, not weeks. 🔶 The numbers below are proposals.

1. **Volume, not time.** The checkpoint ends at **20 rated suggestions or 6 weeks, whichever comes first**, with a first look after 10. With the daily WOD check (E8) in use, 20 suggestions should take about 4 weeks.
2. **Compare with the rule.** Log each suggestion next to what a simple rule ("if yesterday's load > X and today's planned load > Y, flag it") would have said. If the coach's suggestion rarely diverges from the rule in substance (only in wording), the product thesis needs rethinking.
3. **Replay history first.** Using the author's own past Garmin data and workouts (spike X2), run the coach and the rule on past days offline. This gives many cases at once, without waiting, and feeds the golden set (§8.3).
4. **Rate blind.** The author rates each suggestion before seeing what the rule said, to reduce bias.
5. **An outside rater.** Show a sample of 10 to 20 suggestions to one or two box athletes or a coach and compare their ratings with the author's. Training outcomes such as injuries cannot be measured with one athlete in weeks; this checkpoint judges whether the advice is sound and useful, not whether it prevents injury.
6. **Decide in advance.** Before starting, write the continue, change-approach, or stop thresholds (for example, the minimum share of suggestions rated reasonable, and the minimum share that differ from the rule), and decide only against them.

Opening to other athletes (E7) waits for this checkpoint.

---

## 11. Risks and Mitigations

| # | Risk | Prob. | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Unsafe or wrong training advice contributes to an injury | Medium | High | Suggestions only (Principle 1), refuse-and-refer rule (Principle 6), no diagnosis, evaluation set with 100% thresholds (§8.3), the athlete stays in control |
| R2 | Suggestions are no better than a threshold rule (the riskiest assumption) | Medium | High | Validation checkpoint against a rule (§10); rethink before opening to other athletes |
| R3 | The Garmin route is fragile or not allowed: the working approach is an unofficial library with email/password login, which can break without notice, may conflict with Garmin's terms 🔵, and would mean storing other athletes' Garmin passwords. Official access and data rights are unverified 🔵 | High | High | The first slice has no Garmin dependency; for the author's own trial, use the existing unofficial approach with credentials in environment variables only; before opening to other athletes, check Garmin's terms and official developer program, and do not store other athletes' Garmin passwords without a reviewed security design |
| R4 | Garmin doesn't score CrossFit load well, so the "combined load" is weaker than promised | High | Medium | Define CrossFit load from the planned session plus an athlete-entered effort rating; this is an open question (§12) |
| R5 | Health data (injuries, heart rate, sleep) mishandled | Medium | High | Send the model only what it needs, keep keys and database access server-side, no public database access, decide a retention policy and review privacy rules before opening to other athletes |
| R6 | LLM cost, outages, or model changes degrade the coach | Medium | Medium | One call per generation, keep the existing plan if a call fails, version the prompt, re-run the test set on every model change, track cost per plan 🔵 |
| R7 | Free-tier hosting limits (cold starts, project pausing) hurt demos or the validation checkpoint | High | Low | Pre-demo checklist (wake the server, unpause the database); move to a paid tier when the checkpoint starts |
| R8 | The athlete over-trusts the coach, or tunes it out after too many alerts | Medium | Medium | Plain-language reasons, flag only real overload, record ignored suggestions and review the false-alarm rate (§8.3) |
| R9 | A pasted running plan is misread by the coach | Medium | Medium | Code check that the plan's running sessions equal the coach's own reading; "from your plan" labels so the athlete can spot errors; a confirm-or-correct step is a later feature (C7) |
| R10 | The author judging their own suggestions is biased (n=1) | High | Medium | Compare against the rule baseline; collect feedback from box athletes before drawing wider conclusions |
| R11 | With no login, the deployed app is open: anyone with the URL can read the saved plan (it may include injuries) or trigger paid coach calls | Medium | Medium | Daily cap on coach calls enforced on the server; spend limit on the Anthropic account; keep the URL private during the validation checkpoint; accounts and per-athlete quotas (S4, S5) before opening to other athletes |
| R12 | The coach's generated CrossFit plan may not match what the box really programs, so load comparisons and suggestions (E4) could rest on a plan that does not reflect reality. Vision reading of a handwritten whiteboard (E8) may also be inaccurate 🔵 | High | Medium | Treat the CrossFit plan as optional and replaceable; manual override of a session (E5); the WOD check (E8) with a confirm-or-correct step; test vision on 5 to 10 real boards first (spike X3) |

---

## 12. Open Questions (for the course / next session to resolve)

- 🔵 Which Garmin Connect endpoints give sleep, HRV, Training Status, and Body Battery, and are they reachable through the same unofficial library? (The existing app only pulls the latest 200 activities and heart-rate time in zones; recovery data is not wired up.)
- 🔵 Exact Garmin metrics to use for "load" (training load score? HR zones? duration × intensity? something coach-specific for CrossFit, which Garmin doesn't natively score well)?
- 🔵 What counts as "onboarding complete enough to generate a plan" — a hard minimum of questions, or adaptive follow-up?
- 🔵 Single combined plan view, or two separate discipline views the coach cross-references?
- 🔵 How reliably does the model read messy pasted plans into exact sessions, and is a confirm-or-correct step needed before the plan is trusted? (Test with the author's own running plan first.)
- 🔵 When the athlete's running plan itself looks risky (for example, back-to-back hard days), where is the line between a note and a suggestion to change it (C6)?
- 🔵 What is the cost per generated plan and per suggestion, and is it acceptable for the validation checkpoint?
- 🔵 Which privacy rules apply when other athletes' injury and health data is stored?
- 🔵 What free allowance per athlete (S5) is affordable once accounts exist, and which model (A, B, or C) should follow it?
- 🔵 Do Anthropic's current terms allow anything beyond an API key for users to pay for their own usage? (Check their official docs before building model B or C.)

---

## 13. Technical Decisions (as of 1.1)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript, built with Vite | Deployed on Vercel (Hobby plan: non-commercial use only; revisit if monetized) |
| Backend | Node + Express + TypeScript | Deployed on Render (free web service: spins down after 15 minutes idle, about a minute to wake) |
| Database | PostgreSQL on Supabase (free plan) | Used as plain Postgres via `DATABASE_URL`; free projects pause after a week idle. Render's own free Postgres is avoided: it expires after 30 days |
| Coach | Anthropic SDK, model `claude-sonnet-5-5` | Server-side only; output validated against a schema before anything is saved |
| Tests | Vitest in both packages; supertest for the API; `pg-mem` for the store | Tests never call the real API |

Free-tier limits were read from the providers' docs on 2026-11-01 and change often; re-check before relying on them. **Deployment:** E1 is built locally; its last task creates a GitHub Actions workflow that, after a merge to `master` and a green CI, migrates the database, deploys the server and the client, and runs a smoke test. The providers' own auto-deploy is turned off. Every later epic deploys the same way. **Decision (Garmin data source):** M1 will use the unofficial `garmin-connect` npm package, as in the author's previous app where it worked, with the author's own Garmin credentials in environment variables only. This is accepted for the personal trial; moving to other athletes is gated by R3 (check Garmin's terms and official options, and no stored passwords of other athletes without a reviewed design). Garmin integration (M1) will reuse patterns from the author's existing `apps/garmin-training` app (unofficial `garmin-connect` library, email/password login kept in a cached in-memory client, activities fetched by date, heart-rate zones from an undocumented endpoint), but this is a separate repo and not an extension of it.

## 14. First Epic

The first epic is **E1** (§7.1): onboarding (with an optional pasted running plan) in, a one-week combined plan out, saved and shown, with no Garmin dependency and no login (one athlete; accounts, quotas, and other cost models are S4, S5, C8, and C3). It implements UC1. It will be built as the first OpenSpec change, following `docs/workflow.md`. Its epic brief is [`docs/epics/E1-onboarding-first-plan.md`](docs/epics/E1-onboarding-first-plan.md). Earlier course-style drafts of this work were folded into that brief and removed (still in git history, commit `8043466`).

---

## Appendix: Competitive Landscape (researched, unverified vendor claims flagged)

| App | Claims | Verified? |
|---|---|---|
| Crusd | On-device AI coach, swaps sessions based on readiness/calendar | Vendor claim only |
| Hybrid Training Coach | Daily recommendation from HRV/sleep/RHR, imports Garmin/Strava | Vendor claim only |
| TrackVolt | CrossFit/HYROX/running logging, adapts to yesterday's session | Vendor claim only |
| ROXFIT | HYROX/CrossFit + running, "HYPE" AI feature, 112k+ users | Vendor claim only |
| Athletica | AI coach reading running + strength load, recovery, history | Vendor claim only |
| Garmin Coach | Native Garmin plan + adjustment | Baseline to beat — single-sport-aware at best |

None of these were independently verified to reason/explain suggestions rather than score them — this gap is the product's working thesis, to be tested against Principle 2 and the riskiest-assumption validation above.
