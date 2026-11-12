import type { AppDeps } from './app.js';
import { buildAnthropicClient, createAnthropicCoach } from './coach/anthropic-coach.js';
import type { CoachClient } from './coach/types.js';
import type { Config } from './config.js';
import { createCallCounter } from './db/cap.js';
import { createPlanStore } from './db/plan-store.js';
import type { Db } from './db/types.js';

// The coach for the configured mode. Real mode calls the Anthropic API (task 5.3). The fake coach for tests is
// task 7.1; until then fake mode has a placeholder that fails every call, so the endpoint answers "unavailable"
// (and the call still counts toward the cap).
function buildCoach(config: Config): CoachClient {
  if (config.coachMode === 'real') {
    return createAnthropicCoach(buildAnthropicClient(config.anthropicApiKey as string), { model: config.coachModel });
  }
  return {
    async generate() {
      throw new Error('the fake coach is not implemented yet (task 7.1)');
    },
  };
}

// Configuration + a database connection -> the app's dependencies (what index.ts uses).
export function buildDeps(config: Config, db: Db, now?: () => Date): AppDeps {
  const counter = createCallCounter(db, { limit: config.callLimit, now });
  return {
    coach: buildCoach(config),
    reserveCall: counter.reserveCall,
    callLimit: config.callLimit,
    store: createPlanStore(db),
    clientOrigin: config.clientOrigin,
    now,
  };
}
