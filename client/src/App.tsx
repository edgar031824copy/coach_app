import { useEffect, useRef, useState, type Ref } from 'react';
import { shortDate, validateOnboarding, type Onboarding, type PlanRecord, type PlanResponse } from 'shared';
import { createApi, type Api, type ApiFailure } from './api.js';
import { describeFailure } from './failure-message.js';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WarningIcon } from '@/components/icons';
import { FORM_FIELD_KEYS, OnboardingForm } from './OnboardingForm.js';
import { PlanView } from './PlanView.js';
import { neighbour, nearestAfter, pickStart, without, withPlan } from './plans.js';
import { nextWeekSeed } from './seed.js';
import { usePlanRequest } from './use-plan-request.js';
import { currentMonday, nextWeekStart } from './week.js';

// The deployed client calls the server's own URL; in development the Vite proxy makes it the same origin.
const defaultApi = createApi({ baseUrl: import.meta.env.VITE_API_URL ?? '' });

const DELETE_FAILED = 'The plan could not be deleted. Nothing was changed. You can try again.';
const DELETE_UNKNOWN = 'The plan may already be deleted. Reload the page to check, or try again.';

// Reading the stored plans on start: loading, read (the list is in `plans`), or failed (the page still works, with the plans
// of this visit only).
type Read = 'loading' | 'ready' | 'failed';

// A built plan as a stored record: the answer of POST /api/plan carries one field more.
const toRecord = (r: PlanResponse): PlanRecord => ({ id: r.id, plan: r.plan, onboarding: r.onboarding, createdAt: r.createdAt, weekStart: r.weekStart });

// A failure: announced as an alert, in words, with "Try again" only where E1 offers it. It takes focus after a failed
// submit when the server named no field of the form, hence the ref and tabIndex.
function FailureNotice({ failure, onRetry, noticeRef }: { failure: ApiFailure; onRetry: () => void; noticeRef: Ref<HTMLDivElement> }) {
  const { message, canRetry, limitNote } = describeFailure(failure);
  return (
    <Alert variant="danger" role="alert" ref={noticeRef} tabIndex={-1} className="mt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <WarningIcon aria-hidden="true" />
      <div className="grid min-w-0 gap-2">
        <p className="break-words">{message}</p>
        {limitNote && <p className="font-semibold">{limitNote}</p>}
        {canRetry && <Button type="button" className="justify-self-start" onClick={onRetry}>Try again</Button>}
      </div>
    </Alert>
  );
}

// Progress text: announced politely, on the soft surface.
function Status({ children }: { children: string }) {
  return <Alert role="status" className="mt-4">{children}</Alert>;
}

