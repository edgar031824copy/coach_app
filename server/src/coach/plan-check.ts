// MANUAL CHECK for task 7.3 (not a test, never imported by the server). It sends ONE real request to the Anthropic API
// (a few thousand tokens, about a cent) with YOUR running plan from a text file, and prints what the coach read for the
// week you chose and how it placed those sessions, so you can compare them with your own plan. It is the only guard
// against a misread paste (risk R9).
//
//   npm run plan-check -w server -- --file /full/path/to/my-plan.txt --week 3 [--crossfit tue,thu|none]
//
// The key is read from the environment or the repo-root `.env`. Run it in your own terminal. Your plan's text is read from
// the file on your machine and is not printed: the report shows only what the coach wrote (the sessions it read and its
// own text), and you decide what to paste back. A relative path is taken from the folder you ran npm in.
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CoachResponseSchema, validateOnboarding } from 'shared';
import { buildAnthropicClient, createAnthropicCoach } from './anthropic-coach.js';
import { formatPlanCheckReport, parsePlanCheckArgs } from './plan-check-lib.js';
import { CoachOutputError } from './types.js';
import { validateCoachResponse } from '../validation/coach-response.js';

const parsed = parsePlanCheckArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`plan-check: ${parsed.error}`);
  process.exit(2);
}
const { file, week, crossfitDays } = parsed.options;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('plan-check: ANTHROPIC_API_KEY is not set. Put it in the repo-root .env or set it in your own terminal, then run again.');
  process.exit(2);
}

let plan: string;
try {
  plan = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), file), 'utf8');
} catch {
  console.error('plan-check: could not read that file. Check the path (use the full path, or one relative to where you ran npm).');
  process.exit(2);
}

// The same rules the app applies to a submitted onboarding, so a plan the app would refuse is refused here too.
const checked = validateOnboarding({
  goal: 'Follow my running plan',
  runningLevel: 'intermediate',
  crossfitLevel: 'intermediate',
  injuries: '',
  runningDays: [],
  crossfitDays,
  existingRunningPlan: plan,
  pastedPlanWeek: week,
});
if (!checked.ok) {
  console.error(`plan-check: the app would not accept this onboarding: ${Object.values(checked.fields).join(' ')}`);
  process.exit(2);
}
const onboarding = checked.value;

const model = process.env.COACH_MODEL ?? 'claude-sonnet-5-5';
const coach = createAnthropicCoach(buildAnthropicClient(apiKey), { model });
const started = Date.now();
console.log(`Calling ${model} once with week ${week} of your plan (real call, about a cent)...`);

try {
  const raw = await coach.generate(onboarding, { today: new Date().toISOString().slice(0, 10) });
  const response = CoachResponseSchema.safeParse(raw);
  if (!response.success) {
    console.log('FAIL: the answer does not match the expected shape.');
    process.exit(1);
  }
  const violations = validateCoachResponse(onboarding, response.data);
  console.log(`\n${formatPlanCheckReport({ onboarding, response: response.data, violations, seconds: (Date.now() - started) / 1000 })}`);
  process.exit(violations.length === 0 ? 0 : 1);
} catch (err) {
  if (err instanceof CoachOutputError) console.log(`FAIL: invalid coach response (${err.message}).`);
  else if (err instanceof Anthropic.APIError) console.log(`FAIL: API error ${err.status ?? ''} ${err.name}`);
  else console.log(`FAIL: ${(err as Error)?.name ?? 'Error'}`); // name only: some messages embed the model's output
  process.exit(1);
}
