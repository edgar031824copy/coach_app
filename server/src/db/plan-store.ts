import { OnboardingSchema, PlanRecordSchema, PlanSchema, isMonday, type Onboarding, type Plan, type PlanRecord } from 'shared';
import type { Db } from './types.js';

export interface PlanStore {
  save(plan: Plan, onboarding: Onboarding, weekStart: string): Promise<PlanRecord>;
  latest(): Promise<PlanRecord | null>;
  // Every stored plan, oldest week first (one per week).
  list(): Promise<PlanRecord[]>;
  // Removes one plan; true when a row was deleted, false when there was no such plan (one statement, so of two
  // simultaneous deletions of one id exactly one gets true).
  delete(id: number): Promise<boolean>;
}

// The columns of a record. A `date` is selected as text: node-pg would turn it into a Date at local midnight, and
// toISOString() of that moves the day on a server outside UTC (design Decision 3).
const COLUMNS = "id, plan, onboarding, created_at, to_char(week_start, 'YYYY-MM-DD') as week_start";

// Row to the shared contract: bigserial comes back as a string, timestamptz as a Date.
function toRecord(row: Record<string, unknown>): PlanRecord {
  return PlanRecordSchema.parse({
    id: Number(row.id),
    plan: row.plan,
    onboarding: row.onboarding,
    createdAt: (row.created_at as Date).toISOString(),
    weekStart: row.week_start,
  });
}

// One plan per week (migration 003 and the unique index on week_start): `save` is an upsert, so a rebuild keeps the
// row's id, replaces its plan and onboarding and sets created_at to now, in one atomic statement.
// `save` checks the shape with the shared schemas before inserting, so a malformed plan never reaches the table, and
// the week must be a real Monday. The business rules for a plan (seven days, safety, import rules) are validated before
// this, in group 4.
export function createPlanStore(db: Db): PlanStore {
  return {
    async save(plan, onboarding, weekStart) {
      const validPlan = PlanSchema.parse(plan);
      const validOnboarding = OnboardingSchema.parse(onboarding);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isMonday(weekStart)) throw new Error('weekStart must be a Monday as YYYY-MM-DD');
      const { rows } = await db.query(
        `insert into plans(plan, onboarding, week_start) values ($1, $2, $3)
         on conflict (week_start) do update
           set plan = excluded.plan, onboarding = excluded.onboarding, created_at = now()
         returning ${COLUMNS}`,
        [JSON.stringify(validPlan), JSON.stringify(validOnboarding), weekStart],
      );
      return toRecord(rows[0] as Record<string, unknown>);
    },

    async latest() {
      const { rows } = await db.query(`select ${COLUMNS} from plans order by created_at desc, id desc limit 1`);
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async list() {
      const { rows } = await db.query(`select ${COLUMNS} from plans order by week_start asc`);
      return rows.map(toRecord);
    },

    async delete(id) {
      const { rows } = await db.query('delete from plans where id = $1 returning id', [id]);
      return rows.length > 0;
    },
  };
}
