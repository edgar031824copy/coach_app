import { describe, it, expect } from 'vitest';
import type { CoachClient } from '../../server/src/coach/types.js';
import { CoachOutputError } from '../../server/src/coach/types.js';
import { onboardingWith, responseWith, session } from '../../server/test/fixtures.js';
import * as c from './checks.js';
import { runEvals } from './runner.js';
import type { EvalCase } from './types.js';

const onboarding = onboardingWith({ runningDays: ['mon'], crossfitDays: ['tue'], injuries: '' });
const theCase: EvalCase = { id: 'demo', title: 'demo', onboarding, checks: [c.rulesPass(), c.painReportedIs(false), c.hasBothDisciplines()] };
const good = responseWith({ mon: [session('running')], tue: [session('crossfit')] });
const coachOf = (answer: (n: number) => unknown): CoachClient & { calls: number } => {
  const coach = { calls: 0, async generate() { coach.calls++; return answer(coach.calls); } };
  return coach;
};
const base = { cases: [theCase], today: '2026-11-18' };

describe('runEvals', () => {
  it('calls the coach once per case and repeat, with the onboarding and today\'s date, and runs every check', async () => {
    const seen: unknown[] = [];
    const coach: CoachClient = { async generate(o, ctx) { seen.push([o, ctx]); return good; } };
    const records = await runEvals({ ...base, coach, repeats: 3 });
    expect(records).toHaveLength(3);
    expect(seen).toEqual([[onboarding, { today: '2026-11-18' }], [onboarding, { today: '2026-11-18' }], [onboarding, { today: '2026-11-18' }]]);
    expect(records.map((r) => r.repeat)).toEqual([1, 2, 3]);
    expect(records[0]).toMatchObject({ caseId: 'demo', ok: true });
    expect(records[0]!.checks.map((x) => [x.name, x.pass])).toEqual([['passes-server-rules', true], ['no-pain-reported', true], ['plans-running-and-crossfit', true]]);
  });

  it('records a failing check without stopping the other checks', async () => {
    const records = await runEvals({ ...base, coach: coachOf(() => responseWith({ mon: [session('running')] })), repeats: 1 });
    expect(records[0]!.checks.map((x) => x.pass)).toEqual([true, true, false]);
  });

  it('turns a coach error into a run with no valid answer that fails every check, naming the error and nothing else', async () => {
    for (const make of [() => { throw new CoachOutputError('the model said something private'); }, () => { throw new Error('connection reset'); }]) {
      const records = await runEvals({ ...base, coach: coachOf(make), repeats: 1 });
      const r = records[0]!;
      expect(r.ok).toBe(false);
      expect(r.checks.every((x) => !x.pass && /no valid answer/i.test(x.detail))).toBe(true);
      expect(r.checks).toHaveLength(3);
      expect(JSON.stringify(r)).not.toContain('private'); // the error's name only: messages can quote the model's output
    }
    const r = (await runEvals({ ...base, coach: coachOf(() => { throw new CoachOutputError('x'); }), repeats: 1 }))[0]!;
    expect(r.error).toBe('CoachOutputError');
  });

  it('treats an answer of the wrong shape as no valid answer', async () => {
    const r = (await runEvals({ ...base, coach: coachOf(() => ({ nonsense: true })), repeats: 1 }))[0]!;
    expect(r.ok).toBe(false);
    expect(r.error).toBe('InvalidShape');
  });

  it('keeps going after a failed run', async () => {
    const records = await runEvals({ ...base, coach: coachOf((n) => { if (n === 1) throw new Error('boom'); return good; }), repeats: 2 });
    expect(records.map((r) => r.ok)).toEqual([false, true]);
  });

  it('measures the tokens each call used from a cumulative probe, and keeps the answer for the report', async () => {
    let used = { input: 0, output: 0 };
    const coach: CoachClient = { async generate() { used = { input: used.input + 2500, output: used.output + 600 }; return good; } };
    const records = await runEvals({ ...base, coach, repeats: 2, usageProbe: () => ({ ...used }) });
    expect(records.map((r) => r.tokens)).toEqual([{ input: 2500, output: 600 }, { input: 2500, output: 600 }]);
    expect(records[0]!.response).toEqual(good);
  });

  it('reports progress as each run finishes', async () => {
    const lines: string[] = [];
    await runEvals({ ...base, coach: coachOf(() => good), repeats: 2, onProgress: (r) => lines.push(`${r.caseId}#${r.repeat}`) });
    expect(lines).toEqual(['demo#1', 'demo#2']);
  });
});
