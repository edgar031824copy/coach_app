import { useEffect, useState, type ReactNode } from 'react';
import { validateOnboarding, type Day, type Onboarding } from 'shared';

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
export const FORM_FIELD_KEYS: ReadonlySet<string> = new Set(PAGE_ORDER);

// Focuses the first field, in page order, whose key is in `keys`. Returns whether one took focus.
function focusFirstField(keys: ReadonlySet<string>): boolean {
  for (const key of PAGE_ORDER) {
    if (!keys.has(key)) continue;
    const el = document.getElementById(FOCUS_ID[key]);
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
  // Focus is moved only to a field with an error the athlete has not seen yet; otherwise the view's heading gets it (App).
  useEffect(() => {
    setEdited(new Set());
    if (serverFields !== NO_FIELDS) focusFirstField(new Set(Object.keys(serverFields)));
  }, [serverFields]);
  useEffect(() => {
    if (!initial) return;
    const checked = validateOnboarding(toInput(toValues(initial)));
    if (!checked.ok) focusFirstField(new Set(Object.keys(checked.fields)));
  }, [initial]);

  const result = validateOnboarding(toInput(values));
  const own = result.ok ? {} : result.fields;
  const message = (key: Key): string | undefined => {
    if (submitted || touched.has(key)) if (own[key]) return own[key];
    return edited.has(key) ? undefined : serverFields[key];
  };
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

  const text = (name: keyof Values, label: string, props: { multiline?: boolean; type?: string; grouped?: boolean } = {}) => {
    const key = KEY_OF[name];
    const error = props.grouped ? undefined : message(key); // a grouped input shares one message, shown under its group
    const id = `f-${name}`;
    const common = {
      id, value: values[name] as string, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined,
      onChange: (e: { target: { value: string } }) => change(name, e.target.value as never), onBlur: () => touch(name),
    };
    return (
      <div className="field">
        <label htmlFor={id}>{label}</label>
        {props.multiline ? <textarea rows={3} {...common} /> : <input type={props.type ?? 'text'} {...common} />}
        {error && <p id={`${id}-error`} className="error">{error}</p>}
      </div>
    );
  };

  const level = (name: 'runningLevel' | 'crossfitLevel', label: string) => {
    const error = message(name);
    return (
      <div className="field">
        <label htmlFor={`f-${name}`}>{label}</label>
        <select id={`f-${name}`} value={values[name]} aria-invalid={error ? true : undefined} onChange={(e) => change(name, e.target.value)} onBlur={() => touch(name)}>
          <option value="">Choose…</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        {error && <p className="error">{error}</p>}
      </div>
    );
  };

  const days = (name: 'runningDays' | 'crossfitDays', legend: string): ReactNode => {
    const error = message(name);
    return (
      <fieldset id={`f-${name}`} aria-invalid={error ? true : undefined}>
        <legend>{legend}</legend>
        <div className="days">
          {DAYS.map(({ id, label }) => (
            <label key={id} className="day">
              <input type="checkbox" checked={values[name].includes(id)} onChange={() => toggleDay(name, id)} /> {label}
            </label>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </fieldset>
    );
  };

  const pasted = !blank(values.existingRunningPlan);
  const weeklyError = message('weeklyTraining');
  const eventError = message('targetEvent');

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (result.ok) onSubmit(result.value);
      }}
    >
      {text('goal', 'Goal', { multiline: true })}
      {level('runningLevel', 'Running level')}
      {level('crossfitLevel', 'CrossFit level')}
      {text('injuries', 'Injuries or pain (leave empty if none)', { multiline: true })}
      {days('runningDays', 'Running days')}
      {days('crossfitDays', 'CrossFit days')}
      {text('existingRunningPlan', 'Your running plan (optional: paste it and the coach keeps your sessions)', { multiline: true })}
      {pasted && text('pastedPlanWeek', 'Week of your plan to use (default 1)', { type: 'number' })}
      <fieldset aria-invalid={weeklyError ? true : undefined}>
        <legend>Your usual week (optional)</legend>
        {text('runningSessions', 'Running sessions per week', { type: 'number', grouped: true })}
        {text('crossfitSessions', 'CrossFit sessions per week', { type: 'number', grouped: true })}
        {text('runningKm', 'Running km per week', { type: 'number', grouped: true })}
        {weeklyError && <p className="error">{weeklyError}</p>}
      </fieldset>
      <fieldset aria-invalid={eventError ? true : undefined}>
        <legend>Target event (optional)</legend>
        {text('eventName', 'Event name', { grouped: true })}
        {text('eventDate', 'Event date', { type: 'date', grouped: true })}
        {eventError && <p className="error">{eventError}</p>}
      </fieldset>
      {unplaced.map(([k, m]) => <p key={k} className="error">{m}</p>)}
      <button type="submit" disabled={busy}>Build my plan</button>
    </form>
  );
}
