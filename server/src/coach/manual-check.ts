// MANUAL CHECK for task 5.3 (not a test, never imported by the server). It makes ONE real call to the Anthropic API,
// which spends real money (a few thousand tokens), to show that the model id and structured output work and that the
// answer passes our own validators. It prints a verdict, token counts and rule ids: never the key, never the prompt.
//
//   npm run manual-check -w server        (no period at the end)
//
// The key is read from the environment, or from the repo-root `.env` file (git-ignored; see `.env.example`), which
// this script loads only into its own process. Optional: COACH_MODEL=... Only ANTHROPIC_API_KEY is needed; the
// database URL in that file is not used. Run it in your own terminal so the key never enters a chat or a log, and
// paste only its output back.
import Anthropic from '@anthropic-ai/sdk';
import { OnboardingSchema } from 'shared';
import { buildAnthropicClient, createAnthropicCoach } from './anthropic-coach.js';
import { CoachOutputError } from './types.js';
import { validateCoachResponse } from '../validation/coach-response.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Set it in your own terminal, then run this again.');
  process.exit(2);
}
const model = process.env.COACH_MODEL ?? 'claude-sonnet-5-5';

// A small invented onboarding with a two-week pasted plan (week 2 is chosen), including a flexible-day row.
const onboarding = OnboardingSchema.parse({
  goal: 'Run a half marathon in March',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: [],
  crossfitDays: ['tue', 'thu'],
  existingRunningPlan:
    'Week 1: Mon 5 km easy; Wed 8 km tempo; Fri/Sat/Sun 14 km long run\nWeek 2: Mon 6 km easy; Wed 8 km tempo; Fri/Sat/Sun 16 km long run',
  pastedPlanWeek: 2,
});

const today = new Date().toISOString().slice(0, 10);
const coach = createAnthropicCoach(buildAnthropicClient(apiKey), { model });
const started = Date.now();
console.log(`Calling ${model} once (real call, real cost)...`);

try {
  const raw = await coach.generate(onboarding, { today });
  console.log(`Answered in ${((Date.now() - started) / 1000).toFixed(1)} s. Structured output worked: the answer parsed against the schema.`);
  // Re-check with the same validators the endpoint uses.
  const { CoachResponseSchema } = await import('shared');
  const parsed = CoachResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.log('FAIL: the answer does not match the CoachResponse shape.');
    process.exit(1);
  }
  const violations = validateCoachResponse(onboarding, parsed.data);
  const sessions = parsed.data.plan.days.map((d) => `${d.day}:${d.sessions.length}`).join(' ');
  console.log(`Sessions per day: ${sessions}`);
  console.log(`understoodRunning entries: ${parsed.data.understoodRunning.length} (expected 3 for week 2)`);
  console.log(`Flexible long run day options: ${JSON.stringify(parsed.data.understoodRunning.find((u) => u.dayOptions.length > 1)?.dayOptions ?? null)}`);
  console.log(`painReported: ${parsed.data.painReported}, safetyNote: ${parsed.data.plan.safetyNote === null ? 'null' : 'present'}`);
  if (violations.length === 0) console.log('PASS: the answer passes every validation rule.');
  else {
    console.log(`FAIL: ${violations.length} rule violation(s): ${violations.map((v) => v.rule).join(', ')}`);
    process.exit(1);
  }
} catch (err) {
  if (err instanceof CoachOutputError) console.log(`FAIL: invalid coach response (${err.message}).`);
  else if (err instanceof Anthropic.APIError) console.log(`FAIL: API error ${err.status ?? ''} ${err.name}: ${err.message}`);
  else console.log(`FAIL: ${(err as Error)?.name ?? 'Error'}`); // name only: some messages embed the model's output
  process.exit(1);
}
