# 0006. Hosting

**Status:** Proposed
**Date:** 2026-11-05

## Context

The owner wants free or very cheap hosting for a personal, single-user phase. Free-tier limits below were read from the providers' own documentation on 2026-11-01 and change often.

## Options considered

- **Render's own free Postgres:** rejected, because it expires 30 days after creation.
- **Railway:** a small free monthly credit and 0.5 GB of RAM; an always-on server would likely use it up. What happens when credits run out is unclear.
- **Koyeb:** no free compute listed, only a free Postgres.
- **Fly.io:** the pricing page could not be read, so it was not evaluated.
- **Vercel, Render, and Supabase:** a free tier for each of the three pieces.

## Decision

- Client on Vercel (Hobby plan).
- Server on Render (free web service).
- Database on Supabase (free plan), in the same region as the server where possible.

## Consequences

- Render free services spin down after 15 minutes without traffic and take about a minute to wake. This will hurt daily use at the box; plan a paid tier or a keep-warm approach once the app is used daily, and show a "waking up" state in the client.
- Supabase free projects pause after a week of inactivity; open the project before demos or checkpoints.
- Vercel Hobby is for non-commercial use only; revisit if the product is ever monetized.
- Every limit above must be re-checked before relying on it.
