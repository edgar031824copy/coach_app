import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { CoachResponseSchema } from 'shared';
import { logUsage } from '../log.js';
import { buildSystemPrompt, buildUserMessage } from './prompt.js';
import { CoachOutputError, type CoachClient } from './types.js';

// design.md Decision 3. Values marked 🔶 are proposals, tuned by the evals and the first real runs.
const MAX_TOKENS = 8000; // 🔶
const TIMEOUT_MS = 30_000; // 🔶 the endpoint also enforces this deadline itself

// One call counts toward the daily cap, so the SDK never retries on its own: the athlete decides whether to retry.
export function buildAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 0, timeout: TIMEOUT_MS });
}

// The real coach: structured output (the schema comes from the shared Zod schema), effort set explicitly to medium for
// cost 🔶, no tools, no sampling parameters, no fallbacks. A refusal, a cut-off answer or unparsable output is an
// invalid response (CoachOutputError); network and API errors pass through, so the endpoint reports the coach as
// unavailable. Token counts are logged, never content.
export function createAnthropicCoach(client: Anthropic, options: { model: string }): CoachClient {
  return {
    async generate(onboarding, context) {
      let response;
      try {
        response = await client.messages.parse({
          model: options.model,
          max_tokens: MAX_TOKENS,
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: buildUserMessage(onboarding, context) }],
          output_config: { effort: 'medium', format: zodOutputFormat(CoachResponseSchema) },
        });
      } catch (err) {
        // A failure to parse the model's JSON is a bad answer, not a coach outage.
        if (err instanceof SyntaxError || (err as Error)?.name === 'ZodError') {
          throw new CoachOutputError('the answer could not be parsed');
        }
        throw err;
      }

      logUsage(response.usage);
      if (response.stop_reason === 'refusal') throw new CoachOutputError('the model refused');
      if (response.stop_reason === 'max_tokens') throw new CoachOutputError('the answer was cut off');
      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new CoachOutputError('the answer did not match the expected shape');
      }
      return response.parsed_output;
    },
  };
}
