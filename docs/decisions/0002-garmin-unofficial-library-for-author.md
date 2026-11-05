# 0002. Garmin data through an unofficial library, for the author's own account

**Status:** Proposed (provisional; revisit at spike X1 and before opening the app to other athletes)
**Date:** 2026-11-05

## Context

The coach needs the athlete's activity and recovery data (E2). The owner's earlier Garmin app already syncs data through an unofficial npm library that logs in with the owner's Garmin credentials, kept in environment variables. Garmin's official developer program, its approval process, and the terms for third-party use have not been checked. The earlier app logs in with email and password, keeps a cached in-memory client, fetches activities by date, and reads heart-rate zones from an undocumented endpoint; E2 can reuse those patterns, but this repo is separate and not an extension of that app.

## Options considered

- **Official Garmin developer access:** the proper route for other athletes, but availability and terms are unverified.
- **Unofficial library with the owner's own credentials:** works today for one athlete and is quick to reuse; can break without notice and may conflict with Garmin's terms.

## Decision

For the owner's own account during the validation phase, use the unofficial library, with credentials only in server environment variables. Do **not** store other athletes' Garmin passwords. Spike X1 confirms the route before E2's design is written.

## Consequences

- Sync may break without warning; the app must degrade gracefully (PRD Principle 3).
- This is limited to a single user until Garmin's terms and the official route are reviewed.
- A security design is required before any other athlete's credentials are handled.
