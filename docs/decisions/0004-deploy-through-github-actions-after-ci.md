# 0004. Deploy through GitHub Actions, after CI, with E1 built locally

**Status:** Proposed
**Date:** 2026-11-05

## Context

Deploying only at the end hides deployment problems until late, while deploying every PR on free tiers is wasteful and multiplies secrets and model calls. The providers' own Git auto-deploy ignores the repository's CI result.

## Options considered

- **Local until everything is built:** no exposure, but late discovery of deploy problems and no use from a phone.
- **A preview deploy per PR:** early feedback, but a poor fit for free tiers.
- **The providers' Git auto-deploy:** easy, but it can ship a red build.
- **One deploy workflow in GitHub Actions after CI passes:** one place for logs and gates, and a controlled order.

## Decision

E1 is built and run locally; its last task creates the deploy workflow and puts the base scaffold on a URL. After that, a merge to `master` with a green CI runs a workflow that migrates the database, deploys the server, deploys the client, and runs a smoke test. The providers' own auto-deploy is disabled. Merging is the deploy approval (G5). There is no staging environment.

## Consequences

- Secrets (provider tokens, deploy hook, database URL for migrations) live in GitHub Actions secrets.
- Nothing ships past a red CI, and nothing deploys twice.
- There are no preview environments; the first time a change is seen live is after merge.
