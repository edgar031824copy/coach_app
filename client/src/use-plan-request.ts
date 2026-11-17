import { useCallback, useEffect, useRef, useState } from 'react';
import type { Onboarding, PlanResponse } from 'shared';
import type { Api, ApiResult } from './api.js';

// After this long without an answer the screen says the coach is waking up (a cold free-tier server) 🔶.
export const WAKING_AFTER_MS = 3000;

export type RequestState =
  | { phase: 'idle' }
  | { phase: 'loading' } // sent, no answer yet
  | { phase: 'waking' } // no answer after WAKING_AFTER_MS
  | { phase: 'done'; result: ApiResult<PlanResponse> };

// One plan request at a time: idle -> loading -> (waking) -> done. The 120 s timeout lives in the API module.
export function usePlanRequest(api: Api) {
  const [state, setState] = useState<RequestState>({ phase: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = useCallback(
    async (onboarding: Onboarding): Promise<ApiResult<PlanResponse>> => {
      clearTimeout(timer.current);
      setState({ phase: 'loading' });
      timer.current = setTimeout(() => setState((s) => (s.phase === 'loading' ? { phase: 'waking' } : s)), WAKING_AFTER_MS);
      const result = await api.postPlan(onboarding);
      clearTimeout(timer.current);
      setState({ phase: 'done', result });
      return result;
    },
    [api],
  );

  return { state, submit };
}
