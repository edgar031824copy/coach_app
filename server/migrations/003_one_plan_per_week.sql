-- One plan per week (coach-plan-history, design Decision 1). READ THIS BEFORE MERGING: it DELETES rows of `plans`.
-- For each week that has more than one plan, the plan with the latest created_at stays (the highest id on a tie) and
-- the others are first copied to `plans_merged`, then deleted. Then the database is told to refuse a second plan for a
-- week. Weeks with one plan are untouched. Running it again changes nothing. `plans_merged` is read by no code: drop
-- it in a later migration once you have looked at production and are sure.
-- Unlike the earlier migrations it is not backward compatible: an old server that rebuilds an existing week gets an
-- error (nothing is lost) until the new server is live (design Decision 9). Forward-only; the runner wraps the file in
-- one transaction.
create table if not exists plans_merged as select * from plans where false;

insert into plans_merged
select p.* from plans p
where exists (
  select 1 from plans q
  where q.week_start = p.week_start and (q.created_at, q.id) > (p.created_at, p.id)
);

delete from plans p
where exists (
  select 1 from plans q
  where q.week_start = p.week_start and (q.created_at, q.id) > (p.created_at, p.id)
);

create unique index if not exists plans_week_start_key on plans (week_start);
