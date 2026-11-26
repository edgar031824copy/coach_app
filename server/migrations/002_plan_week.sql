-- plans.week_start: the Monday of the week a plan is for (coach-plan-week-and-delete, design Decisions 1 and 3).
-- Earlier plans get the Monday of the week they were created in (UTC; Postgres weeks start on Monday). The column then
-- gets a default, so the OLD server, whose insert names no week, keeps working between this migration and the new server
-- going live, and after a rollback. Forward-only; the runner wraps the file in one transaction.
alter table plans add column week_start date;
update plans set week_start = date_trunc('week', created_at at time zone 'UTC')::date;
alter table plans alter column week_start set default (date_trunc('week', now() at time zone 'UTC')::date);
alter table plans alter column week_start set not null;
