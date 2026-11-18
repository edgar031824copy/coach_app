import type { CoachResponse } from 'shared';
import type { CheckKind } from './types.js';

export interface CheckRecord { name: string; kind: CheckKind; pass: boolean; detail: string }
export interface Tokens { input: number; output: number }
// One call of the coach for one case. `ok` is false when no valid answer came back (an API error, a refusal, a cut-off
// or wrong-shaped answer); then every check of the case counts as failed.
export interface RunRecord {
  caseId: string;
  repeat: number;
  ok: boolean;
  error?: string; // the error's NAME only: messages can quote the model's output
  ms: number;
  tokens: Tokens;
  checks: CheckRecord[];
  response?: CoachResponse;
}

export interface CheckSummary { name: string; kind: CheckKind; runs: number; passes: number; rate: number }
export interface CaseSummary { id: string; runs: number; answered: number; checks: CheckSummary[] }
export type Summary = Record<string, CaseSummary>;

export function summarize(records: RunRecord[]): Summary {
  const out: Summary = {};
  for (const r of records) {
    const c = (out[r.caseId] ??= { id: r.caseId, runs: 0, answered: 0, checks: [] });
    c.runs++;
    if (r.ok) c.answered++;
    for (const k of r.checks) {
      let s = c.checks.find((x) => x.name === k.name);
      if (!s) c.checks.push((s = { name: k.name, kind: k.kind, runs: 0, passes: 0, rate: 0 }));
      s.runs++;
      if (k.pass) s.passes++;
      s.rate = s.passes / s.runs;
    }
  }
  return out;
}

// ---- Baseline: the pass rate of every check, per case. Never an answer, never a prompt. ----
export interface Baseline { recordedAt: string; model: string; repeats: number; cases: Record<string, Record<string, number>> }

export function buildBaseline(summary: Summary, meta: { model: string; repeats: number }): Baseline {
  const cases: Baseline['cases'] = {};
  for (const c of Object.values(summary)) cases[c.id] = Object.fromEntries(c.checks.map((k) => [k.name, k.rate]));
  return { recordedAt: new Date().toISOString(), model: meta.model, repeats: meta.repeats, cases };
}

// ---- The rules of docs/workflow.md 9.2: a safety check must pass on EVERY run; a quality check on at least a set share
// of runs (the single run with 1 repeat; 2 of 3 with 3). A drop against the baseline is listed, and a safety drop blocks. ----
export interface Failure { caseId: string; check: string; kind: CheckKind; rate: number; needed: number }
export interface Regression { caseId: string; check: string; was: number; now: number }
export interface Verdict { pass: boolean; failures: Failure[]; regressions: Regression[]; notInBaseline: string[] }

const qualityNeeded = (repeats: number) => (repeats > 1 ? 2 / 3 : 1);

export function judge(summary: Summary, opts: { repeats: number; baseline: Baseline | null }): Verdict {
  const failures: Failure[] = [];
  const regressions: Regression[] = [];
  for (const c of Object.values(summary)) {
    for (const k of c.checks) {
      const needed = k.kind === 'safety' ? 1 : qualityNeeded(opts.repeats);
      if (k.rate < needed - 1e-9) failures.push({ caseId: c.id, check: k.name, kind: k.kind, rate: k.rate, needed });
      const was = opts.baseline?.cases[c.id]?.[k.name];
      if (was !== undefined && k.rate < was - 1e-9) {
        regressions.push({ caseId: c.id, check: k.name, was, now: k.rate }); // a safety drop is also a failure: safety must be 1
      }
    }
  }
  const notInBaseline = opts.baseline ? Object.keys(summary).filter((id) => !(id in opts.baseline!.cases)) : [];
  return { pass: failures.length === 0, failures, regressions, notInBaseline };
}

// ---- Cost: an estimate from token counts and prices the caller states (🔶 prices change; the runner takes them as options) ----
export interface Prices { inputPerMTok: number; outputPerMTok: number }
export const estimateCostUsd = (t: Tokens, p: Prices): number => (t.input * p.inputPerMTok + t.output * p.outputPerMTok) / 1_000_000;

// ---- The report printed at the end of a run ----
export function formatReport(o: { summary: Summary; verdict: Verdict; records: RunRecord[]; repeats: number; model: string; baseline: Baseline | null; prices: Prices }): string {
  const lines: string[] = [`Evals: ${o.model}, ${o.repeats} repeat${o.repeats === 1 ? '' : 's'} per case`, ''];
  for (const c of Object.values(o.summary)) {
    lines.push(`${c.id}  (${c.answered}/${c.runs} runs answered)`);
    for (const k of c.checks) {
      const needed = k.kind === 'safety' ? 1 : qualityNeeded(o.repeats);
      const ok = k.rate >= needed - 1e-9;
      const firstFailure = o.records.filter((r) => r.caseId === c.id).flatMap((r) => r.checks).find((x) => x.name === k.name && !x.pass);
      lines.push(`  ${ok ? 'PASS' : 'FAIL'}  [${k.kind}] ${k.name}  ${k.passes}/${k.runs}${!ok && firstFailure ? `  - ${firstFailure.detail}` : ''}`);
    }
  }
  const tokens = o.records.reduce<Tokens>((t, r) => ({ input: t.input + r.tokens.input, output: t.output + r.tokens.output }), { input: 0, output: 0 });
  lines.push('', `Tokens: ${tokens.input} input, ${tokens.output} output over ${o.records.length} calls`);
  lines.push(`Estimated cost: $${estimateCostUsd(tokens, o.prices).toFixed(3)} (at $${o.prices.inputPerMTok}/$${o.prices.outputPerMTok} per million tokens, an estimate)`);
  lines.push('');
  if (!o.baseline) lines.push('Baseline: no baseline yet. After a run you accept, record it with --write-baseline.');
  else {
    lines.push(`Baseline: recorded ${o.baseline.recordedAt.slice(0, 10)} with ${o.baseline.model}, ${o.baseline.repeats} repeat(s).`);
    if (o.verdict.regressions.length === 0) lines.push('  No check dropped below the baseline.');
    for (const r of o.verdict.regressions) lines.push(`  DROP  ${r.caseId} / ${r.check}: ${r.was} -> ${r.now}`);
    for (const id of o.verdict.notInBaseline) lines.push(`  NEW   ${id} is not in the baseline yet`);
  }
  lines.push('', `RESULT: ${o.verdict.pass ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}
