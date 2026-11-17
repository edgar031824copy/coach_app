import { useEffect, useRef, useState } from 'react';
import type { Onboarding, PlanRecord } from 'shared';
import { createApi, type Api, type ApiFailure } from './api.js';
import { describeFailure } from './failure-message.js';
import { OnboardingForm } from './OnboardingForm.js';
import { PlanView } from './PlanView.js';
import { nextWeekSeed } from './seed.js';
import { usePlanRequest } from './use-plan-request.js';

// The deployed client calls the server's own URL; in development the Vite proxy makes it the same origin.
const defaultApi = createApi({ baseUrl: import.meta.env.VITE_API_URL ?? '' });

type Saved = { status: 'loading' } | { status: 'ready'; record: PlanRecord | null } | { status: 'failed' };

function FailureNotice({ failure, onRetry }: { failure: ApiFailure; onRetry: () => void }) {
  const { message, canRetry, limitNote } = describeFailure(failure);
  return (
    <div role="alert" className="notice">
      <p>{message}</p>
      {limitNote && <p>{limitNote}</p>}
      {canRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// One page (design.md Decision 7): the onboarding form, then the plan. On start the saved plan is read with
// GET /api/plan, which never calls the coach. A failed request leaves the plan that was shown as it was.
export function App({ api = defaultApi }: { api?: Api }) {
  const { state, submit } = usePlanRequest(api);
  const [saved, setSaved] = useState<Saved>({ status: 'loading' });
  const [latest, setLatest] = useState<PlanRecord | null>(null); // the newest plan made in this visit
  const [seed, setSeed] = useState<{ onboarding: Onboarding; n: number } | null>(null); // "Plan next week" pre-fill
  const lastSent = useRef<Onboarding | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.getPlan().then((r) => {
      if (!cancelled) setSaved(r.ok ? { status: 'ready', record: r.value } : { status: 'failed' });
    });
    return () => { cancelled = true; };
  }, [api]);

  const send = async (onboarding: Onboarding) => {
    lastSent.current = onboarding;
    const result = await submit(onboarding);
    if (result.ok) setLatest(result.value);
  };

  const shown = latest ?? (saved.status === 'ready' ? saved.record : null);
  const failure = state.phase === 'done' && !state.result.ok ? state.result.failure : null;
  const serverFields = failure?.kind === 'api' && failure.error.error === 'validation_error' ? failure.error.fields : undefined;
  const busy = state.phase === 'loading' || state.phase === 'waking';

  return (
    <main>
      <h1>Hybrid Coach</h1>
      {saved.status === 'loading' && <p role="status">Loading your saved plan…</p>}
      {saved.status === 'failed' && <p className="notice">Could not load your saved plan. You can still build a new one.</p>}
      <OnboardingForm key={seed?.n ?? 0} initial={seed?.onboarding} onSubmit={(o) => void send(o)} busy={busy} serverFields={serverFields} />
      {state.phase === 'loading' && <p role="status">Building your plan…</p>}
      {state.phase === 'waking' && <p role="status">Waking up the coach. The first request after a quiet period can take up to a minute.</p>}
      {failure && <FailureNotice failure={failure} onRetry={() => lastSent.current && void send(lastSent.current)} />}
      {shown && (
        <>
          <PlanView record={shown} />
          <button type="button" onClick={() => setSeed({ onboarding: nextWeekSeed(shown.onboarding), n: (seed?.n ?? 0) + 1 })}>
            Plan next week
          </button>
        </>
      )}
    </main>
  );
}
