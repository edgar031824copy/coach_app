import type { CoachResponse, Day, Onboarding, PlanDay, Session } from 'shared';
import type { CoachClient } from './types.js';

// The fake coach (design.md Decision 3, task 6.0): a rule-based stand-in for the model, selected by COACH_MODE=fake.
// It costs nothing, needs no key, and is deterministic, so the browser tests and local runs have a coach to talk to.
// It is NOT a model of good coaching. Its one contract is that every answer passes the same validation as the real
// coach's (tests run it over many inputs), and it never follows instructions found in the athlete's text.

const ALL_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const SAFETY_NOTE =
  'You mentioned pain or an injury. This coach is not a clinician and cannot diagnose or say what is wrong. ' +
  'Please see a qualified professional before relying on this plan, and do not train through pain.' +
  ' Any sessions from your own running plan are yours, so check them with that professional too.';
const COMBINED_NOTE = 'Two sessions today: keep the run easy and leave a few hours before CrossFit.';

const run = (description: string, source: Session['source']): Session => ({ discipline: 'running', description, intensity: 'easy', source });
const crossfit = (): Session => ({ discipline: 'crossfit', description: 'CrossFit class (fake coach)', intensity: 'moderate', source: 'coach' });
const easyRun = (): Session => run('Easy run (fake coach)', 'coach');

// ---- Reading the pasted plan (a deliberately simple reader: "<day> <text>" pieces split by comma, semicolon, newline) ----

const DAY_WORD = /^(mon|tue|wed|thu|fri|sat|sun)(?:day|s|sday|nesday|rsday|urday)?\b[\s:.-]*(.+)$/i;

// The part of the paste for one week: text after a "Week N" heading up to the next heading; the whole paste when
// it has no headings or the week is not in it (a missing week reads as nothing, which the endpoint reports as unreadable).
function weekSection(paste: string, week: number): string {
  const parts = paste.split(/week\s*(\d+)\s*:?/i); // [before, n1, text1, n2, text2, ...]
  if (parts.length === 1) return paste;
  for (let i = 1; i < parts.length; i += 2) if (Number(parts[i]) === week) return parts[i + 1] ?? '';
  return '';
}

function readPaste(paste: string, week: number): { day: Day; description: string }[] {
  const found: { day: Day; description: string }[] = [];
  for (const piece of weekSection(paste, week).split(/[,;\n]+/)) {
    const m = DAY_WORD.exec(piece.trim());
    const description = m?.[2]?.trim().replace(/[.\s]+$/, '');
    if (m && description) found.push({ day: m[1]!.toLowerCase() as Day, description });
  }
  return found;
}

// ---- The plan ----

export function buildFakeResponse(onboarding: Onboarding): CoachResponse {
  const pasted = onboarding.existingRunningPlan !== null;
  const read = pasted ? readPaste(onboarding.existingRunningPlan as string, onboarding.pastedPlanWeek ?? 1) : [];
  const stated = pasted ? null : onboarding.weeklyTraining; // a pasted plan is the athlete's own and is never limited

  const sessions = new Map<Day, Session[]>(ALL_DAYS.map((d) => [d, []]));
  for (const r of read) sessions.get(r.day)!.push(run(r.description, 'athlete'));

  const pick = (days: Day[], limit: number | undefined) => ALL_DAYS.filter((d) => days.includes(d)).slice(0, limit);
  if (!pasted) for (const d of pick(onboarding.runningDays, stated?.runningSessions)) sessions.get(d)!.push(easyRun());
  for (const d of pick(onboarding.crossfitDays, stated?.crossfitSessions)) sessions.get(d)!.push(crossfit());

  // At least one rest day, unless pasted sessions fill the week: free the last day that holds only coach sessions.
  if (ALL_DAYS.every((d) => sessions.get(d)!.length > 0)) {
    const free = [...ALL_DAYS].reverse().find((d) => sessions.get(d)!.every((s) => s.source === 'coach'));
    if (free) sessions.set(free, []);
  }

  const days: PlanDay[] = ALL_DAYS.map((day) => {
    const list = sessions.get(day)!;
    const both = list.some((s) => s.discipline === 'running') && list.some((s) => s.discipline === 'crossfit');
    return { day, sessions: list, combinedLoadNote: both ? COMBINED_NOTE : null };
  });

  const pain = onboarding.injuries.trim() !== '';
  return {
    understoodRunning: read.map((r) => ({ dayOptions: [r.day], description: r.description })),
    painReported: pain,
    plan: {
      days,
      recommendations: ['This is a test plan from the fake coach, not real coaching.'],
      safetyNote: pain ? SAFETY_NOTE : null,
    },
  };
}

export function createFakeCoach(): CoachClient {
  return {
    async generate(onboarding) {
      return buildFakeResponse(onboarding);
    },
  };
}
