import { parseArgs } from 'node:util';
import { DaySchema, type CoachResponse, type Day, type Onboarding } from 'shared';
import type { Violation } from '../validation/coach-response.js';

// ---- Arguments of the manual plan check (plan-check.ts) ----

export interface PlanCheckOptions { file: string; week: number; crossfitDays: Day[] }
export type PlanCheckArgs = { ok: true; options: PlanCheckOptions } | { ok: false; error: string };

export function parsePlanCheckArgs(argv: string[]): PlanCheckArgs {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { file: { type: 'string' }, week: { type: 'string' }, crossfit: { type: 'string' } }, strict: true }));
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (!values.file) return { ok: false, error: 'give the file with your running plan: --file /path/to/plan.txt' };

  const weekText = values.week ?? '1';
  const week = Number(weekText);
  if (!/^\d+$/.test(weekText) || week < 1 || week > 52) return { ok: false, error: `--week must be a whole number from 1 to 52 (got "${weekText}").` };

  const crossfitText = values.crossfit ?? 'tue,thu';
  const crossfitDays: Day[] = [];
  if (crossfitText !== 'none') {
    for (const part of crossfitText.split(',').map((s) => s.trim())) {
      const day = DaySchema.safeParse(part);
      if (!day.success) return { ok: false, error: `--crossfit must list days from mon to sun, or "none" (got "${part}").` };
      if (crossfitDays.includes(day.data)) return { ok: false, error: `--crossfit lists "${part}" more than once.` };
      crossfitDays.push(day.data);
    }
  }
  return { ok: true, options: { file: values.file, week, crossfitDays } };
}

// ---- The report ----

const ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// What the coach read from the pasted plan and how it placed it, for a person to compare with their own plan. It prints
// what the COACH wrote (the sessions it read and its own text), never the pasted text itself.
export function formatPlanCheckReport(o: { onboarding: Onboarding; response: CoachResponse; violations: Violation[]; seconds: number }): string {
  const week = o.onboarding.pastedPlanWeek ?? 1;
  const read = o.response.understoodRunning;
  const lines: string[] = [];
  lines.push(`Answered in ${o.seconds.toFixed(1)} s.`, '');
  lines.push(`What the coach read for week ${week} of your plan: ${read.length} running sessions`);
  for (const r of read) lines.push(`  [${r.dayOptions.join('/')}] ${r.description}`);
  lines.push('', 'How the plan places them (Monday to Sunday):');
  for (const day of ORDER) {
    const planned = o.response.plan.days.find((d) => d.day === day);
    const sessions = planned?.sessions ?? [];
    if (sessions.length === 0) {
      lines.push(`  ${day}: rest`);
      continue;
    }
    const text = sessions
      .map((s) => `${s.discipline} (${s.source === 'athlete' ? 'your plan' : `coach, ${s.intensity}`}) "${s.description}"`)
      .join('  +  ');
    lines.push(`  ${day}: ${text}${planned?.combinedLoadNote ? `   [note: ${planned.combinedLoadNote}]` : ''}`);
  }
  lines.push('', `painReported: ${o.response.painReported}`, `safetyNote: ${o.response.plan.safetyNote ?? 'none'}`);
  lines.push('', o.violations.length === 0 ? 'Rule check: PASS (the answer satisfies every rule the server applies)' : `Rule check: FAIL (${o.violations.map((v) => v.rule).join(', ')})`);
  lines.push('', `Compare with your plan: are these exactly the sessions of week ${week} (none missing, none invented, nothing from another week), on the right days, with the same wording and numbers?`);
  return lines.join('\n');
}
