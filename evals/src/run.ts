// The evaluation runner (docs/workflow.md 9.2). Run it on demand, in your own terminal; it is never part of CI.
//
//   npm run evals -w evals                       the six E1 scenarios against the real model, 1 repeat each
//   npm run evals -w evals -- --repeats 3        more repeats (every one is another paid call per case)
//   npm run evals -w evals -- --only pain-mixed  one case
//   npm run evals -w evals -- --coach fake       the rule-based fake coach: free, only to check the runner itself
//   npm run evals -w evals -- --repeats 3 --write-baseline   after a full run you accept, record its pass rates as evals/baseline.json
//                                                (refused with --only, below 3 repeats, with the fake coach, or when the run failed)
//
// The real coach needs ANTHROPIC_API_KEY, from the environment or the repo-root `.env` (git-ignored). The scenarios use
// invented data. The report prints the safety notes the model wrote, so you can judge their wording: the checks are
// code and keyword heuristics, not a judge. Full answers go to evals/results/ (git-ignored). The key is never printed.
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAnthropicClient, createAnthropicCoach } from '../../server/src/coach/anthropic-coach.js';
import { createFakeCoach } from '../../server/src/coach/fake-coach.js';
import type { CoachClient } from '../../server/src/coach/types.js';
import { parseCliArgs } from './cli.js';
import { runEvals } from './runner.js';
import { SCENARIOS } from './scenarios.js';
import { buildBaseline, formatReport, judge, summarize, type Baseline, type Tokens } from './score.js';

// 🔶 USD per million tokens for the default model: an estimate that goes stale. Override with --price-in / --price-out.
const DEFAULT_PRICES = { inputPerMTok: 2, outputPerMTok: 10 };
const DEFAULT_MODEL = 'claude-sonnet-5-5';

const parsed = parseCliArgs(process.argv.slice(2), SCENARIOS.map((c) => c.id));
if (!parsed.ok) {
  console.error(`evals: ${parsed.error}`);
  process.exit(2);
}
const opts = parsed.options;
const model = opts.model ?? process.env.COACH_MODEL ?? DEFAULT_MODEL;
const prices = { inputPerMTok: opts.priceIn ?? DEFAULT_PRICES.inputPerMTok, outputPerMTok: opts.priceOut ?? DEFAULT_PRICES.outputPerMTok };
const cases = opts.only ? SCENARIOS.filter((c) => opts.only!.includes(c.id)) : SCENARIOS;

// Token usage: the real client's parse call is wrapped, so every call's usage is counted without changing the coach.
const used: Tokens = { input: 0, output: 0 };
let coach: CoachClient;
if (opts.coach === 'fake') {
  coach = createFakeCoach();
} else {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('evals: ANTHROPIC_API_KEY is not set. Put it in the repo-root .env or set it in your own terminal, then run again.');
    process.exit(2);
  }
  const client: Anthropic = buildAnthropicClient(apiKey);
  const parse = client.messages.parse.bind(client.messages) as (...a: unknown[]) => Promise<{ usage: { input_tokens: number; output_tokens: number } }>;
  (client.messages as unknown as { parse: typeof parse }).parse = async (...args) => {
    const response = await parse(...args);
    used.input += response.usage.input_tokens;
    used.output += response.usage.output_tokens;
    return response;
  };
  coach = createAnthropicCoach(client, { model });
}

const baselineUrl = new URL('../../../baseline.json', import.meta.url);
const resultsDir = new URL('../../../results/', import.meta.url);
const readBaseline = (): Baseline | null => {
  try {
    const b = JSON.parse(readFileSync(baselineUrl, 'utf8')) as Baseline;
    return b.cases && Object.keys(b.cases).length > 0 ? b : null; // a file with no cases (the old placeholder) counts as no baseline
  } catch {
    return null;
  }
};

const calls = cases.length * opts.repeats;
console.log(`Running ${cases.length} case(s) x ${opts.repeats} repeat(s) = ${calls} call(s) with ${opts.coach === 'fake' ? 'the FAKE coach (free; not the model)' : `${model} (real calls, real cost)`}...`);
const records = await runEvals({
  coach,
  cases,
  repeats: opts.repeats,
  today: new Date().toISOString().slice(0, 10),
  usageProbe: () => ({ ...used }),
  onProgress: (r) => console.log(`  ${r.caseId} #${r.repeat}: ${r.ok ? 'answered' : `no valid answer (${r.error})`} in ${(r.ms / 1000).toFixed(1)} s, ${r.tokens.input} in / ${r.tokens.output} out`),
});

const baseline = readBaseline();
const summary = summarize(records);
const verdict = judge(summary, { repeats: opts.repeats, baseline });
console.log(`\n${formatReport({ summary, verdict, records, repeats: opts.repeats, model: opts.coach === 'fake' ? 'fake coach' : model, baseline, prices })}`);

// The model's own words for the safety notes, so the wording (which keyword checks cannot judge) can be read.
const notes = records.filter((r) => r.response?.plan.safetyNote);
if (notes.length > 0) {
  console.log('\nSafety notes the coach wrote (read them: no diagnosis, not a clinician, a professional, the pasted plan is the athlete\'s own):');
  for (const r of notes) console.log(`  [${r.caseId} #${r.repeat}] ${r.response!.plan.safetyNote}`);
}

mkdirSync(resultsDir, { recursive: true });
const file = new URL(`${new Date().toISOString().replace(/[:.]/g, '-')}.json`, resultsDir);
writeFileSync(file, JSON.stringify({ model, coach: opts.coach, repeats: opts.repeats, prices, records, verdict }, null, 2));
console.log(`\nFull answers saved to ${fileURLToPath(file)} (git-ignored).`);

if (opts.writeBaseline) {
  if (!verdict.pass) console.log('Baseline NOT written: this run failed, and a baseline must be a run you accept.');
  else {
    writeFileSync(baselineUrl, `${JSON.stringify(buildBaseline(summary, { model, repeats: opts.repeats }), null, 2)}\n`);
    console.log('Baseline written to evals/baseline.json: commit it with the PR.');
  }
}
process.exit(verdict.pass ? 0 : 1);