// One page with two views (design.md Decision 3): the plan view and the form view, plus a start state while the stored
// plans are read with GET /api/plans, which never calls the coach. The page holds the list (one plan per week, oldest
// week first) and the id of the plan shown; a week switcher moves along the list. No router: the view comes from existing
// state, and every move clears the last failure. A failed request leaves the plan that was shown as it was.
export function App({ api = defaultApi }: { api?: Api }) {
  const { state, submit, reset } = usePlanRequest(api);
  const [read, setRead] = useState<Read>('loading');
  const [plans, setPlans] = useState<PlanRecord[]>([]); // every stored plan, oldest week first (plans.ts)
  const [shownId, setShownId] = useState<number | null>(null);
  const [rereading, setRereading] = useState(false); // the list is being read again after the first build; the page stays busy
  const listIncomplete = useRef(false); // the start read failed: the first successful build reads the list again
  const [formOpen, setFormOpen] = useState(false); // the athlete opened the form although a plan exists
  const [seed, setSeed] = useState<{ onboarding?: Onboarding; n: number; week: string } | null>(null); // form pre-fill and the week the form's request carries; n remounts the form
  const [confirming, setConfirming] = useState(false); // "Delete this plan" asked, not yet confirmed
  const [deleting, setDeleting] = useState(false); // the deletion request is running
  const [deleteNotice, setDeleteNotice] = useState<{ text: string } | null>(null); // a failed deletion; an object, so the same words twice are two changes and each takes focus
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null); // "Deleted the plan for the week of ...", shown after a deletion left other plans
  const deletingNow = useRef(false); // the one-request guard: state would still be false for a second press in the same tick
  const [readNoteWanted, setReadNoteWanted] = useState(true); // the failed-read message goes away after the first move
  const lastSent = useRef<{ onboarding: Onboarding; weekStart: string } | null>(null); // "Try again" repeats both, the week too
  const mountWeek = useRef(currentMonday(new Date())); // the week of the first plan's form: the current week when the page opened
  const wantHeadingFocus = useRef(false); // set by an athlete action that opens a view; never by the page opening
  const planHeading = useRef<HTMLHeadingElement>(null);
  const formHeading = useRef<HTMLHeadingElement>(null);
  const failureNotice = useRef<HTMLDivElement>(null);
  const deleteAlert = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.getPlans().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setPlans(r.value);
        setShownId(pickStart(r.value, currentMonday(new Date()))?.id ?? null);
        setRead('ready');
      } else {
        listIncomplete.current = true;
        setRead('failed');
      }
    });
    return () => { cancelled = true; };
  }, [api]);

  // Every change of view: clear the failure and the failed-read message; a form view gets a fresh form.
  const go = (to: 'plan' | 'form', onboarding?: Onboarding, week: string | null = null) => {
    reset();
    setConfirming(false);
    setDeleteNotice(null);
    setDeleteStatus(null);
    setReadNoteWanted(false);
    setFormOpen(to === 'form');
    // A form that opens pre-filled with a value that is not allowed focuses that field itself, so the heading must not.
    wantHeadingFocus.current = !(to === 'form' && onboarding && !validateOnboarding(onboarding).ok);
    // The form's week is fixed when it opens: "Plan next week" asks for its chosen week, anything else for the current one.
    if (to === 'form') setSeed({ ...(onboarding ? { onboarding } : {}), n: (seed?.n ?? 0) + 1, week: week ?? currentMonday(new Date()) });
  };

  // The week comes from the app, never from a field: a retry gets the week it had (given), else the week the form opened
  // for (the same week its replace note names).
  const formWeek = seed?.week ?? mountWeek.current;
  const send = async (onboarding: Onboarding, given?: string) => {
    const weekStart = given ?? formWeek;
    lastSent.current = { onboarding, weekStart };
    const result = await submit(onboarding, weekStart);
    if (result.ok) {
      const record = toRecord(result.value);
      let next = withPlan(plans, record);
      if (listIncomplete.current) {
        // The start read failed, so the list is incomplete: read it again now. If that fails too, the plan just built stands alone.
        listIncomplete.current = false;
        setRereading(true);
        const again = await api.getPlans();
        setRereading(false);
        if (again.ok) next = withPlan(again.value, record);
      }
      wantHeadingFocus.current = true;
      setPlans(next);
      setShownId(record.id);
      setFormOpen(false);
      setReadNoteWanted(false);
    }
  };

  // Deleting the shown plan (by its id, whatever week the switcher has opened). While it runs the plan stays in view and the
  // buttons that leave it are disabled, so an answer can never land on another plan. Success, or "already gone", removes the
  // plan from the list and shows the nearest week (the next later, else the previous) with a status line; with no plan left
  // the empty form opens. An answer from the server that is an error means nothing changed; no answer at all means it may
  // have happened.
  const deleteShown = async (id: number) => {
    if (deletingNow.current) return;
    deletingNow.current = true;
    setDeleting(true);
    const result = await api.deletePlan(id);
    deletingNow.current = false;
    setDeleting(false);
    const gone = result.ok || (result.failure.kind === 'api' && result.failure.error.error === 'not_found');
    if (gone) {
      const gonePlan = plans.find((p) => p.id === id);
      const nearest = nearestAfter(plans, id);
      setPlans(without(plans, id));
      if (nearest && gonePlan) {
        setShownId(nearest.id);
        go('plan');
        setDeleteStatus(`Deleted the plan for the week of ${shortDate(gonePlan.weekStart)}. Showing the week of ${shortDate(nearest.weekStart)}.`);
      } else {
        setShownId(null);
        go('form');
      }
      return;
    }
    setConfirming(false);
    const answered = result.failure.kind === 'api';
    setDeleteNotice({ text: answered ? DELETE_FAILED : DELETE_UNKNOWN });
  };

  const shown = plans.find((p) => p.id === shownId) ?? null;
  const shownIndex = shown ? plans.findIndex((p) => p.id === shown.id) : -1;
  // Moving along the list sends no request and clears what belonged to the plan that was left.
  const move = (step: 1 | -1) => {
    if (!shown) return;
    const to = neighbour(plans, shown.id, step);
    if (!to) return; // an end: the button is aria-disabled and does nothing
    setConfirming(false);
    setDeleteNotice(null);
    setDeleteStatus(null);
    setShownId(to.id);
  };
  const failure = state.phase === 'done' && !state.result.ok ? state.result.failure : null;
  const serverFields = failure?.kind === 'api' && failure.error.error === 'validation_error' ? failure.error.fields : undefined;
  const busy = state.phase === 'loading' || state.phase === 'waking' || rereading;
  const starting = read === 'loading';
  const planView = !starting && shown !== null && !formOpen;
  const formView = !starting && !planView;

  // After a view opens because of an athlete action, focus goes to its main heading.
  useEffect(() => {
    if (!wantHeadingFocus.current) return;
    wantHeadingFocus.current = false;
    (planView ? planHeading : formHeading).current?.focus();
  }, [planView, formView, seed?.n, shownId]);

  // After a failed deletion the alert takes focus, also when a second attempt fails with the same words.
  useEffect(() => {
    if (deleteNotice) deleteAlert.current?.focus();
  }, [deleteNotice]);

  // After a failed submit: the first field a server error names (the form does that itself), else the failure message.
  useEffect(() => {
    if (failure && !(serverFields && Object.keys(serverFields).some((k) => FORM_FIELD_KEYS.has(k)))) failureNotice.current?.focus();
  }, [failure, serverFields]);

  return (
    <main className="mx-auto max-w-xl px-4 pb-16">
      <h1 className="m-0 py-4 text-lg font-bold">Hybrid Coach</h1>
      {starting && <Status>Loading your saved plan…</Status>}
      {planView && (
        <>
          <PlanView
            record={shown}
            headingRef={planHeading}
            switcher={plans.length >= 2 ? { position: shownIndex + 1, total: plans.length, onEarlier: () => move(-1), onLater: () => move(1), disabled: deleting } : undefined}
            deletion={{
              confirming,
              deleting,
              othersStay: plans.length > 1,
              status: deleteStatus,
              notice: deleteNotice,
              noticeRef: deleteAlert,
              onAsk: () => { setDeleteNotice(null); setDeleteStatus(null); setConfirming(true); }, // an old failure does not sit beside a new question
              onCancel: () => setConfirming(false),
              onConfirm: () => void deleteShown(shown.id),
            }}
          />
          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" disabled={deleting} onClick={() => go('form', nextWeekSeed(shown.onboarding), nextWeekStart(shown.weekStart, new Date()))}>Plan next week</Button>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => go('form')}>New plan</Button>
          </div>
        </>
      )}
      {formView && (
        <>
          <h2 ref={formHeading} tabIndex={-1} className="m-0 mb-1 text-2xl font-extrabold leading-tight">New plan</h2>
          <p className="m-0 mb-4 text-base text-muted-foreground">Tell the coach about you. It suggests; you decide.</p>
          {shown && <Button type="button" variant="outline" className="mb-4" onClick={() => go('plan')} disabled={busy}>My plan</Button>}
          {read === 'failed' && readNoteWanted && <Alert className="mt-4">Could not load your saved plan. You can still build a new one.</Alert>}
          {plans.some((p) => p.weekStart === formWeek) && (
            <Alert role="note" className="mb-4">You already have a plan for the week of {shortDate(formWeek)}. Building a new one replaces it.</Alert>
          )}
          <OnboardingForm key={seed?.n ?? 0} initial={seed?.onboarding} onSubmit={(o) => void send(o)} busy={busy} serverFields={serverFields} />
          {state.phase === 'loading' && <Status>Building your plan…</Status>}
          {state.phase === 'waking' && <Status>Waking up the coach. The first request after a quiet period can take up to a minute.</Status>}
          {failure && <FailureNotice failure={failure} noticeRef={failureNotice} onRetry={() => lastSent.current && void send(lastSent.current.onboarding, lastSent.current.weekStart)} />}
        </>
      )}
    </main>
  );
}
