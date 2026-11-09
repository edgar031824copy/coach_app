import { OnboardingSchema, PlanRecordSchema, PlanSchema, type Onboarding, type Plan, type PlanRecord } from 'shared';
import type { Db } from './types.js';

export interface PlanStore {
  save(plan: Plan, onboarding: Onboarding): Promise<PlanRecord>;
  latest(): Promise<PlanRecord | null>;
}

// Row to the shared contract: bigserial comes back as a string, timestamptz as a Date.
function toRecord(row: Record<string, unknown>): PlanRecord {
  return PlanRecordSchema.parse({
    id: Number(row.id),
    plan: row.plan,
    onboarding: row.onboarding,
    createdAt: (row.created_at as Date).toISOString(),
  });
}

// Earlier plans stay stored; only the latest is shown (specs/plan-storage).
// `save` checks the shape with the shared schemas before inserting, so a malformed plan never reaches the table.
// The business rules for a plan (seven days, safety, import rules) are validated before this, in group 4.
export function createPlanStore(db: Db): PlanStore {
  return {
    async save(plan, onboarding) {
      const validPlan = PlanSchema.parse(plan);
      const validOnboarding = OnboardingSchema.parse(onboarding);
      const { rows } = await db.query(
        'insert into plans(plan, onboarding) values ($1, $2) returning id, plan, onboarding, created_at',
        [JSON.stringify(validPlan), JSON.stringify(validOnboarding)],
      );
      return toRecord(rows[0] as Record<string, unknown>);
    },

    async latest() {
      const { rows } = await db.query(
        'select id, plan, onboarding, created_at from plans order by created_at desc, id desc limit 1',
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },
  };
}
