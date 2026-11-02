# PRD · Virtual Hybrid Coach

**Version:** 1.3 (base — to be modified during the a4fordevs course)
**Date:** 2026-11-01
**Status:** Draft, pre-validation phase
**Repo:** `coach_app` (this document is the source of truth for what to build and why)

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
| C5 | Paste the box's CrossFit programming (the other half of the athlete's week) so the coach plans around both |
| C6 | Suggest changes to the athlete's own running plan (accept/modify/ignore), instead of only keeping it as is |
| C7 | Upload a plan as a file (PDF, spreadsheet, image), and a confirm-or-correct step on how the plan was read |
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

### 8.3 Evaluation plan (before the 4-week trial)

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
- **Riskiest-assumption test:** during the 4-week trial, compare each suggestion with what a simple threshold rule would have said (see §10).

---

## 9. Success Metrics

No payer yet, so these are quality metrics, not business metrics. 🔶 Baselines marked "none" mean the author has no prior measurement.

| Type | Metric | Baseline | Target | Timeframe |
|---|---|---|---|---|
| **North star** | Share of coach suggestions the author judges "reasonable" in a weekly self-review | None (new product) | ≥ 80% | Over the 4-week personal trial |
| Input | Overload scenarios that produce a suggestion (scripted test set, §8.3) | None | 100% | Before the trial starts |
| Input | Suggestions that differ in substance from what a simple threshold rule would have said | 0% by definition (the rule's own output) | 🔶 ≥ 20% proposed; adjust after week 1 | Over the 4-week trial |
| Input | Plan generated successfully with zero Garmin history | None | Works every time (not blocked) | From the first slice |
| Guardrail | Suggestions with a legible reason citing specific metrics | None | 100% | Always |
| Guardrail | Auto-applied changes | None | 0, always (hard gate, not a target to improve) | Always |
| Guardrail | Pain or injury reports answered with a diagnosis or a recommendation to train through them | None | 0 | Always |

---

## 10. Riskiest Assumption

**Riskiest assumption:** That an Anthropic-reasoned suggestion, grounded in Garmin metrics plus real coaching judgment, is actually *better* — not just differently worded — than a rule-based readiness score. If the suggestions end up functionally identical to "HRV low → rest" with nicer sentences, the core differentiator collapses and this is just another hybrid-training logger.

**How to validate (no code needed beyond the MVP itself):** During the author's own 4-week personal trial, log each suggestion next to what a simple rule ("if yesterday's load > X and today's planned load > Y, flag it") would have said. If the Anthropic-reasoned suggestion rarely diverges from the simple rule in substance — only in phrasing — the product thesis needs rethinking before expanding to other athletes.

---

## 11. Risks and Mitigations

| # | Risk | Prob. | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Unsafe or wrong training advice contributes to an injury | Medium | High | Suggestions only (Principle 1), refuse-and-refer rule (Principle 6), no diagnosis, evaluation set with 100% thresholds (§8.3), the athlete stays in control |
| R2 | Suggestions are no better than a threshold rule (the riskiest assumption) | Medium | High | 4-week comparison against a rule (§10); rethink before opening to other athletes |
| R3 | The Garmin route is fragile or not allowed: the working approach is an unofficial library with email/password login, which can break without notice, may conflict with Garmin's terms 🔵, and would mean storing other athletes' Garmin passwords. Official access and data rights are unverified 🔵 | High | High | The first slice has no Garmin dependency; for the author's own trial, use the existing unofficial approach with credentials in environment variables only; before opening to other athletes, check Garmin's terms and official developer program, and do not store other athletes' Garmin passwords without a reviewed security design |
| R4 | Garmin doesn't score CrossFit load well, so the "combined load" is weaker than promised | High | Medium | Define CrossFit load from the planned session plus an athlete-entered effort rating; this is an open question (§12) |
| R5 | Health data (injuries, heart rate, sleep) mishandled | Medium | High | Send the model only what it needs, keep keys and database access server-side, no public database access, decide a retention policy and review privacy rules before opening to other athletes |
| R6 | LLM cost, outages, or model changes degrade the coach | Medium | Medium | One call per generation, keep the existing plan if a call fails, version the prompt, re-run the test set on every model change, track cost per plan 🔵 |
| R7 | Free-tier hosting limits (cold starts, project pausing) hurt demos or the trial | High | Low | Pre-demo checklist (wake the server, unpause the database); move to a paid tier when the trial starts |
| R8 | The athlete over-trusts the coach, or tunes it out after too many alerts | Medium | Medium | Plain-language reasons, flag only real overload, record ignored suggestions and review the false-alarm rate (§8.3) |
| R9 | A pasted running plan is misread by the coach | Medium | Medium | Code check that the plan's running sessions equal the coach's own reading; "from your plan" labels so the athlete can spot errors; a confirm-or-correct step is a later feature (C7) |
| R10 | The author judging their own suggestions is biased (n=1) | High | Medium | Compare against the rule baseline; collect feedback from box athletes before drawing wider conclusions |
| R11 | With no login, the deployed app is open: anyone with the URL can read the saved plan (it may include injuries) or trigger paid coach calls | Medium | Medium | Daily cap on coach calls enforced on the server; spend limit on the Anthropic account; keep the URL private during the trial; accounts and per-athlete quotas (S4, S5) before opening to other athletes |

---

## 12. Open Questions (for the course / next session to resolve)

- 🔵 Which Garmin Connect endpoints give sleep, HRV, Training Status, and Body Battery, and are they reachable through the same unofficial library? (The existing app only pulls the latest 200 activities and heart-rate time in zones; recovery data is not wired up.)
- 🔵 Exact Garmin metrics to use for "load" (training load score? HR zones? duration × intensity? something coach-specific for CrossFit, which Garmin doesn't natively score well)?
- 🔵 What counts as "onboarding complete enough to generate a plan" — a hard minimum of questions, or adaptive follow-up?
- 🔵 Single combined plan view, or two separate discipline views the coach cross-references?
- 🔵 How reliably does the model read messy pasted plans into exact sessions, and is a confirm-or-correct step needed before the plan is trusted? (Test with the author's own running plan first.)
- 🔵 When the athlete's running plan itself looks risky (for example, back-to-back hard days), where is the line between a note and a suggestion to change it (C6)?
- 🔵 What is the cost per generated plan and per suggestion, and is it acceptable for a free personal trial?
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

Free-tier limits were read from the providers' docs on 2026-11-01 and change often; re-check before relying on them. **Decision (Garmin data source):** M1 will use the unofficial `garmin-connect` npm package, as in the author's previous app where it worked, with the author's own Garmin credentials in environment variables only. This is accepted for the personal trial; moving to other athletes is gated by R3 (check Garmin's terms and official options, and no stored passwords of other athletes without a reviewed design). Garmin integration (M1) will reuse patterns from the author's existing `apps/garmin-training` app (unofficial `garmin-connect` library, email/password login kept in a cached in-memory client, activities fetched by date, heart-rate zones from an undocumented endpoint), but this is a separate repo and not an extension of it.

## 14. First Slice (a4fordevs Estación 7)

The first demoable slice is **M3 plus the minimum of M2**: onboarding (with an optional pasted running plan) in, a one-week combined plan out, saved and shown, with no Garmin dependency and no login (one athlete; accounts, quotas, and other cost models are S4, S5, C8, and C3). It implements UC1. Source of truth: [`docs/spec-rebanada.md`](docs/spec-rebanada.md); grade and gaps: [`docs/spec-review.md`](docs/spec-review.md); implementation plan: [`docs/tasks/`](docs/tasks/).

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
