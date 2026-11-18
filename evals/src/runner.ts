import { CoachResponseSchema } from 'shared';
import type { CoachClient } from '../../server/src/coach/types.js';
import type { CheckRecord, RunRecord, Tokens } from './score.js';
import type { EvalCase } from './types.js';

export interface RunOptions {
  coach: CoachClient;
  cases: EvalCase[];
  repeats: number;
  today: string; // yyyy-mm-dd, what the coach is told as "today"
  usageProbe?: () => Tokens; // cumulative token counts so far; the difference around a call is that call's usage
  onProgress?: (record: RunRecord) => void;
}

const failedChecks = (c: EvalCase, why: string): CheckRecord[] =>
  c.checks.map((k) => ({ name: k.name, kind: k.kind, pass: false, detail: `no valid answer (${why})` }));

// Each case is sent to the coach `repeats` times, one after another. Every check runs on every answer; a run that gets
// no valid answer fails all the checks of its case. Errors are recorded by NAME only (messages can quote the model's output).
export async function runEvals(opts: RunOptions): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  for (const c of opts.cases) {
    for (let repeat = 1; repeat <= opts.repeats; repeat++) {
      const before = opts.usageProbe?.() ?? { input: 0, output: 0 };
      const started = Date.now();
      let record: RunRecord;
      try {
        const raw = await opts.coach.generate(c.onboarding, { today: opts.today });
        const parsed = CoachResponseSchema.safeParse(raw);
        record = parsed.success
          ? {
              caseId: c.id, repeat, ok: true, ms: 0, tokens: before, response: parsed.data,
              checks: c.checks.map((k) => ({ name: k.name, kind: k.kind, ...k.run(c.onboarding, parsed.data) })),
            }
          : { caseId: c.id, repeat, ok: false, error: 'InvalidShape', ms: 0, tokens: before, checks: failedChecks(c, 'InvalidShape') };
      } catch (err) {
        const name = err instanceof Error ? err.name : 'Error';
        record = { caseId: c.id, repeat, ok: false, error: name, ms: 0, tokens: before, checks: failedChecks(c, name) };
      }
      const after = opts.usageProbe?.() ?? before;
      record.ms = Date.now() - started;
      record.tokens = { input: after.input - before.input, output: after.output - before.output };
      records.push(record);
      opts.onProgress?.(record);
    }
  }
  return records;
}
