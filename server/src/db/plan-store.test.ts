import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanRecordSchema, type Plan } from 'shared';
import { createPlanStore } from './plan-store.js';
import { migratedClient } from '../../test/real-db.js';
import { onboardingFixture, planFixture } from '../../test/fixtures.js';

let db: Awaited<ReturnType<typeof migratedClient>>;
beforeEach(async () => {
  db = await migratedClient();
});
afterEach(() => db.cleanup());

const count = async () => (await db.client.query('select count(*)::int as n from plans')).rows[0]?.n;
// Seeds a row with an exact created_at, for the ordering tests.
const seed = (goal: string, createdAt: string) =>
  db.client.query('insert into plans(plan, onboarding, created_at) values ($1, $2, $3) returning id', [
    JSON.stringify({ ...planFixture, recommendations: [goal] }),
    JSON.stringify(onboardingFixture),
    createdAt,
  ]);

describe('plan store: save', () => {
  it('saves a plan together with its onboarding and returns the record @spec(plan-storage/save-only-valid-plans/valid-plan-is-saved-with-its-onboarding)', async () => {
    const store = createPlanStore(db.client);
    const record = await store.save(planFixture, onboardingFixture);

    expect(PlanRecordSchema.safeParse(record).success).toBe(true);
    expect(record.plan).toEqual(planFixture);
    expect(record.onboarding).toEqual(onboardingFixture);
    expect(Number.isInteger(record.id)).toBe(true);
    expect(Math.abs(Date.now() - Date.parse(record.createdAt))).toBeLessThan(60_000);

    const { rows } = await db.client.query('select plan, onboarding from plans');
    expect(rows).toEqual([{ plan: planFixture, onboarding: onboardingFixture }]);
  });

  it('saves nothing when the plan or the onboarding is not valid @spec(plan-storage/save-only-valid-plans/invalid-plan-is-not-saved)', async () => {
    // Structural validity only: the business rules (seven days and so on) are validateCoachResponse in group 4,
    // and "store empty after any coach failure" is tested through the endpoint in task 5.1.
    const store = createPlanStore(db.client);
    await expect(store.save({ days: 'none' } as unknown as Plan, onboardingFixture)).rejects.toThrow();
    await expect(store.save(planFixture, { goal: 'only a goal' } as never)).rejects.toThrow();
    expect(await count()).toBe(0);
  });
});

describe('plan store: latest', () => {
  it('returns null when no plan has been saved @spec(plan-storage/reload-without-a-coach-call/no-plan-yet)', async () => {
    expect(await createPlanStore(db.client).latest()).toBeNull();
  });

  it('returns the plan with the highest creation time, whatever the insert order @spec(plan-storage/reload-without-a-coach-call/latest-plan-wins)', async () => {
    await seed('middle', '2026-11-08T10:00:00Z');
    await seed('newest', '2026-11-09T10:00:00Z');
    await seed('oldest', '2026-11-07T10:00:00Z');
    const latest = await createPlanStore(db.client).latest();
    expect(latest?.plan.recommendations).toEqual(['newest']);
    expect(latest?.createdAt).toBe('2026-11-09T10:00:00.000Z');
  });

  it('breaks a tie in creation time with the highest id @spec(plan-storage/reload-without-a-coach-call/latest-plan-wins)', async () => {
    const same = '2026-11-08T10:00:00Z';
    await seed('first', same);
    const { rows } = await seed('second', same);
    await seed('earlier', '2026-11-01T10:00:00Z'); // highest id, but older
    const latest = await createPlanStore(db.client).latest();
    expect(latest?.plan.recommendations).toEqual(['second']);
    expect(latest?.id).toBe(Number(rows[0]?.id));
  });

  it('after two saves through the store, returns the second and keeps the first stored', async () => {
    const store = createPlanStore(db.client);
    await store.save({ ...planFixture, recommendations: ['one'] }, onboardingFixture);
    const second = await store.save({ ...planFixture, recommendations: ['two'] }, onboardingFixture);
    expect((await store.latest())?.id).toBe(second.id);
    expect(await count()).toBe(2);
  });
});
