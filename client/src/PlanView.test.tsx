import { describe, it, expect, afterEach } from 'vitest';
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
  weekStart: '2026-11-09',
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
    expect(screen.queryByText(/week \d+ of your running plan/i)).toBeNull(); // "Week of 9 Nov" (the plan's own week) is always shown
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

// Task 2.3: the rebuilt plan view: summary card, day cards with icon tiles, the safety note first.
describe('PlanView: summary of the week', () => {
  const summary = () => within(screen.getByRole('group', { name: 'Week summary' }));
  const stat = (text: string) => summary().getByText((_, el) => el?.tagName === 'P' && el.textContent === text);

  it('counts runs, CrossFit sessions and rest days from the plan @spec(plan-presentation/summary-of-the-week/counts-match-the-plan)', () => {
    render(<PlanView record={record({
      mon: [s('running', 'Easy'), s('crossfit', 'WOD')], tue: [s('crossfit', 'Skills')], wed: [s('running', 'Tempo'), s('crossfit', 'Strength')],
      thu: [s('crossfit', 'Metcon')], fri: [s('running', 'Long')], sat: [s('crossfit', 'Team WOD')],
    })} />);
    expect(stat('3 runs')).toBeTruthy();
    expect(stat('5 CrossFit')).toBeTruthy();
    expect(stat('1 rest day')).toBeTruthy();
  });

  it('uses the singular for 1 and the plural otherwise, and always "CrossFit" @spec(plan-presentation/summary-of-the-week/counts-match-the-plan)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy')] })} />);
    expect(stat('1 run')).toBeTruthy();
    expect(stat('0 CrossFit')).toBeTruthy();
    expect(stat('6 rest days')).toBeTruthy();
  });

  it('counts both sessions of a day and does not call that day a rest day @spec(plan-presentation/summary-of-the-week/two-sessions-on-a-day-count-twice)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy'), s('crossfit', 'WOD')] })} />);
    expect(stat('1 run')).toBeTruthy();
    expect(stat('1 CrossFit')).toBeTruthy();
    expect(stat('6 rest days')).toBeTruthy();
  });

  it('shows the week label for a known week and none for a null week @spec(plan-presentation/summary-of-the-week/week-label)', () => {
    const { unmount } = render(<PlanView record={record({}, { pastedPlanWeek: 3 })} />);
    expect(screen.getByText('Week 3 of your running plan')).toBeTruthy();
    unmount();
    render(<PlanView record={record({})} />);
    expect(screen.queryByText(/of your running plan/)).toBeNull();
  });
});

