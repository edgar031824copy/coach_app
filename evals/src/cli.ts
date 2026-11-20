import { parseArgs } from 'node:util';

export interface CliOptions {
  coach: 'real' | 'fake';
  repeats: number;
  only: string[] | null; // case ids, or every case
  model: string | null;
  writeBaseline: boolean;
  priceIn: number | null; // USD per million input tokens
  priceOut: number | null;
}
export type CliResult = { ok: true; options: CliOptions } | { ok: false; error: string };

// Every real call costs money, so the repeat count is bounded and a typo in a case id is an error, not "run nothing".
export function parseCliArgs(argv: string[], caseIds: string[]): CliResult {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        repeats: { type: 'string' },
        only: { type: 'string' },
        coach: { type: 'string' },
        model: { type: 'string' },
        'write-baseline': { type: 'boolean' },
        'price-in': { type: 'string' },
        'price-out': { type: 'string' },
      },
      strict: true,
    }));
  } catch (err) {
    return { ok: false, error: `${(err as Error).message}` };
  }

  const repeatsText = values.repeats ?? '1';
  if (!/^[1-5]$/.test(repeatsText)) return { ok: false, error: `--repeats must be a whole number from 1 to 5 (got "${repeatsText}"): every repeat is another paid call per case.` };

  const only = values.only === undefined ? null : values.only.split(',').map((s) => s.trim()).filter(Boolean);
  if (only) {
    const unknown = only.filter((id) => !caseIds.includes(id));
    if (unknown.length > 0 || only.length === 0) return { ok: false, error: `unknown case id${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ') || '(none given)'}. Valid ids: ${caseIds.join(', ')}.` };
  }

  const coach = values.coach ?? 'real';
  if (coach !== 'real' && coach !== 'fake') return { ok: false, error: `--coach must be "real" or "fake" (got "${coach}").` };

  const price = (name: 'price-in' | 'price-out'): number | null | 'bad' => {
    const v = values[name];
    if (v === undefined) return null;
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : 'bad';
  };
  const priceIn = price('price-in');
  const priceOut = price('price-out');
  if (priceIn === 'bad' || priceOut === 'bad') return { ok: false, error: '--price-in and --price-out must be numbers of dollars per million tokens, zero or more.' };

  const writeBaseline = values['write-baseline'] ?? false;
  if (writeBaseline && coach === 'fake') return { ok: false, error: 'a baseline is the real model\'s pass rates: --write-baseline cannot be used with --coach fake.' };
  // A baseline replaces the whole file, so it must come from a full run, and from enough samples to mean something.
  if (writeBaseline && only) return { ok: false, error: '--write-baseline needs a run of every case: with --only it would replace the baseline with just the chosen cases.' };
  if (writeBaseline && Number(repeatsText) < 3) return { ok: false, error: '--write-baseline needs --repeats 3 or more: one or two samples per case say little about flakiness.' };

  return { ok: true, options: { coach, repeats: Number(repeatsText), only, model: values.model ?? null, writeBaseline, priceIn, priceOut } };
}
