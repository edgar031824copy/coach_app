import { useEffect, useState, type ReactNode } from 'react';
import { validateOnboarding, type Day, type Onboarding } from 'shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const IDEAS = ['Half marathon', '10K', 'Stay fit and balanced', 'Get stronger'];
const LEVELS = [{ id: 'beginner', label: 'Beginner' }, { id: 'intermediate', label: 'Intermediate' }, { id: 'advanced', label: 'Advanced' }];
const DAYS: { id: Day; label: string }[] = [
  { id: 'mon', label: 'Mon' }, { id: 'tue', label: 'Tue' }, { id: 'wed', label: 'Wed' }, { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' }, { id: 'sat', label: 'Sat' }, { id: 'sun', label: 'Sun' },
];

// What the athlete has typed: text for every box, so a half-typed number is still just text until it is checked.
interface Values {
  goal: string; runningLevel: string; crossfitLevel: string; injuries: string;
  runningDays: Day[]; crossfitDays: Day[];
  existingRunningPlan: string; pastedPlanWeek: string;
  runningSessions: string; crossfitSessions: string; runningKm: string;
  eventName: string; eventDate: string;
}
const EMPTY: Values = {
  goal: '', runningLevel: '', crossfitLevel: '', injuries: '', runningDays: [], crossfitDays: [],
  existingRunningPlan: '', pastedPlanWeek: '', runningSessions: '', crossfitSessions: '', runningKm: '', eventName: '', eventDate: '',
};

// Which error key each input belongs to (the keys are the shared validator's field names).
type Key = 'goal' | 'runningLevel' | 'crossfitLevel' | 'injuries' | 'runningDays' | 'crossfitDays' | 'existingRunningPlan' | 'pastedPlanWeek' | 'weeklyTraining' | 'targetEvent';
const KEY_OF: Record<keyof Values, Key> = {
  goal: 'goal', runningLevel: 'runningLevel', crossfitLevel: 'crossfitLevel', injuries: 'injuries', runningDays: 'runningDays', crossfitDays: 'crossfitDays',
  existingRunningPlan: 'existingRunningPlan', pastedPlanWeek: 'pastedPlanWeek',
  runningSessions: 'weeklyTraining', crossfitSessions: 'weeklyTraining', runningKm: 'weeklyTraining', eventName: 'targetEvent', eventDate: 'targetEvent',
};

const blank = (s: string) => s.trim() === '';

// Page order of the error keys, and the element that takes focus for each (a group of days: its first box).
const PAGE_ORDER: Key[] = ['goal', 'runningLevel', 'crossfitLevel', 'injuries', 'runningDays', 'crossfitDays', 'existingRunningPlan', 'pastedPlanWeek', 'weeklyTraining', 'targetEvent'];
const FOCUS_ID: Record<Key, string> = {
  goal: 'f-goal', runningLevel: 'f-runningLevel', crossfitLevel: 'f-crossfitLevel', injuries: 'f-injuries', runningDays: 'f-runningDays', crossfitDays: 'f-crossfitDays',
  existingRunningPlan: 'f-existingRunningPlan', pastedPlanWeek: 'f-pastedPlanWeek', weeklyTraining: 'f-runningSessions', targetEvent: 'f-eventName',
};
// The field names this form has a place for; a server error for any other name has no field to focus.
// The optional part that holds each field, so an error inside a closed part can open it.
const PART_OF_KEY: Partial<Record<Key, 'plan' | 'week' | 'event'>> = { existingRunningPlan: 'plan', pastedPlanWeek: 'plan', weeklyTraining: 'week', targetEvent: 'event' };
export const FORM_FIELD_KEYS: ReadonlySet<string> = new Set(PAGE_ORDER);

// Focuses the first field, in page order, whose key is in `keys`. Returns whether one took focus.
function focusFirstField(keys: ReadonlySet<string>, idFor: (key: Key) => string = (key) => FOCUS_ID[key]): boolean {
  for (const key of PAGE_ORDER) {
    if (!keys.has(key)) continue;
    const el = document.getElementById(idFor(key));
    const target = el instanceof HTMLFieldSetElement ? el.querySelector('input') : el;
    if (target instanceof HTMLElement) { target.focus(); return true; }
  }
  return false;
}

// A saved onboarding back into what the boxes hold.
function toValues(o: Onboarding): Values {
  return {
    goal: o.goal, runningLevel: o.runningLevel, crossfitLevel: o.crossfitLevel, injuries: o.injuries,
    runningDays: o.runningDays, crossfitDays: o.crossfitDays,
    existingRunningPlan: o.existingRunningPlan ?? '', pastedPlanWeek: o.pastedPlanWeek === null ? '' : String(o.pastedPlanWeek),
    runningSessions: o.weeklyTraining ? String(o.weeklyTraining.runningSessions) : '',
    crossfitSessions: o.weeklyTraining ? String(o.weeklyTraining.crossfitSessions) : '',
    runningKm: o.weeklyTraining?.runningKm == null ? '' : String(o.weeklyTraining.runningKm),
    eventName: o.targetEvent?.name ?? '', eventDate: o.targetEvent?.date ?? '',
  };
}

// The request body for the shared validator; an optional part with nothing typed is null.
function toInput(v: Values): unknown {
  const anyWeekly = !(blank(v.runningSessions) && blank(v.crossfitSessions) && blank(v.runningKm));
  const anyEvent = !(blank(v.eventName) && blank(v.eventDate));
  return {
    goal: v.goal,
    runningLevel: v.runningLevel,
    crossfitLevel: v.crossfitLevel,
    injuries: v.injuries,
    runningDays: v.runningDays,
    crossfitDays: v.crossfitDays,
    existingRunningPlan: blank(v.existingRunningPlan) ? null : v.existingRunningPlan,
    pastedPlanWeek: blank(v.pastedPlanWeek) ? null : Number(v.pastedPlanWeek),
    weeklyTraining: anyWeekly
      ? {
          runningSessions: blank(v.runningSessions) ? Number.NaN : Number(v.runningSessions),
          crossfitSessions: blank(v.crossfitSessions) ? Number.NaN : Number(v.crossfitSessions),
          runningKm: blank(v.runningKm) ? null : Number(v.runningKm),
        }
      : null,
    targetEvent: anyEvent ? { name: v.eventName, date: v.eventDate } : null,
  };
}

type PartId = 'plan' | 'week' | 'event';

export interface OnboardingFormProps {
  onSubmit: (onboarding: Onboarding) => void;
  initial?: Onboarding; // pre-fill ("Plan next week"); every pre-filled value is checked at once, so a bad one shows its error
  busy?: boolean; // a request is running
  serverFields?: Record<string, string>; // per-field messages from a server `validation_error`
}

// A stable default: a new `{}` on every render would restart the effect below on every render, forever.
const NO_FIELDS: Record<string, string> = {};

export function OnboardingForm({ onSubmit, initial, busy = false, serverFields = NO_FIELDS }: OnboardingFormProps) {
  const [values, setValues] = useState<Values>(() => (initial ? toValues(initial) : EMPTY));
  const [touched, setTouched] = useState<Set<Key>>(() => new Set(initial ? Object.values(KEY_OF) : []));
  const [submitted, setSubmitted] = useState(false);
  const [edited, setEdited] = useState<Set<string>>(new Set()); // server messages the athlete has since edited away
  // The optional parts start folded. A pre-filled form opens the parts that hold a saved answer, so none is hidden.
  const [open, setOpen] = useState<Record<PartId, boolean>>(() => {
    const v = initial ? toValues(initial) : EMPTY;
    return {
      plan: !blank(v.existingRunningPlan),
      week: !(blank(v.runningSessions) && blank(v.crossfitSessions) && blank(v.runningKm)),
      event: !(blank(v.eventName) && blank(v.eventDate)),
    };
  });
  // Focus is moved only to a field with an error the athlete has not seen yet; otherwise the view's heading gets it (App).
  // A closed optional part that holds such a field is opened first, and the focus follows once it is open.
  const [focusRequest, setFocusRequest] = useState<{ keys: ReadonlySet<string> } | null>(null);
  const reveal = (keys: ReadonlySet<string>) => {
    setOpen((o) => {
      const next = { ...o };
      for (const key of keys) { const id = PART_OF_KEY[key as Key]; if (id) next[id] = true; }
      return next;
    });
    setFocusRequest({ keys });
  };
  // A group with one message (the event, the usual week) focuses the field that needs the athlete: the first one left blank.
  const focusIdFor = (key: Key): string => {
    if (key === 'targetEvent') return blank(values.eventName) ? 'f-eventName' : 'f-eventDate';
    if (key === 'weeklyTraining') return blank(values.runningSessions) ? 'f-runningSessions' : blank(values.crossfitSessions) ? 'f-crossfitSessions' : 'f-runningKm';
    return FOCUS_ID[key];
  };
  useEffect(() => { if (focusRequest) focusFirstField(focusRequest.keys, focusIdFor); }, [focusRequest]);
  useEffect(() => {
    setEdited(new Set());
    if (serverFields !== NO_FIELDS) reveal(new Set(Object.keys(serverFields)));
  }, [serverFields]);
  useEffect(() => {
    if (!initial) return;
    const checked = validateOnboarding(toInput(toValues(initial)));
    if (!checked.ok) reveal(new Set(Object.keys(checked.fields)));
  }, [initial]);

  const result = validateOnboarding(toInput(values));
  const own = result.ok ? {} : result.fields;
  const message = (key: Key): string | undefined => {
    if (submitted || touched.has(key)) if (own[key]) return own[key];
    return edited.has(key) ? undefined : serverFields[key];
  };
  // The four required answers, by the validator's own verdict: goal, both levels, and a training day or a pasted plan.
  const answersDone = [!own.goal, !own.runningLevel, !own.crossfitLevel, !(own.runningDays || own.crossfitDays)].filter(Boolean).length;
  const placed = new Set<string>(Object.values(KEY_OF));
  const unplaced = Object.entries(serverFields).filter(([k]) => !placed.has(k)); // fields this form has no place for (shown, never hidden)

  const touch = (name: keyof Values) => setTouched((t) => new Set(t).add(KEY_OF[name]));
  const change = <K extends keyof Values>(name: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
    touch(name);
    setEdited((e) => new Set(e).add(KEY_OF[name]));
  };
  const toggleDay = (name: 'runningDays' | 'crossfitDays', day: Day) =>
    change(name, values[name].includes(day) ? values[name].filter((d) => d !== day) : [...values[name], day]);

  const errorLine = (id: string, error: string) => <p id={id} className="m-0 mt-1.5 text-sm font-semibold text-error">{error}</p>;

  const text = (name: keyof Values, label: string, props: { multiline?: boolean; type?: string; grouped?: boolean } = {}) => {
    const key = KEY_OF[name];
    const error = props.grouped ? undefined : message(key); // a grouped input shares one message, shown under its group
    const id = `f-${name}`;
    const common = {
      id, value: values[name] as string, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined,
      onChange: (e: { target: { value: string } }) => change(name, e.target.value as never), onBlur: () => touch(name),
    };
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {props.multiline ? <Textarea {...common} /> : <Input type={props.type ?? 'text'} {...common} />}
        {error && errorLine(`${id}-error`, error)}
      </div>
    );
  };

  // A group of native radios drawn as a segmented control: the input covers its label and the span shows the state.
  const level = (name: 'runningLevel' | 'crossfitLevel', label: string) => {
    const error = message(name);
    return (
      <fieldset id={`f-${name}`} aria-invalid={error ? true : undefined} aria-describedby={error ? `f-${name}-error` : undefined} className="m-0 min-w-0 border-0 p-0">
        <legend className="p-0 text-sm font-semibold">{label}</legend>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
          {LEVELS.map((option) => (
            <label key={option.id} className="relative font-semibold">
              <input
                type="radio" name={name} value={option.id} checked={values[name] === option.id}
                onChange={() => change(name, option.id)} onBlur={() => touch(name)}
                className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
              />
              <span className="grid h-11 pointer-fine:h-9 place-items-center rounded-md text-base text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        {error && errorLine(`f-${name}-error`, error)}
      </fieldset>
    );
  };

  // Seven native checkboxes drawn as toggle buttons.
  const days = (name: 'runningDays' | 'crossfitDays', legend: string): ReactNode => {
    const error = message(name);
    return (
      <fieldset id={`f-${name}`} aria-invalid={error ? true : undefined} aria-describedby={error ? `f-${name}-error` : undefined} className="m-0 min-w-0 border-0 p-0">
        <legend className="p-0 text-sm font-semibold">{legend}</legend>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {DAYS.map(({ id, label }) => (
            <label key={id} className="relative font-semibold">
              <input
                type="checkbox" checked={values[name].includes(id)} onChange={() => toggleDay(name, id)}
                className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
              />
              <span className="grid h-11 pointer-fine:h-9 min-w-6 place-items-center rounded-md border border-border bg-card text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                {label}
              </span>
            </label>
          ))}
        </div>
        {error && errorLine(`f-${name}-error`, error)}
      </fieldset>
    );
  };

  const section = (id: string, title: string, hint: string, children: ReactNode) => (
    <Card className="grid gap-4">
      <div>
        <h3 id={id} className="m-0 text-lg font-bold">{title}</h3>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </Card>
  );

  // A folded optional part. The summary's click is handled here, so the state is the single source of whether it is
  // open (the fields stay mounted and keep their values while it is closed).
  const part = (id: PartId, title: string, children: ReactNode) => (
    <details open={open[id]} className="rounded-lg border border-border bg-card shadow-card">
      <summary
        onClick={(e) => { e.preventDefault(); setOpen((o) => ({ ...o, [id]: !o[id] })); }}
        className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
      >
        {title}
        <span className="ml-auto text-sm font-medium text-muted-foreground">Optional</span>
        <span aria-hidden="true" className="w-4 text-center text-xl text-muted-foreground">{open[id] ? '–' : '+'}</span>
      </summary>
      <div className="grid gap-4 px-4 pb-4">{children}</div>
    </details>
  );

  const pasted = !blank(values.existingRunningPlan);
  const weeklyError = message('weeklyTraining');
  const eventError = message('targetEvent');

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (result.ok) onSubmit(result.value);
        else reveal(new Set(Object.keys(result.fields))); // open any folded part with a problem, then focus the first one
      }}
    >
      <div className="grid gap-2">
        <p className="m-0 text-sm font-semibold text-muted-foreground">{answersDone} of 4 required answers done</p>
        <div role="presentation" className="h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary" style={{ width: `${answersDone * 25}%` }} />
        </div>
      </div>
      {section('sec-goal', 'Your goal', 'What do you want to achieve?', <>
        {text('goal', 'Goal', { multiline: true })}
        {blank(values.goal) && (
          <div role="group" aria-label="Quick ideas" className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <Button
                key={idea} type="button" variant="secondary" className="rounded-full px-3 text-sm"
                onClick={() => { change('goal', idea); document.getElementById('f-goal')?.focus(); }}
              >
                {idea}
              </Button>
            ))}
          </div>
        )}
      </>)}
      {section('sec-level', 'Your level', 'Be honest, it sets how hard the plan is.', <>
        {level('runningLevel', 'Running level')}
        {level('crossfitLevel', 'CrossFit level')}
      </>)}
      {section('sec-week', 'Your week', 'Pick every day you can train. Both can share a day.', <>
        {days('runningDays', 'Running days')}
        {days('crossfitDays', 'CrossFit days')}
      </>)}
      {section('sec-pain', 'Pain or injury', 'Leave empty if none. If you have any, say where and when.', text('injuries', 'Injuries or pain (leave empty if none)', { multiline: true }))}
      {part('plan', 'I already follow a running plan', <>
        {text('existingRunningPlan', 'Your running plan (optional: paste it and the coach keeps your sessions)', { multiline: true })}
        {pasted && text('pastedPlanWeek', 'Week of your plan to use (default 1)', { type: 'number' })}
      </>)}
      {part('week', 'My usual week', <fieldset aria-invalid={weeklyError ? true : undefined} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <legend className="sr-only">Your usual week</legend>
        {text('runningSessions', 'Running sessions per week', { type: 'number', grouped: true })}
        {text('crossfitSessions', 'CrossFit sessions per week', { type: 'number', grouped: true })}
        {text('runningKm', 'Running km per week', { type: 'number', grouped: true })}
        {weeklyError && errorLine('f-weeklyTraining-error', weeklyError)}
      </fieldset>)}
      {part('event', 'Target event', <fieldset aria-invalid={eventError ? true : undefined} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <legend className="sr-only">Your target event</legend>
        {text('eventName', 'Event name', { grouped: true })}
        {text('eventDate', 'Event date', { type: 'date', grouped: true })}
        {eventError && errorLine('f-targetEvent-error', eventError)}
      </fieldset>)}
      {unplaced.map(([k, m]) => errorLine(`f-${k}-error`, m))}
      {/* Pinned to the bottom of the screen while the form scrolls; it is in the page flow, so it never covers a field. */}
      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button type="submit" disabled={busy} className="w-full">Build my plan</Button>
      </div>
    </form>
  );
}