// Task 2.3 (coach-plan-week-and-delete): the week the plan is for and the day it was made, for every plan.
describe('PlanView: the week and the date made', () => {
  const realTz = process.env.TZ;
  afterEach(() => {
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  });
  // The zone is set through TZ; the offset check proves it really moved, so a test cannot pass by accident.
  const inZone = (tz: string, offsetMinutes: number, at: string) => {
    process.env.TZ = tz;
    expect(-new Date(at).getTimezoneOffset() + 0).toBe(offsetMinutes); // + 0 turns the -0 of UTC into 0
  };
  const made = (weekStart: string, createdAt: string, extra: Parameters<typeof record>[1] = {}): PlanRecord => ({ ...record({}, extra), weekStart, createdAt });

  it('shows "Week of 23 Nov" and "Made 26 Nov" @spec(plan-presentation/summary-of-the-week/week-and-date-made-are-shown)', () => {
    inZone('UTC', 0, '2026-11-26T12:00:00Z');
    render(<PlanView record={made('2026-11-23', '2026-11-26T12:00:00Z')} />);
    expect(screen.getByText('Week of 23 Nov')).toBeTruthy();
    expect(screen.getByText('Made 26 Nov')).toBeTruthy();
  });

  it('shows both without a pasted plan, and no "of your running plan" label @spec(plan-presentation/summary-of-the-week/shown-without-a-pasted-plan)', () => {
    inZone('UTC', 0, '2026-11-26T12:00:00Z');
    render(<PlanView record={made('2026-11-23', '2026-11-26T12:00:00Z', { pastedPlanWeek: null })} />);
    expect(screen.getByText('Week of 23 Nov')).toBeTruthy();
    expect(screen.getByText('Made 26 Nov')).toBeTruthy();
    expect(screen.queryByText(/of your running plan/)).toBeNull();
  });

  it('shows both week labels with a pasted plan @spec(plan-presentation/summary-of-the-week/both-week-labels-with-a-pasted-plan)', () => {
    inZone('UTC', 0, '2026-11-26T12:00:00Z');
    render(<PlanView record={made('2026-11-23', '2026-11-26T12:00:00Z', { pastedPlanWeek: 3 })} />);
    expect(screen.getByText('Week 3 of your running plan')).toBeTruthy();
    expect(screen.getByText('Week of 23 Nov')).toBeTruthy();
  });

  it('takes the week from weekStart and the date made from createdAt, not one from the other', () => {
    inZone('UTC', 0, '2026-11-13T10:00:00Z');
    render(<PlanView record={made('2026-12-28', '2026-11-13T10:00:00Z')} />);
    expect(screen.getByText('Week of 28 Dec')).toBeTruthy();
    expect(screen.getByText('Made 13 Nov')).toBeTruthy();
  });

  it('shows the date made in the athlete\'s calendar: 23:30 UTC with a zone two hours ahead is the next day @spec(plan-presentation/summary-of-the-week/date-made-is-in-the-athletes-calendar)', () => {
    inZone('Europe/Athens', 120, '2026-11-26T23:30:00Z');
    render(<PlanView record={made('2026-11-23', '2026-11-26T23:30:00Z')} />);
    expect(screen.getByText('Made 27 Nov')).toBeTruthy();
    expect(screen.getByText('Week of 23 Nov')).toBeTruthy(); // the week is a date, not an instant: it never moves with the zone
  });

  it('uses three-letter English month names, "Sep" for September @spec(plan-presentation/summary-of-the-week/month-names-have-three-letters)', () => {
    inZone('UTC', 0, '2026-09-10T12:00:00Z');
    render(<PlanView record={made('2026-09-07', '2026-09-10T12:00:00Z')} />);
    expect(screen.getByText('Week of 7 Sep')).toBeTruthy();
    expect(screen.getByText('Made 10 Sep')).toBeTruthy();
  });

  it('keeps the week line inside the summary card, before the counts', () => {
    inZone('UTC', 0, '2026-11-26T12:00:00Z');
    render(<PlanView record={made('2026-11-23', '2026-11-26T12:00:00Z')} />);
    const week = screen.getByText('Week of 23 Nov');
    const counts = screen.getByRole('group', { name: 'Week summary' });
    expect(week.compareDocumentPosition(counts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(week.closest('section')).toBe(counts.closest('section'));
  });
});

describe('PlanView: day cards', () => {
  it('shows a rest day in the quieter style and a training day in the normal card @spec(plan-presentation/one-card-per-day-in-week-order/rest-day)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km')] })} />);
    const rest = within(dayItem('Tuesday')).getByText('Rest day').closest('[data-slot="card"]');
    expect(rest?.className).toContain('border-dashed');
    expect(dayItem('Monday').querySelector('[data-slot="card"]')?.className).not.toContain('border-dashed');
    expect(within(dayItem('Tuesday')).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('keeps the combined-load note inside the card of its day @spec(plan-presentation/one-card-per-day-in-week-order/combined-load-note-stays-with-its-day)', () => {
    render(<PlanView record={record({ thu: [s('running', 'Tempo'), s('crossfit', 'WOD')] }, { notes: { thu: 'Run first.' } })} />);
    expect(dayItem('Thursday').querySelector('[data-slot="card"]')?.textContent).toContain('Run first.');
  });

  it('keeps the seven days in week order @spec(plan-presentation/one-card-per-day-in-week-order/days-in-week-order)', () => {
    render(<PlanView record={record({}, { order: ['sun', 'sat', 'fri', 'thu', 'wed', 'tue', 'mon'] })} />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(FULL);
  });

  it('names each session by text and adds an icon as a cue only @spec(plan-presentation/sessions-are-identified-by-text/discipline-and-intensity-are-text)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km', 'coach', 'easy')], tue: [s('crossfit', 'Strength', 'coach', 'hard')] })} />);
    for (const [day, discipline, intensity] of [['Monday', 'Running', 'Easy'], ['Tuesday', 'CrossFit', 'Hard']] as const) {
      const card = within(dayItem(day));
      expect(card.getByText(discipline)).toBeTruthy();
      expect(card.getByText(intensity)).toBeTruthy();
      const icon = dayItem(day).querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(dayItem('Wednesday').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true'); // the rest day's moon
  });

  it('gives a running session and a CrossFit session different icon tiles, text staying the same', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km')], tue: [s('crossfit', 'Strength')] })} />);
    const tile = (day: string) => dayItem(day).querySelector('svg')?.parentElement?.className ?? '';
    expect(tile('Monday')).toContain('bg-run-soft');
    expect(tile('Tuesday')).toContain('bg-crossfit-soft');
  });

  it('shows a 400-character description in full @spec(plan-presentation/sessions-are-identified-by-text/long-text-is-not-cut-off)', () => {
    const long = 'word '.repeat(80).trim();
    render(<PlanView record={record({ mon: [s('running', long)] })} />);
    expect(within(dayItem('Monday')).getByText(long)).toBeTruthy();
    expect(within(dayItem('Monday')).getByText(long).className).toContain('break-words');
  });
});

