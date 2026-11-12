import type { Onboarding } from 'shared';

// What the coach is told besides the onboarding. `today` is the UTC date (yyyy-mm-dd): the coach needs it to use
// `targetEvent` (specs/plan-generation, target event as context).
export interface CoachContext {
  today: string;
}

// The coach is one replaceable dependency (design.md Decision 3): the real client calls the Anthropic SDK (task 5.3);
// tests use a fake or a spy. It resolves to the raw output, which the endpoint checks against the CoachResponse
// schema, so a wrong-shape response is rejected instead of trusted.
export interface CoachClient {
  generate(onboarding: Onboarding, context: CoachContext): Promise<unknown>;
}

// Thrown by a coach client when the model refuses or stops because it ran out of output space: the endpoint
// treats it as an invalid coach response, not as the coach being unavailable.
export class CoachOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoachOutputError';
  }
}
