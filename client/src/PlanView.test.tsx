import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Day, PlanRecord, PlanDay, Session } from 'shared';
import { PlanView } from './PlanView.js';
import { onboarding, planResponse } from './test-helpers.js';

const ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const s = (discipline: Session['discipline'], description: string, source: Session['source'] = 'coach', intensity: Session['intensity'] = 'easy'): Session => ({ discipline, description, intensity, source });

// A plan record with the given sessions per day; every other day is empty (a rest day). `days` can be reordered by the caller.
const record = (
  sessions: Partial<Record<Day, Session[]>> = {},
  extra: { notes?: Partial<Record<Day, string>>; recommendations?: string[]; safetyNote?: string | null; pastedPlanWeek?: number | null; order?: Day[] } = {},
): PlanRecord => ({
  id: 1,
  createdAt: '2026-11-13T10:00:00.000Z',
  onboarding: { ...onboarding, pastedPlanWeek: extra.pastedPlanWeek ?? null },
  plan: {
    days: (extra.order ?? ORDER).map((day): PlanDay => ({ day, sessions: sessions[day] ?? [], combinedLoadNote: extra.notes?.[day] ?? null })),
    recommendations: extra.recommendations ?? [],
    safetyNote: extra.safetyNote ?? null,
  },
});

const dayItem = (name: string) => screen.getByRole('listitem', { name });
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

describe('PlanView: the days', () => {
  it('shows the seven days in order Monday to Sunday, whatever order the plan lists them @spec(plan-storage/day-by-day-view/seven-days-in-order)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km')] }, { order: ['sun', 'wed', 'mon', 'sat', 'thu', 'tue', 'fri'] })} />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(FULL);
  });

  it('shows a day with no sessions as a rest day, and a day with sessions as not one @spec(plan-storage/day-by-day-view/rest-day)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km')], tue: [s('crossfit', 'Strength', 'coach', 'moderate')] })} />);
    expect(within(dayItem('Wednesday')).getByText('Rest day')).toBeTruthy();
    expect(within(dayItem('Monday')).queryByText('Rest day')).toBeNull();
    expect(screen.getAllByText('Rest day')).toHaveLength(5);
  });

  it('shows each session with its discipline, description and intensity', () => {
    render(<PlanView record={record({ tue: [s('crossfit', 'Strength and skills', 'coach', 'hard')], mon: [s('running', 'Easy 5 km', 'coach', 'easy')] })} />);
    const tue = within(dayItem('Tuesday'));
    expect(tue.getByText('CrossFit')).toBeTruthy();
    expect(tue.getByText('Strength and skills')).toBeTruthy();
    expect(tue.getByText('Hard')).toBeTruthy();
    expect(within(dayItem('Monday')).getByText('Running')).toBeTruthy();
    expect(within(dayItem('Monday')).getByText('Easy')).toBeTruthy();
  });

  it('shows two sessions on one day with the combined-load note', () => {
    const note = 'Run easy first, then CrossFit after a few hours.';
    render(<PlanView record={record({ thu: [s('running', 'Tempo 6 km', 'coach', 'moderate'), s('crossfit', 'WOD')] }, { notes: { thu: note } })} />);
    const thu = within(dayItem('Thursday'));
    expect(thu.getByText('Tempo 6 km')).toBeTruthy();
    expect(thu.getByText('WOD')).toBeTruthy();
    expect(thu.getByText(note)).toBeTruthy();
    expect(within(dayItem('Friday')).queryByText(note)).toBeNull();
  });
});

describe('PlanView: week number', () => {
  it('shows the week number when the plan was made from a pasted plan @spec(plan-storage/day-by-day-view/week-number-for-a-pasted-plan)', () => {
    render(<PlanView record={record({}, { pastedPlanWeek: 4 })} />);
    expect(screen.getByText(/week 4/i)).toBeTruthy();
  });

  it('shows no week number when no plan was pasted', () => {
    render(<PlanView record={record({})} />);
    expect(screen.queryByText(/week/i)).toBeNull();
  });
});

describe('PlanView: labels and recommendations', () => {
  const pasted = record(
    { mon: [s('running', '5 km easy', 'athlete')], wed: [s('running', '8 km tempo', 'athlete', 'moderate')], tue: [s('crossfit', 'Strength')] },
    { recommendations: ['Add a mobility session on Thursday.', 'Sleep 8 hours before the tempo run.'], pastedPlanWeek: 1 },
  );

  it('labels each pasted session "from your plan" and no coach session @spec(running-plan-import/labels-and-recommendations/athlete-sessions-are-labeled)', () => {
    render(<PlanView record={pasted} />);
    expect(within(dayItem('Monday')).getByText('from your plan')).toBeTruthy();
    expect(within(dayItem('Wednesday')).getByText('from your plan')).toBeTruthy();
    expect(within(dayItem('Tuesday')).queryByText('from your plan')).toBeNull();
    expect(screen.getAllByText('from your plan')).toHaveLength(2);
  });

  it('labels every recommendation "coach suggestion" and shows the pasted sessions exactly as pasted @spec(running-plan-import/labels-and-recommendations/recommendations-never-change-sessions)', () => {
    render(<PlanView record={pasted} />);
    const list = screen.getByRole('list', { name: 'Coach suggestions' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(within(item).getByText('coach suggestion')).toBeTruthy();
    expect(within(items[0]!).getByText('Add a mobility session on Thursday.')).toBeTruthy();
    expect(within(dayItem('Monday')).getByText('5 km easy')).toBeTruthy(); // untouched by the suggestions
    expect(within(dayItem('Wednesday')).getByText('8 km tempo')).toBeTruthy();
    expect(within(dayItem('Thursday')).getByText('Rest day')).toBeTruthy(); // a suggestion does not add a session
  });

  it('shows no suggestions section when there are none', () => {
    render(<PlanView record={record({})} />);
    expect(screen.queryByRole('list', { name: 'Coach suggestions' })).toBeNull();
    expect(screen.queryByText('coach suggestion')).toBeNull();
  });
});

describe('PlanView: safety note', () => {
  it('shows the safety note when pain was reported @spec(safety/safety-note-when-pain-is-reported/pain-reported-with-a-note)', () => {
    const note = 'This coach is not a clinician. Please see a qualified professional.';
    render(<PlanView record={record({}, { safetyNote: note })} />);
    expect(within(screen.getByRole('note', { name: 'Safety note' })).getByText(note)).toBeTruthy();
  });

  it('shows no safety note when there is none', () => {
    render(<PlanView record={record({})} />);
    expect(screen.queryByRole('note', { name: 'Safety note' })).toBeNull();
  });

  it('shows text from the plan as text, never as markup', () => {
    render(<PlanView record={record({ mon: [s('running', '<img src=x onerror=alert(1)>')] }, { safetyNote: '<b>bold</b>' })} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('b')).toBeNull();
  });
});

describe('PlanView: accepts a full plan response too', () => {
  it('renders a PlanResponse (a record plus remainingCallsToday)', () => {
    render(<PlanView record={planResponse} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
  });
});
