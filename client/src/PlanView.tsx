import type { Ref } from 'react';
import type { Day, PlanRecord, Session } from 'shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BarbellIcon, MoonIcon, RouteIcon, WarningIcon } from '@/components/icons';

// The server checks that all seven days are present, not their order, so the view puts them in order itself.
const DAYS: { id: Day; name: string }[] = [
  { id: 'mon', name: 'Monday' }, { id: 'tue', name: 'Tuesday' }, { id: 'wed', name: 'Wednesday' }, { id: 'thu', name: 'Thursday' },
  { id: 'fri', name: 'Friday' }, { id: 'sat', name: 'Saturday' }, { id: 'sun', name: 'Sunday' },
];
const DISCIPLINE: Record<Session['discipline'], string> = { running: 'Running', crossfit: 'CrossFit' };
const INTENSITY: Record<Session['intensity'], string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

const ICON = { running: RouteIcon, crossfit: BarbellIcon };
const TILE = { running: 'bg-run-soft text-run', crossfit: 'bg-crossfit-soft text-crossfit' };
const TILE_BASE = 'grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-5';
const plural = (n: number, one: string, many: string) => `${n === 1 ? one : many}`;

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <p className="rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="block text-xl font-extrabold leading-tight">{n}</span>
      {' '}
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </p>
  );
}

// A plan record, or a full plan response (which has the same fields and one more). Text from the plan is rendered as
// text by React, never as markup. The safety note comes first, then the summary, the seven days and the suggestions.
export function PlanView({ record, headingRef }: { record: PlanRecord; headingRef?: Ref<HTMLHeadingElement> }) {
  const { plan, onboarding } = record;
  const byDay = new Map(plan.days.map((d) => [d.day, d]));
  const sessionsOf = (id: Day) => byDay.get(id)?.sessions ?? [];
  const runs = DAYS.reduce((n, { id }) => n + sessionsOf(id).filter((x) => x.discipline === 'running').length, 0);
  const crossfit = DAYS.reduce((n, { id }) => n + sessionsOf(id).filter((x) => x.discipline === 'crossfit').length, 0);
  const rest = DAYS.filter(({ id }) => sessionsOf(id).length === 0).length;
  return (
    <section aria-labelledby="plan-heading" className="mt-4 grid gap-4">
      {plan.safetyNote !== null && (
        <Alert variant="danger" role="note" aria-label="Safety note">
          <WarningIcon aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">Safety note</p>
            <p className="break-words text-base">{plan.safetyNote}</p>
          </div>
        </Alert>
      )}

      <Card className="grid gap-3">
        <div>
          {onboarding.pastedPlanWeek !== null && <p className="text-sm font-semibold text-muted-foreground">Week {onboarding.pastedPlanWeek} of your running plan</p>}
          <h2 id="plan-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold leading-tight">Your plan</h2>
        </div>
        <div role="group" aria-label="Week summary" className="grid grid-cols-3 gap-2">
          <Stat n={runs} label={plural(runs, 'run', 'runs')} />
          <Stat n={crossfit} label="CrossFit" />
          <Stat n={rest} label={plural(rest, 'rest day', 'rest days')} />
        </div>
      </Card>

      <ol className="grid gap-3">
        {DAYS.map(({ id, name }) => {
          const day = byDay.get(id);
          const sessions = sessionsOf(id);
          return (
            <li key={id} aria-labelledby={`day-${id}`}>
              {sessions.length === 0 ? (
                <Card variant="quiet" className="flex items-center gap-3">
                  <span className={`${TILE_BASE} bg-secondary text-muted-foreground`}><MoonIcon /></span>
                  <div>
                    <h3 id={`day-${id}`} className="text-lg font-bold">{name}</h3>
                    <p className="text-base">Rest day</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <h3 id={`day-${id}`} className="mb-3 text-lg font-bold">{name}</h3>
                  <ul className="grid gap-3.5">
                    {sessions.map((session, i) => {
                      const Icon = ICON[session.discipline];
                      return (
                        <li key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
                          <span className={`${TILE_BASE} ${TILE[session.discipline]} row-span-2`}><Icon /></span>
                          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                            <span>{DISCIPLINE[session.discipline]}</span>
                            {session.source === 'athlete' && <Badge>from your plan</Badge>}
                          </p>
                          <p className="text-base">
                            <span className="break-words text-base">{session.description}</span> <Badge>{INTENSITY[session.intensity]}</Badge>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  {day?.combinedLoadNote && <p className="mt-3 break-words rounded-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">{day.combinedLoadNote}</p>}
                </Card>
              )}
            </li>
          );
        })}
      </ol>

      {plan.recommendations.length > 0 && (
        <div>
          <p id="suggestions-label" className="mb-2 text-lg font-bold">Coach suggestions</p>
          <ul aria-labelledby="suggestions-label" className="grid gap-2">
            {plan.recommendations.map((text, i) => (
              <li key={i} className="rounded-lg border border-border bg-card px-3.5 py-3 text-base">
                <Badge className="mb-1.5">coach suggestion</Badge>
                <p className="break-words">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
