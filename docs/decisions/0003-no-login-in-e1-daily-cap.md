# 0003. No login in E1; a daily cap on coach calls

**Status:** Proposed
**Date:** 2026-11-05

## Context

The first epic should prove the core flow, and login adds a lot of work without proving it. The deployed app, however, would be reachable by anyone with the URL, and every plan generation spends the owner's Anthropic credits. Per-user credits would need accounts and usage tracking, and billing is deferred. As far as secondary sources show, Anthropic offers no way for a third-party app to bill a user's own Anthropic account other than an API key (unverified against Anthropic's official terms).

## Options considered

- **Add Google login in E1:** safest, but a much larger first epic.
- **No login, no limit:** simplest, but an open endpoint can spend credits and expose a saved plan.
- **No login, with a daily cap and a spend limit:** bounds the cost with a few lines of code.
- **Bring-your-own API key, or paid credits:** deferred; heavy friction or a billing feature.

## Decision

E1 has no login. The server enforces `MAX_COACH_CALLS_PER_DAY` (default 20; past it, 429) and the owner sets a spend limit on the Anthropic account. Accounts and per-athlete quotas are epic E7. Before real Garmin data is stored on the deployed app (E2), an access gate must exist.

## Consequences

- The deployed URL is readable by anyone until the gate exists; the cost is bounded by the cap.
- The cap counts failed coach calls too, because they can still cost money.
- The cost model is: the owner's key now, a free per-athlete allowance next, bring-your-own key or paid credits later only if the product is validated.
