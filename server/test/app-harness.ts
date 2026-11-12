import request from 'supertest';
import { createApp } from '../src/app.js';
import type { CoachClient } from '../src/coach/types.js';
import { createCallCounter } from '../src/db/cap.js';
import { createPlanStore, type PlanStore } from '../src/db/plan-store.js';
import { migratedClient } from './real-db.js';

export const NOW = new Date('2026-11-10T12:00:00Z');

// The real app wired to real Postgres (a throwaway schema), the real cap counter and the real store, with a fake coach
// and a fixed clock. Tests look at the tables directly to prove what was and was not saved or counted.
export async function appHarness(options: {
  coach: CoachClient;
  limit?: number;
  now?: () => Date;
  coachTimeoutMs?: number;
  store?: PlanStore;
  reserveCall?: () => Promise<number | null>;
}) {
  const db = await migratedClient();
  const limit = options.limit ?? 20;
  const now = options.now ?? (() => NOW);
  const counter = createCallCounter(db.client, { limit, now });
  const app = createApp({
    coach: options.coach,
    reserveCall: options.reserveCall ?? counter.reserveCall,
    callLimit: limit,
    store: options.store ?? createPlanStore(db.client),
    now,
    coachTimeoutMs: options.coachTimeoutMs,
  });
  return {
    app,
    post: (body: unknown) => request(app).post('/api/plan').send(body as object),
    get: () => request(app).get('/api/plan'),
    plans: async () => (await db.client.query('select count(*)::int as n from plans')).rows[0]?.n as number,
    latestId: async () => Number((await db.client.query('select id from plans order by created_at desc, id desc limit 1')).rows[0]?.id),
    calls: async () => ((await db.client.query('select calls from coach_call_counts')).rows[0]?.calls ?? 0) as number,
    cleanup: db.cleanup,
  };
}
