-- plans: every saved plan with the onboarding that produced it (design.md Decision 5).
create table plans (
  id bigserial primary key,
  plan jsonb not null,
  onboarding jsonb not null,
  created_at timestamptz not null default now()
);

-- coach_call_counts: one row per UTC day; the daily cap is a single atomic upsert on this table.
create table coach_call_counts (
  day date primary key,
  calls int not null
);