describe('PlanView: the safety note comes first', () => {
  const note = 'This coach is not a clinician. Please see a qualified professional.';
  const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('precedes the summary and every day card, with a warning icon and its text @spec(plan-presentation/the-safety-note-comes-first/note-first) @spec(responsive-accessibility/contrast-and-signals/errors-and-the-safety-note-carry-text)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy')] }, { safetyNote: note })} />);
    const el = screen.getByRole('note', { name: 'Safety note' });
    expect(before(el, screen.getByRole('group', { name: 'Week summary' }))).toBe(true);
    for (const name of FULL) expect(before(el, dayItem(name))).toBe(true);
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(within(el).getByText(note)).toBeTruthy();
  });

  it('shows its text at least as large as a day card\'s text @spec(plan-presentation/the-safety-note-comes-first/note-first)', () => {
    render(<PlanView record={record({ mon: [s('running', 'Easy 5 km')] }, { safetyNote: note })} />);
    expect(within(screen.getByRole('note')).getByText(note).className).toContain('text-base');
    expect(within(dayItem('Monday')).getByText('Easy 5 km').className).toContain('text-base');
  });

  it('shows no note element when the plan has none @spec(plan-presentation/the-safety-note-comes-first/no-note-without-a-note)', () => {
    render(<PlanView record={record({})} />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText('Safety note')).toBeNull();
  });
});

describe('PlanView: labels and suggestions', () => {
  it('labels every session "from your plan" and shows no suggestions when there are none @spec(plan-presentation/the-safety-note-comes-first/only-the-athletes-sessions)', () => {
    render(<PlanView record={record({ mon: [s('running', '5 km easy', 'athlete')], wed: [s('running', '8 km tempo', 'athlete', 'moderate')] })} />);
    expect(screen.getAllByText('from your plan')).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Coach suggestions' })).toBeNull();
  });

  it('labels the athlete\'s session and each suggestion, and shows the athlete\'s text exactly as saved @spec(plan-presentation/sessions-are-identified-by-text/athlete-sessions-and-suggestions-are-labeled)', () => {
    const saved = '  5 km easy,   keep it   conversational ';
    render(<PlanView record={record({ mon: [s('running', saved, 'athlete')], tue: [s('crossfit', 'Strength')] }, { recommendations: ['Add a mobility session.'] })} />);
    expect(within(dayItem('Monday')).getByText('from your plan')).toBeTruthy();
    expect(within(dayItem('Tuesday')).queryByText('from your plan')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Coach suggestions' })).getByText('coach suggestion')).toBeTruthy();
    expect(dayItem('Monday').textContent).toContain(saved); // not trimmed, not reformatted
  });

  it('lists the suggestions with a "coach suggestion" label when no plan was pasted @spec(plan-presentation/the-safety-note-comes-first/suggestions-without-a-pasted-plan)', () => {
    render(<PlanView record={record({}, { recommendations: ['Walk on rest days.', 'Sleep more.'] })} />);
    const items = within(screen.getByRole('list', { name: 'Coach suggestions' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) expect(within(item).getByText('coach suggestion')).toBeTruthy();
    expect(screen.queryByText(/of your running plan/)).toBeNull();
  });

  it('keeps the accessible names: a region "Your plan", seven days, the suggestions list, the note @spec(app-views/labels-named-by-the-e1-specs-keep-their-wording/accessible-names-are-kept)', () => {
    render(<PlanView record={record({}, { safetyNote: 'Careful.', recommendations: ['Rest.'] })} />);
    const region = screen.getByRole('region', { name: 'Your plan' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Your plan' })).toBeTruthy();
    for (const name of FULL) expect(within(region).getByRole('listitem', { name })).toBeTruthy();
    expect(within(region).getByRole('list', { name: 'Coach suggestions' })).toBeTruthy();
    expect(within(region).getByRole('note', { name: 'Safety note' })).toBeTruthy();
  });
});

// Review fix: Tailwind's reset is off, so lists and text elements keep the browser's markers, indent and margins unless
// the markup removes them. jsdom cannot see that; this checks that the markup does.
describe('PlanView: no browser default spacing or markers', () => {
  const full = () => render(<PlanView record={record({ mon: [s('running', 'Easy', 'athlete'), s('crossfit', 'WOD')] }, { notes: { mon: 'Run first.' }, safetyNote: 'Careful.', recommendations: ['Rest.'], pastedPlanWeek: 2 })} />).container;

  it('strips the marker and the indent from every list', () => {
    for (const list of full().querySelectorAll('ul, ol')) {
      expect(list.className.split(/\s+/), list.outerHTML.slice(0, 60)).toEqual(expect.arrayContaining(['list-none', 'm-0', 'p-0']));
    }
  });

  it('sets the margin of every paragraph and heading itself', () => {
    for (const el of full().querySelectorAll('p, h2, h3')) {
      expect(el.className.split(/\s+/), el.outerHTML.slice(0, 60)).toContain('m-0');
    }
  });

  it('shows a combined-load note on a day with no sessions, inside that day\'s card @spec(plan-presentation/one-card-per-day-in-week-order/combined-load-note-stays-with-its-day)', () => {
    render(<PlanView record={record({}, { notes: { sat: 'Keep it light.' } })} />);
    expect(dayItem('Saturday').querySelector('[data-slot="card"]')?.textContent).toContain('Keep it light.');
    expect(within(dayItem('Saturday')).getByText('Rest day')).toBeTruthy();
  });
});
