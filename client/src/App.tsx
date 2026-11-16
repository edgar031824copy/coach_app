import { useMemo } from 'react';
import { createApi } from './api.js';
import { OnboardingForm } from './OnboardingForm.js';
import { PlanView } from './PlanView.js';
import { usePlanRequest } from './use-plan-request.js';

// The deployed client calls the server's own URL; in development the Vite proxy makes it the same origin.
const api = createApi({ baseUrl: import.meta.env.VITE_API_URL ?? '' });

// Reload, "Plan next week" and the messages for each failure (6.4) come next; for now a validation error from the
// server is shown next to its fields and a plan, once there is one, is shown below the form.
export function App() {
  const { state, submit } = usePlanRequest(useMemo(() => api, []));
  const failure = state.phase === 'done' && !state.result.ok ? state.result.failure : null;
  const serverFields = failure?.kind === 'api' && failure.error.error === 'validation_error' ? failure.error.fields : undefined;
  return (
    <main>
      <h1>Hybrid Coach</h1>
      <OnboardingForm onSubmit={(o) => void submit(o)} busy={state.phase === 'loading' || state.phase === 'waking'} serverFields={serverFields} />
      {state.phase === 'done' && state.result.ok && <PlanView record={state.result.value} />}
    </main>
  );
}
