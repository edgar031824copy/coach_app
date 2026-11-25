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

// One page with two views (design.md Decision 3): the plan view and the form view, plus a start state while the saved
// plan is read with GET /api/plan, which never calls the coach. No router: the view comes from existing state, and every
// move clears the last failure. A failed request leaves the plan that was shown as it was.
export function App({ api = defaultApi }: { api?: Api }) {
  const { state, submit, reset } = usePlanRequest(api);
  const [saved, setSaved] = useState<Saved>({ status: 'loading' });
  const [latest, setLatest] = useState<PlanRecord | null>(null); // the newest plan made in this visit
  const [formOpen, setFormOpen] = useState(false); // the athlete opened the form although a plan exists
  const [seed, setSeed] = useState<{ onboarding?: Onboarding; n: number } | null>(null); // form pre-fill; n remounts the form
  const [readNoteWanted, setReadNoteWanted] = useState(true); // the failed-read message goes away after the first move
  const lastSent = useRef<Onboarding | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.getPlan().then((r) => {
      if (!cancelled) setSaved(r.ok ? { status: 'ready', record: r.value } : { status: 'failed' });
    });
    return () => { cancelled = true; };
  }, [api]);

  // Every change of view: clear the failure and the failed-read message; a form view gets a fresh form.
  const go = (to: 'plan' | 'form', onboarding?: Onboarding) => {
    reset();
    setReadNoteWanted(false);
    setFormOpen(to === 'form');
    if (to === 'form') setSeed({ ...(onboarding ? { onboarding } : {}), n: (seed?.n ?? 0) + 1 });
  };

  const send = async (onboarding: Onboarding) => {
    lastSent.current = onboarding;
    const result = await submit(onboarding);
    if (result.ok) {
      setLatest(result.value);
      setFormOpen(false);
      setReadNoteWanted(false);
    }
  };

  const shown = latest ?? (saved.status === 'ready' ? saved.record : null);
  const failure = state.phase === 'done' && !state.result.ok ? state.result.failure : null;
  const serverFields = failure?.kind === 'api' && failure.error.error === 'validation_error' ? failure.error.fields : undefined;
  const busy = state.phase === 'loading' || state.phase === 'waking';
  const starting = saved.status === 'loading';
  const planView = !starting && shown !== null && !formOpen;
  const formView = !starting && !planView;

  return (
    <main>
      <h1>Hybrid Coach</h1>
      {starting && <p role="status">Loading your saved plan…</p>}
      {planView && (
        <>
          <PlanView record={shown} />
          <button type="button" onClick={() => go('form', nextWeekSeed(shown.onboarding))}>Plan next week</button>
          <button type="button" onClick={() => go('form')}>New plan</button>
        </>
      )}
      {formView && (
        <>
          {shown && <button type="button" onClick={() => go('plan')} disabled={busy}>My plan</button>}
          {saved.status === 'failed' && readNoteWanted && <p className="notice">Could not load your saved plan. You can still build a new one.</p>}
          <OnboardingForm key={seed?.n ?? 0} initial={seed?.onboarding} onSubmit={(o) => void send(o)} busy={busy} serverFields={serverFields} />
          {state.phase === 'loading' && <p role="status">Building your plan…</p>}
          {state.phase === 'waking' && <p role="status">Waking up the coach. The first request after a quiet period can take up to a minute.</p>}
          {failure && <FailureNotice failure={failure} onRetry={() => lastSent.current && void send(lastSent.current)} />}
        </>
      )}
    </main>
  );
}
