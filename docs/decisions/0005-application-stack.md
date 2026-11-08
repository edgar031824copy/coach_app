# 0005. Application stack

**Status:** Accepted (2026-11-08)
**Date:** 2026-11-05

## Context

The owner chose React for the front end, Express for the back end, and Postgres for the database. The product calls an LLM, so the key and all model calls must stay on the server. The test approach must never call the real model.

## Options considered

- **Next.js full stack:** fewer moving parts, but not the owner's preferred shape, and it blurs the line between client and server code.
- **React with Vite plus a separate Express server:** two small packages with a clear boundary, familiar to the owner.

## Decision

- Client: React, TypeScript, and Vite.
- Server: Node, Express, and TypeScript.
- Database: PostgreSQL, used through the `pg` driver and a `DATABASE_URL`, with no vendor client library.
- Coach: the Anthropic SDK, server-side only, model `claude-sonnet-5-5`, with output validated against a schema before anything is saved.
- Tests: Vitest in both packages, supertest for the API, `pg-mem` for the store, and a fake coach client everywhere so no test calls the real API.

## Consequences

- Two packages (`client/` and `server/`) to build, test, and deploy separately.
- Plain Postgres keeps the database portable between providers.
- Model id availability, structured output support in the SDK, and `pg-mem` coverage of `jsonb` and `timestamptz` are unverified and get checked in epic E1.
