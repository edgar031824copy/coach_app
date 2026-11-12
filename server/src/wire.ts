import type { AppDeps } from './app.js';
import type { CoachClient } from './coach/types.js';
import type { Config } from './config.js';
import { createCallCounter } from './db/cap.js';
import { createPlanStore } from './db/plan-store.js';
import type { Db } from './db/types.js';

// The coach (the configured mode will pick the real or the fake one). Until the real client (task 5.3) and the fake coach (task 7.1) exist, every call
// fails, so the endpoint answers "unavailable" (and the call still counts toward the cap).
function buildCoach(): CoachClient {
  return {
    async generate() {
      throw new Error('no coach is implemented yet (tasks 5.3 and 7.1)');
    },
  };
}

// Configuration + a database connection -> the app's dependencies (what index.ts uses).
export function buildDeps(config: Config, db: Db, now?: () => Date): AppDeps {
  const counter = createCallCounter(db, { limit: config.callLimit, now });
  return {
    coach: buildCoach(),
    reserveCall: counter.reserveCall,
    callLimit: config.callLimit,
    store: createPlanStore(db),
    clientOrigin: config.clientOrigin,
    now,
  };
}
