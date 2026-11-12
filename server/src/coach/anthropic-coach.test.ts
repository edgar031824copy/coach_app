import { describe, it, expect, afterEach, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { buildAnthropicClient, createAnthropicCoach } from './anthropic-coach.js';
import { CoachOutputError } from './types.js';
import { buildSystemPrompt } from './prompt.js';
import { onboardingWith, PASTE, responseWith, session } from '../../test/fixtures.js';

// A stand-in for the SDK: records what the coach sends, and answers with whatever the test gives it.
// No test here makes a real call (the one real check is the manual check recorded in the PR).
type Answer = { parsed_output: unknown; stop_reason: string | null; usage: Record<string, number | null> };
const ok = (parsed: unknown): Answer => ({
  parsed_output: parsed,
  stop_reason: 'end_turn',
  usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
});
const fakeSdk = (answer: () => Answer | Promise<Answer>) => {
  const requests: Record<string, unknown>[] = [];
  const client = {
    messages: {
      async parse(params: Record<string, unknown>) {
        requests.push(params);
        return answer();
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
};
const good = () => responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] });
const TODAY = { today: '2026-11-12' };

afterEach(() => vi.restoreAllMocks());

describe('the request', () => {
  it('has the shape the design asks for: model, max tokens, effort, structured output, no tools or sampling', async () => {
    const { client, requests } = fakeSdk(() => ok(good()));
    const coach = createAnthropicCoach(client, { model: 'claude-sonnet-5-5' });
    await coach.generate(onboardingWith(), TODAY);

    const request = requests[0]!;
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.max_tokens).toBe(8000);
    expect(request.system).toBe(buildSystemPrompt());
    expect((request.output_config as { effort: string }).effort).toBe('medium');
    expect((request.output_config as { format: { type: string } }).format.type).toBe('json_schema');
    for (const forbidden of ['tools', 'tool_choice', 'temperature', 'top_p', 'top_k', 'thinking', 'fallbacks', 'betas']) {
      expect(request).not.toHaveProperty(forbidden);
    }
    expect(request.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
  });

  it('uses the configured model id', async () => {
    const { client, requests } = fakeSdk(() => ok(good()));
    await createAnthropicCoach(client, { model: 'some-other-model' }).generate(onboardingWith(), TODAY);
    expect(requests[0]?.model).toBe('some-other-model');
  });

  it('sends the paste inside the delimiters and the date and event in the message @spec(running-plan-import/pasted-text-is-untrusted-data/instruction-inside-the-paste)', async () => {
    const { client, requests } = fakeSdk(() => ok(good()));
    const onboarding = onboardingWith({
      existingRunningPlan: PASTE, pastedPlanWeek: 2, targetEvent: { name: 'City Half', date: '2026-12-06' },
    });
    await createAnthropicCoach(client, { model: 'm' }).generate(onboarding, TODAY);
    const content = (requests[0]?.messages as { content: string }[])[0]!.content;
    expect(content).toContain('2026-11-12');
    expect(content).toContain('City Half');
    expect(content).toContain('<pasted_plan week="2">');
    expect(content.indexOf(PASTE)).toBeGreaterThan(content.indexOf('<pasted_plan week="2">'));
    expect(content.indexOf(PASTE)).toBeLessThan(content.indexOf('</pasted_plan>'));
  });
});

describe('the SDK client', () => {
  it('never retries and times out after 30 seconds, so every call counts once and fails fast @spec(plan-generation/distinct-failure-outcomes/coach-timeout)', () => {
    const client = buildAnthropicClient('sk-ant-not-a-real-key');
    expect(client.maxRetries).toBe(0);
    expect(client.timeout).toBe(30_000);
  });
});

describe('the answer', () => {
  it('returns the parsed output for the endpoint to validate', async () => {
    const response = good();
    const { client } = fakeSdk(() => ok(response));
    expect(await createAnthropicCoach(client, { model: 'm' }).generate(onboardingWith(), TODAY)).toEqual(response);
  });

  it.each([
    // The stop reason alone must reject: these answers still carry a parsed-looking plan, which must not be trusted.
    ['a refusal', { ...ok(good()), stop_reason: 'refusal' }],
    ['running out of output space', { ...ok(good()), stop_reason: 'max_tokens' }],
    ['output that could not be parsed', ok(null)],
  ])('reports %s as an invalid coach response, not as the coach being unavailable', async (_name, answer) => {
    const { client } = fakeSdk(() => answer);
    await expect(createAnthropicCoach(client, { model: 'm' }).generate(onboardingWith(), TODAY)).rejects.toBeInstanceOf(CoachOutputError);
  });

  it('reports a parse failure thrown by the SDK as an invalid coach response', async () => {
    const { client } = fakeSdk(() => {
      throw new SyntaxError('Unexpected end of JSON input');
    });
    await expect(createAnthropicCoach(client, { model: 'm' }).generate(onboardingWith(), TODAY)).rejects.toBeInstanceOf(CoachOutputError);
  });

  it('lets network and API errors through unchanged, so the endpoint reports the coach as unavailable', async () => {
    const boom = new Error('connect ETIMEDOUT');
    const { client } = fakeSdk(() => {
      throw boom;
    });
    await expect(createAnthropicCoach(client, { model: 'm' }).generate(onboardingWith(), TODAY)).rejects.toBe(boom);
  });
});

describe('usage logging', () => {
  it('logs token counts only, never the prompt or the answer', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void lines.push(args.join(' ')));
    const { client } = fakeSdk(() => ok(good()));
    await createAnthropicCoach(client, { model: 'm' }).generate(
      onboardingWith({ injuries: 'SECRET-INJURY', existingRunningPlan: 'SECRET-PASTE', pastedPlanWeek: 1 }), TODAY,
    );
    const logged = lines.join('\n');
    expect(logged).toMatch(/input_tokens=1200/);
    expect(logged).toMatch(/output_tokens=800/);
    expect(logged).not.toMatch(/SECRET|session|Run a half/);
  });
});
