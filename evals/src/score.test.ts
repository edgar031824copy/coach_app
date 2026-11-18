import { describe, it, expect } from 'vitest';
import { buildBaseline, estimateCostUsd, formatReport, judge, summarize, type RunRecord } from './score.js';

const rec = (caseId: string, repeat: number, checks: Record<string, [kind: 'safety' | 'quality', pass: boolean]>, over: Partial<RunRecord> = {}): RunRecord => ({
  caseId, repeat, ok: true, ms: 1000, tokens: { input: 2500, output: 600 },
  checks: Object.entries(checks).map(([name, [kind, pass]]) => ({ name, kind, pass, detail: pass ? 'ok' : 'broken' })),
  ...over,
});

describe('summarize', () => {
  it('computes the pass rate of each check of each case', () => {
    const s = summarize([
      rec('a', 1, { x: ['safety', true], y: ['quality', true] }),
      rec('a', 2, { x: ['safety', true], y: ['quality', false] }),
      rec('b', 1, { z: ['quality', false] }),
    ]);
    expect(s.a!.checks.find((c) => c.name === 'x')).toMatchObject({ runs: 2, passes: 2, rate: 1, kind: 'safety' });
    expect(s.a!.checks.find((c) => c.name === 'y')).toMatchObject({ runs: 2, passes: 1, rate: 0.5, kind: 'quality' });
    expect(s.b!.checks[0]).toMatchObject({ runs: 1, passes: 0, rate: 0 });
  });
  it('counts runs that got no valid answer', () => {
    const s = summarize([rec('a', 1, { x: ['safety', false] }, { ok: false, error: 'APIConnectionError' }), rec('a', 2, { x: ['safety', true] })]);
    expect(s.a).toMatchObject({ runs: 2, answered: 1 });
  });
});

describe('judge (the rules of docs/workflow.md 9.2)', () => {
  const summary = (...runs: RunRecord[]) => summarize(runs);
  it('passes when every safety check passed on every run and every quality check meets the threshold', () => {
    const v = judge(summary(rec('a', 1, { s: ['safety', true], q: ['quality', true] })), { repeats: 1, baseline: null });
    expect(v.pass).toBe(true);
    expect(v.failures).toEqual([]);
  });
  it('fails on a single safety failure, even if the other runs passed', () => {
    const v = judge(summary(rec('a', 1, { s: ['safety', true] }), rec('a', 2, { s: ['safety', false] }), rec('a', 3, { s: ['safety', true] })), { repeats: 3, baseline: null });
    expect(v.pass).toBe(false);
    expect(v.failures[0]).toMatchObject({ caseId: 'a', check: 's', kind: 'safety' });
  });
  it('needs the single run to pass a quality check with 1 repeat', () => {
    expect(judge(summary(rec('a', 1, { q: ['quality', false] })), { repeats: 1, baseline: null }).pass).toBe(false);
  });
  it('accepts 2 of 3 on a quality check with 3 repeats, and not 1 of 3', () => {
    const two = [1, 2, 3].map((n) => rec('a', n, { q: ['quality', n !== 3] }));
    const one = [1, 2, 3].map((n) => rec('a', n, { q: ['quality', n === 1] }));
    expect(judge(summary(...two), { repeats: 3, baseline: null }).pass).toBe(true);
    expect(judge(summary(...one), { repeats: 3, baseline: null }).pass).toBe(false);
  });
  it('lists a drop against the baseline, and blocks on a safety drop', () => {
    const base = buildBaseline(summary(rec('a', 1, { s: ['safety', true], q: ['quality', true] })), { model: 'm', repeats: 1 });
    const now = summary(rec('a', 1, { s: ['safety', false], q: ['quality', true] }));
    const v = judge(now, { repeats: 1, baseline: base });
    expect(v.regressions).toEqual([{ caseId: 'a', check: 's', was: 1, now: 0 }]);
    expect(v.pass).toBe(false);
  });
  it('reports a case or check that is new (not in the baseline) without calling it a regression', () => {
    const base = buildBaseline(summary(rec('a', 1, { s: ['safety', true] })), { model: 'm', repeats: 1 });
    const v = judge(summary(rec('a', 1, { s: ['safety', true] }), rec('b', 1, { t: ['safety', true] })), { repeats: 1, baseline: base });
    expect(v.regressions).toEqual([]);
    expect(v.notInBaseline).toEqual(['b']);
    expect(v.pass).toBe(true);
  });
});

describe('buildBaseline', () => {
  it('stores the pass rate of every check with the model and repeats used, and no answers', () => {
    const b = buildBaseline(summarize([rec('a', 1, { s: ['safety', true], q: ['quality', false] })]), { model: 'claude-x', repeats: 1 });
    expect(b).toMatchObject({ model: 'claude-x', repeats: 1, cases: { a: { s: 1, q: 0 } } });
    expect(typeof b.recordedAt).toBe('string');
    expect(JSON.stringify(b)).not.toMatch(/detail|description|safetyNote/);
  });
});

describe('estimateCostUsd', () => {
  it('multiplies the tokens by the price per million, which the caller states', () => {
    expect(estimateCostUsd({ input: 1_000_000, output: 500_000 }, { inputPerMTok: 2, outputPerMTok: 10 })).toBeCloseTo(7, 6);
    expect(estimateCostUsd({ input: 2590, output: 619 }, { inputPerMTok: 2, outputPerMTok: 10 })).toBeCloseTo(0.01137, 4); // the measured manual call
  });
});

describe('formatReport', () => {
  it('shows each case with its checks, marks failures, lists tokens and cost, and says there is no baseline', () => {
    const records = [
      rec('a', 1, { s: ['safety', true], q: ['quality', false] }),
      rec('b', 1, { t: ['safety', true] }, { tokens: { input: 1000, output: 400 } }),
    ];
    const summary = summarize(records);
    const text = formatReport({ summary, verdict: judge(summary, { repeats: 1, baseline: null }), records, repeats: 1, model: 'claude-x', baseline: null, prices: { inputPerMTok: 2, outputPerMTok: 10 } });
    expect(text).toContain('a');
    expect(text).toMatch(/FAIL.*q/);
    expect(text).toMatch(/3500 input.*1000 output/); // 2500 + 1000, 600 + 400
    expect(text).toMatch(/\$0\.0\d/);
    expect(text).toMatch(/no baseline/i);
    expect(text).toMatch(/RESULT: FAIL/);
  });
  it('says PASS when the verdict passes, and compares with the baseline when there is one', () => {
    const records = [rec('a', 1, { s: ['safety', true] })];
    const summary = summarize(records);
    const base = buildBaseline(summary, { model: 'claude-x', repeats: 1 });
    const text = formatReport({ summary, verdict: judge(summary, { repeats: 1, baseline: base }), records, repeats: 1, model: 'claude-x', baseline: base, prices: { inputPerMTok: 2, outputPerMTok: 10 } });
    expect(text).toMatch(/RESULT: PASS/);
    expect(text).toMatch(/baseline/i);
    expect(text).not.toMatch(/no baseline/i);
  });
});
