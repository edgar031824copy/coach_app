// Shared contract between server and client (design.md, Decision 2).
// Structural shapes only: field limits and cross-field rules live in the server's validators.
import { z } from 'zod';

export const DaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const LevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const OnboardingSchema = z.object({
  goal: z.string(),
  runningLevel: LevelSchema,
  crossfitLevel: LevelSchema,
  injuries: z.string(), // may be empty
  runningDays: z.array(DaySchema),
  crossfitDays: z.array(DaySchema),
  existingRunningPlan: z.string().nullable().default(null),
  pastedPlanWeek: z.number().int().nullable().default(null),
  weeklyTraining: z
    .object({
      runningSessions: z.number(),
      crossfitSessions: z.number(),
      runningKm: z.number().nullable(),
    })
    .nullable()
    .default(null),
  targetEvent: z.object({ name: z.string(), date: z.string() }).nullable().default(null),
});

export const SessionSchema = z.object({
  discipline: z.enum(['running', 'crossfit']),
  description: z.string(),
  intensity: z.enum(['easy', 'moderate', 'hard']),
  source: z.enum(['athlete', 'coach']),
});

export const PlanDaySchema = z.object({
  day: DaySchema,
  sessions: z.array(SessionSchema),
  combinedLoadNote: z.string().nullable(),
});

export const PlanSchema = z.object({
  days: z.array(PlanDaySchema),
  recommendations: z.array(z.string()),
  safetyNote: z.string().nullable(),
});

export const CoachResponseSchema = z.object({
  understoodRunning: z.array(z.object({ dayOptions: z.array(DaySchema), description: z.string() })),
  painReported: z.boolean(),
  plan: PlanSchema,
});

export const PlanRecordSchema = z.object({
  id: z.number().int(),
  plan: PlanSchema,
  onboarding: OnboardingSchema,
  createdAt: z.string(),
});

export const PlanResponseSchema = PlanRecordSchema.extend({ remainingCallsToday: z.number().int() });

export const ApiErrorSchema = z.object({
  error: z.enum([
    'validation_error',
    'daily_limit_reached',
    'coach_unavailable',
    'invalid_coach_response',
    'plan_unreadable',
    'server_error',
  ]),
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
  remainingCallsToday: z.number().int().optional(),
});

export type Day = z.infer<typeof DaySchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Onboarding = z.infer<typeof OnboardingSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type PlanRecord = z.infer<typeof PlanRecordSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
