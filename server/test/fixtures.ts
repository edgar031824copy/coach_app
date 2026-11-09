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
