import type { Onboarding, PlanResponse } from 'shared';

export const onboarding: Onboarding = {
  goal: 'Run a half marathon',
  runningLevel: 'intermediate',
  crossfitLevel: 'beginner',
  injuries: '',
  runningDays: ['mon', 'wed'],
  crossfitDays: ['tue'],
  existingRunningPlan: null,
  pastedPlanWeek: null,
  weeklyTraining: null,
  targetEvent: null,
};

export const planResponse: PlanResponse = {
  id: 1,
  createdAt: '2026-11-13T10:00:00.000Z',
  onboarding,
  remainingCallsToday: 19,
  plan: {
    days: (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => ({ day, sessions: [], combinedLoadNote: null })),
    recommendations: [],
    safetyNote: null,
  },
};

// A fake `fetch` that answers after `ms` milliseconds (of the test's fake clock) and, like the real one, rejects with an
// AbortError when its request is aborted first.
export function delayedFetch(ms: number, status: number, body: unknown): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })), ms);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    })) as typeof fetch;
}
