import { OnboardingSchema, PlanSchema } from 'shared';

export const onboardingFixture = OnboardingSchema.parse({
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
});

export const planFixture = PlanSchema.parse({
  days: [
    { day: 'mon', sessions: [{ discipline: 'running', description: 'Easy 5 km', intensity: 'easy', source: 'coach' }], combinedLoadNote: null },
    { day: 'tue', sessions: [{ discipline: 'crossfit', description: 'Strength', intensity: 'moderate', source: 'coach' }], combinedLoadNote: null },
    { day: 'wed', sessions: [], combinedLoadNote: null },
  ],
  recommendations: ['Sleep well'],
  safetyNote: null,
});

// ---- Builders for coach-response validation tests (tasks 4.1 to 4.4) ----
import type { CoachResponse, Day, Onboarding, Session } from 'shared';

export const ALL_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const session = (
  discipline: Session['discipline'],
  source: Session['source'] = 'coach',
  intensity: Session['intensity'] = 'easy',
): Session => ({ discipline, description: `${discipline} session`, intensity, source });

// An onboarding with overrides (days, paste, weeklyTraining ...), parsed so defaults are filled in.
export const onboardingWith = (change: Record<string, unknown> = {}): Onboarding =>
  OnboardingSchema.parse({
    goal: 'Run a half marathon',
    runningLevel: 'intermediate',
    crossfitLevel: 'intermediate',
    injuries: '',
    runningDays: ALL_DAYS,
    crossfitDays: ALL_DAYS,
    ...change,
  });

export const PASTE = 'Week 1: Mon 5 km easy, Wed 8 km tempo';

// A seven-day response: sessions per day (default none), optional combined-load notes, and any extra fields.
export const responseWith = (
  sessions: Partial<Record<Day, Session[]>> = {},
  extra: { notes?: Partial<Record<Day, string>>; understoodRunning?: CoachResponse['understoodRunning']; painReported?: boolean; safetyNote?: string | null } = {},
): CoachResponse => ({
  understoodRunning: extra.understoodRunning ?? [],
  painReported: extra.painReported ?? false,
  plan: {
    days: ALL_DAYS.map((day) => ({ day, sessions: sessions[day] ?? [], combinedLoadNote: extra.notes?.[day] ?? null })),
    recommendations: [],
    safetyNote: extra.safetyNote ?? null,
  },
});
