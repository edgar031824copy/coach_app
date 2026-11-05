# 0001. OpenSpec expanded path with a thin harness

**Status:** Proposed
**Date:** 2026-11-05

## Context

The project is built by one person with an AI coding agent, and the owner wants to practice a disciplined, spec-driven, partly autonomous workflow: requirements clear before building, small reviewed changes, deterministic checks, and a human at the key gates.

## Options considered

- **AIDLC workflows:** built for teams and large systems; every stage is an approval wall, with no support for unattended runs. Too heavy for one builder.
- **A custom multi-agent harness** (the solo-mode design: architect, developers, techlead, QA, devops agents with a state machine): proven by the owner, but six roles is more than one small app needs, and its weak point was self-reported "done" checkboxes.
- **OpenSpec alone:** good artifacts, but no state, no loop, and no deterministic verification.
- **OpenSpec plus a thin harness:** OpenSpec for the artifacts, and hooks, CI, scripts, and two read-only reviewers for the checks.

## Decision

Use OpenSpec on the expanded path (`new`, `continue`, `apply`, `verify`, `archive`), with **one epic equal to one change**. Add a thin harness: one working agent plus two read-only reviewers, hooks and CI as the hard gates, and the owner approving the design (G1) and every merge (G5). Details: `docs/workflow.md`.

## Consequences

- The harness pieces still have to be built (see `docs/workflow.md` §15); until then several gates are manual.
- `/opsx:verify` is an LLM step with no exit code, so it supports but never replaces tests and CI.
- Some OpenSpec behaviors on the expanded path are unverified (see `docs/workflow.md` §16) and get tested in the first epic.
- No orchestration engine or state-machine library; revisit only if the manual flow becomes the bottleneck.
