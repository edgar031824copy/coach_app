import type { Ref } from 'react';
import type { Day, PlanRecord, Session } from 'shared';

// The server checks that all seven days are present, not their order, so the view puts them in order itself.
const DAYS: { id: Day; name: string }[] = [
  { id: 'mon', name: 'Monday' }, { id: 'tue', name: 'Tuesday' }, { id: 'wed', name: 'Wednesday' }, { id: 'thu', name: 'Thursday' },
  { id: 'fri', name: 'Friday' }, { id: 'sat', name: 'Saturday' }, { id: 'sun', name: 'Sunday' },
];
const DISCIPLINE: Record<Session['discipline'], string> = { running: 'Running', crossfit: 'CrossFit' };
const INTENSITY: Record<Session['intensity'], string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

// A plan record, or a full plan response (which has the same fields and one more). Text from the plan is rendered as
// text by React, never as markup. Layout and visual design are a later pass; this is the content and its structure.
export function PlanView({ record, headingRef }: { record: PlanRecord; headingRef?: Ref<HTMLHeadingElement> }) {
  const { plan, onboarding } = record;
  const byDay = new Map(plan.days.map((d) => [d.day, d]));
  return (
    <section aria-labelledby="plan-heading" className="plan">
      <h2 id="plan-heading" ref={headingRef} tabIndex={-1}>Your plan</h2>
      {onboarding.pastedPlanWeek !== null && <p className="plan-week">Week {onboarding.pastedPlanWeek} of your running plan</p>}

      {plan.safetyNote !== null && (
        <div role="note" aria-label="Safety note" className="safety-note">
          <p>{plan.safetyNote}</p>
        </div>
      )}

      <ol className="days-list">
        {DAYS.map(({ id, name }) => {
          const day = byDay.get(id);
          const sessions = day?.sessions ?? [];
          return (
            <li key={id} aria-labelledby={`day-${id}`} className="plan-day">
              <h3 id={`day-${id}`}>{name}</h3>
              {sessions.length === 0 ? (
                <p className="rest-day">Rest day</p>
              ) : (
                <ul>
                  {sessions.map((session, i) => (
                    <li key={i} className="session">
                      <span className="discipline">{DISCIPLINE[session.discipline]}</span>
                      <span className="description">{session.description}</span>
                      <span className="intensity">{INTENSITY[session.intensity]}</span>
                      {session.source === 'athlete' && <span className="tag">from your plan</span>}
                    </li>
                  ))}
                </ul>
              )}
              {day?.combinedLoadNote && <p className="combined-load"><span className="combined-load-note">{day.combinedLoadNote}</span></p>}
            </li>
          );
        })}
      </ol>

      {plan.recommendations.length > 0 && (
        <ul aria-label="Coach suggestions" className="recommendations">
          {plan.recommendations.map((text, i) => (
            <li key={i}>
              <span className="tag">coach suggestion</span> <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
