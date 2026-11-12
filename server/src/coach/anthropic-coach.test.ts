import { describe, it, expect, afterEach, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
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

  it('reports the SDK\'s parse failure (its own AnthropicError) as an invalid coach response', async () => {
    const { client } = fakeSdk(() => {
      throw new Anthropic.AnthropicError('Failed to parse structured output: SyntaxError: Unexpected end of JSON input');
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

// The real SDK code (parsing, structured output, error classes) with only the network faked. This is what the
// plain fake above cannot show: the SDK wraps every parse failure in its own AnthropicError, including a cut-off answer.
describe('with the real SDK and a fake network', () => {
  const messageBody = (text: string | null, stop_reason: string) => ({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
    content: text === null ? [] : [{ type: 'text', text }],
    stop_reason, stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  });
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const coachOver = (fetchImpl: (url: unknown, init?: RequestInit) => Promise<Response>, timeoutMs?: number) => {
    const calls: number[] = [];
    const client = buildAnthropicClient('sk-ant-not-a-real-key', {
      fetch: ((url: unknown, init?: RequestInit) => {
        calls.push(1);
        return fetchImpl(url, init);
      }) as typeof fetch,
      timeoutMs,
    });
    return { coach: createAnthropicCoach(client, { model: 'claude-sonnet-5-5' }), calls };
  };
  const generate = (coach: ReturnType<typeof createAnthropicCoach>) => coach.generate(onboardingWith(), TODAY);

  it('returns a well-formed answer', async () => {
    const response = good();
    const { coach } = coachOver(async () => jsonResponse(messageBody(JSON.stringify(response), 'end_turn')));
    expect(await generate(coach)).toEqual(response);
  });

  it('treats a cut-off answer (max_tokens, truncated JSON) as an invalid coach response @spec(plan-generation/distinct-failure-outcomes/malformed-coach-output)', async () => {
    const cutOff = JSON.stringify(good()).slice(0, 120);
    const { coach } = coachOver(async () => jsonResponse(messageBody(cutOff, 'max_tokens')));
    await expect(generate(coach)).rejects.toBeInstanceOf(CoachOutputError);
  });

  it.each([
    ['JSON of the wrong shape', '{"plan":"nonsense"}', 'end_turn'],
    ['text that is not JSON', 'I cannot help with that.', 'end_turn'],
    ['an empty answer', '', 'end_turn'],
  ])('treats %s as an invalid coach response @spec(plan-generation/distinct-failure-outcomes/malformed-coach-output)', async (_name, text, stop) => {
    const { coach } = coachOver(async () => jsonResponse(messageBody(text, stop)));
    await expect(generate(coach)).rejects.toBeInstanceOf(CoachOutputError);
  });

  it('treats a refusal as an invalid coach response @spec(plan-generation/distinct-failure-outcomes/malformed-coach-output)', async () => {
    const { coach } = coachOver(async () => jsonResponse(messageBody(null, 'refusal')));
    await expect(generate(coach)).rejects.toBeInstanceOf(CoachOutputError);
  });

  it('never puts the model\'s output into the error it raises', async () => {
    const { coach } = coachOver(async () => jsonResponse(messageBody('SECRET-MODEL-OUTPUT {', 'max_tokens')));
    await expect(generate(coach)).rejects.toSatisfy((err: Error) => err instanceof CoachOutputError && !err.message.includes('SECRET-MODEL-OUTPUT'));
  });

  it.each([[500], [401], [429], [529]])('lets an HTTP %i error through as an API error, with exactly one attempt (no SDK retry)', async (status) => {
    const { coach, calls } = coachOver(async () =>
      jsonResponse({ type: 'error', error: { type: 'api_error', message: 'upstream problem' } }, status));
    const error = await generate(coach).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(error).not.toBeInstanceOf(CoachOutputError);
    expect(calls).toHaveLength(1);
  });

  it('lets a connection failure through as unavailable, not as an invalid response', async () => {
    const { coach } = coachOver(async () => {
      throw new TypeError('fetch failed');
    });
    const error = await generate(coach).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Anthropic.APIConnectionError);
    expect(error).not.toBeInstanceOf(CoachOutputError);
  });

  it('lets a timeout through as unavailable @spec(plan-generation/distinct-failure-outcomes/coach-timeout)', async () => {
    const { coach, calls } = coachOver(
      (_url, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))),
        ),
      50,
    );
    const error = await generate(coach).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Anthropic.APIConnectionTimeoutError);
    expect(calls).toHaveLength(1);
  });
});
