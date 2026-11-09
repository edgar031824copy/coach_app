import type { CoachResponse, Onboarding } from 'shared';

// The coach is one replaceable dependency (design.md Decision 3): the real client calls the
// Anthropic SDK (task 5.3); tests use a fake or a spy.
export interface CoachClient {
  generate(onboarding: Onboarding): Promise<CoachResponse>;
}
