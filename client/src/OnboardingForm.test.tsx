import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from './OnboardingForm.js';
import { validateOnboarding, type Onboarding } from 'shared';
import { onboarding as base } from './test-helpers.js';

const setup = (props: Partial<Parameters<typeof OnboardingForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user };
};
const day = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name });
const level = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('radio', { name }) as HTMLInputElement;
// The optional parts are folded; the athlete opens one by pressing its title, as these tests do.
const PLAN_PART = 'I already follow a running plan';
const WEEK_PART = 'My usual week';
const EVENT_PART = 'Target event';
const part = (title: string) => screen.getByText(title, { selector: 'summary' }).closest('details') as HTMLDetailsElement;
const openPart = async (user: ReturnType<typeof userEvent.setup>, title: string) => { if (!part(title).open) await user.click(screen.getByText(title, { selector: 'summary' })); };
const submitButton = () => screen.getByRole('button', { name: /build my plan/i });

// Fills the smallest valid form.
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/goal/i), 'Run a half marathon');
  await user.click(level('Running level', 'Intermediate'));
  await user.click(level('CrossFit level', 'Beginner'));
  await user.click(day('Running days', 'Mon'));
  await user.click(day('Running days', 'Wed'));
  await user.click(day('CrossFit days', 'Tue'));
}

describe('OnboardingForm: instant feedback', () => {
  it('shows no error before the athlete has touched anything @spec(form-presentation/same-validation-and-behavior-as-e1/no-message-on-an-untouched-field)', () => {
    setup();
    expect(screen.queryByText(/is required/i)).toBeNull();
    expect(screen.getByLabelText(/goal/i).getAttribute('aria-invalid')).not.toBe('true');
  });

  it('shows the message for an empty goal as soon as the field is left, before any submit @spec(form-presentation/same-validation-and-behavior-as-e1/instant-message-after-leaving-a-field)', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByLabelText(/goal/i));
    await user.tab();
    expect(screen.getByText('Goal is required.')).toBeTruthy();
    expect(screen.getByLabelText(/goal/i).getAttribute('aria-invalid')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the limit message while typing a too-long goal, and clears it when fixed', async () => {
    const { user } = setup();
    const goal = screen.getByLabelText(/goal/i);
    fireEvent.change(goal, { target: { value: 'x'.repeat(501) } });
    expect(screen.getByText('Goal must be at most 500 characters.')).toBeTruthy();
    await user.clear(goal);
    await user.type(goal, 'Run');
    expect(screen.queryByText(/at most 500/)).toBeNull();
  });

  it('asks for a training day (or a pasted plan) once the athlete has touched a day field', async () => {
    const { user } = setup();
    await user.click(day('Running days', 'Mon'));
    await user.click(day('Running days', 'Mon')); // on, then off again: still nothing chosen
    expect(screen.getAllByText('Pick at least one training day, or paste a running plan.').length).toBeGreaterThan(0);
  });

  it('checks the event date and the weekly numbers as they are typed', async () => {
    const { user } = setup();
    await openPart(user, EVENT_PART);
    await openPart(user, WEEK_PART);
    await user.type(screen.getByLabelText(/event name/i), 'City Half');
    await user.type(screen.getByLabelText(/event date/i), '2020-01-01');
    expect(screen.getByText('The event date cannot be in the past (UTC).')).toBeTruthy();
    await user.type(screen.getByLabelText(/running sessions per week/i), '3');
    expect(screen.getByText('Weekly training sessions must be whole numbers.')).toBeTruthy(); // CrossFit count still empty
  });

  it('asks for the plan week only when a running plan is pasted', async () => {
    const { user } = setup();
    await openPart(user, PLAN_PART);
    expect(screen.queryByLabelText(/week of your plan/i)).toBeNull();
    await user.type(screen.getByLabelText(/running plan/i), 'Mon 5 km easy');
    expect(screen.getByLabelText(/week of your plan/i)).toBeTruthy();
  });
});

describe('OnboardingForm: submitting', () => {
  it('does not submit an invalid form and shows every problem at once', async () => {
    const { user, onSubmit } = setup();
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Goal is required.')).toBeTruthy();
    expect(screen.getByText('Choose your running level.')).toBeTruthy();
    expect(screen.getByText('Choose your CrossFit level.')).toBeTruthy();
    expect(screen.getAllByText('Pick at least one training day, or paste a running plan.').length).toBe(2);
  });

  it('submits a valid onboarding exactly as the shared schema expects, with the optional parts null', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      goal: 'Run a half marathon',
      runningLevel: 'intermediate',
      crossfitLevel: 'beginner',
      injuries: '',
      runningDays: ['mon', 'wed'],
      crossfitDays: ['tue'],
      existingRunningPlan: null,
      pastedPlanWeek: null,
      weeklyTraining: null,
      targetEvent: null,
    });
  });

  it('sends a trimmed pasted plan with its week, the weekly numbers and the target event when given', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    for (const title of [PLAN_PART, WEEK_PART, EVENT_PART]) await openPart(user, title);
    await user.type(screen.getByLabelText(/running plan/i), '  Week 3: Mon 5 km easy  ');
    await user.type(screen.getByLabelText(/week of your plan/i), '3');
    await user.type(screen.getByLabelText(/running sessions per week/i), '3');
    await user.type(screen.getByLabelText(/crossfit sessions per week/i), '2');
    await user.type(screen.getByLabelText(/km per week/i), '25.5');
    await user.type(screen.getByLabelText(/injuries/i), 'sore knee');
    await user.type(screen.getByLabelText(/event name/i), 'City Half');
    await user.type(screen.getByLabelText(/event date/i), '2099-12-06');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      existingRunningPlan: 'Week 3: Mon 5 km easy',
      pastedPlanWeek: 3,
      weeklyTraining: { runningSessions: 3, crossfitSessions: 2, runningKm: 25.5 },
      injuries: 'sore knee',
      targetEvent: { name: 'City Half', date: '2099-12-06' },
    }));
  });

  it('sends null for km when only the session counts are given (an empty box is not zero)', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await openPart(user, WEEK_PART);
    await user.type(screen.getByLabelText(/running sessions per week/i), '3');
    await user.type(screen.getByLabelText(/crossfit sessions per week/i), '2');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ weeklyTraining: { runningSessions: 3, crossfitSessions: 2, runningKm: null } }));
  });

  it('accepts a pasted plan instead of any training day', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/goal/i), 'Finish a 10k');
    await user.click(level('Running level', 'Beginner'));
    await user.click(level('CrossFit level', 'Beginner'));
    await openPart(user, PLAN_PART);
    await user.type(screen.getByLabelText(/running plan/i), 'Mon 5 km easy');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ runningDays: [], crossfitDays: [], existingRunningPlan: 'Mon 5 km easy' }));
  });

  it('is disabled while a request is running, so the same plan cannot be requested twice', async () => {
    setup({ busy: true });
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('OnboardingForm: server field errors', () => {
  it('shows each server message next to its own field @spec(form-presentation/same-validation-and-behavior-as-e1/server-field-error-on-its-field)', async () => {
    setup({ serverFields: { goal: 'Goal is required.', runningDays: 'runningDays lists a day more than once.', targetEvent: 'The event date cannot be in the past (UTC).' } });
    expect(within(screen.getByLabelText(/goal/i).closest('div')!).getByText('Goal is required.')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Running days' })).getByText('runningDays lists a day more than once.')).toBeTruthy();
    expect(screen.getByText('The event date cannot be in the past (UTC).')).toBeTruthy();
    expect(screen.queryByText(/CrossFit days.*more than once/)).toBeNull();
  });

  it('removes a server message once the athlete edits that field, leaving the others', async () => {
    const { user } = setup({ serverFields: { goal: 'Goal is required.', injuries: 'Injuries must be text (it may be empty).' } });
    await user.type(screen.getByLabelText(/goal/i), 'Run');
    expect(screen.queryByText('Goal is required.')).toBeNull();
    expect(screen.getByText('Injuries must be text (it may be empty).')).toBeTruthy();
  });

  it('shows a message for a field the form has no place for, instead of hiding it', () => {
    setup({ serverFields: { body: 'The request body must be a JSON object.' } });
    expect(screen.getByText('The request body must be a JSON object.')).toBeTruthy();
  });
});

describe('OnboardingForm: pre-filled from a saved onboarding', () => {
  const saved = {
    ...base,
    goal: 'Finish a 10k',
    injuries: 'sore knee',
    runningDays: ['mon', 'fri'] as const,
    crossfitDays: ['tue'] as const,
    existingRunningPlan: 'Week 5: Mon 5 km easy',
    pastedPlanWeek: 5,
    weeklyTraining: { runningSessions: 3, crossfitSessions: 2, runningKm: 25.5 },
    targetEvent: { name: 'City Half', date: '2099-12-06' },
  };

  it('shows every saved answer, and submitting it unchanged sends the same onboarding', async () => {
    const { user, onSubmit } = setup({ initial: { ...saved, runningDays: [...saved.runningDays], crossfitDays: [...saved.crossfitDays] } });
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('Finish a 10k');
    expect(level('Running level', 'Intermediate').checked).toBe(true);
    expect((day('Running days', 'Fri') as HTMLInputElement).checked).toBe(true);
    expect((day('Running days', 'Tue') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/week of your plan/i) as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText(/km per week/i) as HTMLInputElement).value).toBe('25.5');
    expect((screen.getByLabelText(/event date/i) as HTMLInputElement).value).toBe('2099-12-06');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith({ ...saved, runningDays: ['mon', 'fri'], crossfitDays: ['tue'] });
  });

  it('keeps empty optional answers null when pre-filled', async () => {
    const { user, onSubmit } = setup({ initial: { ...base, runningDays: ['mon'], goal: 'Run' } });
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ existingRunningPlan: null, pastedPlanWeek: null, weeklyTraining: null, targetEvent: null }));
  });

  it('shows a field error at once for a pre-filled value that is not allowed, such as week 53, and lets the athlete edit it @spec(plan-storage/plan-next-week/week-past-the-maximum) @spec(form-presentation/same-validation-and-behavior-as-e1/week-53-after-plan-next-week)', async () => {
    const { user, onSubmit } = setup({ initial: { ...saved, pastedPlanWeek: 53, runningDays: ['mon'], crossfitDays: [] } });
    expect(screen.getByText('The plan week must be a whole number from 1 to 52.')).toBeTruthy();
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/week of your plan/i));
    await user.type(screen.getByLabelText(/week of your plan/i), '52');
    expect(screen.queryByText(/plan week must be/)).toBeNull();
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

// Task 2.2: the form no longer grabs focus by itself. It moves focus to a field only when that field has an error the
// athlete has not seen yet: a pre-filled value that is not allowed, or a message from the server.
describe('OnboardingForm: focus', () => {
  it('moves no focus when it opens empty or pre-filled with valid values', () => {
    setup();
    expect(document.activeElement).toBe(document.body);
  });

  it('moves no focus for a valid pre-filled form (the view heading gets it instead) @spec(app-views/moving-between-views/focus-follows-the-view)', () => {
    setup({ initial: { ...base, runningDays: ['mon'] } });
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses the first field with an error when it opens pre-filled with a value that is not allowed @spec(app-views/moving-between-views/focus-goes-to-the-first-error-when-the-form-opens-with-one)', () => {
    setup({ initial: { ...base, existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 53 } });
    expect(document.activeElement).toBe(screen.getByLabelText(/week of your plan/i));
  });

  it('focuses the first invalid field in page order (the goal, before the injuries) when several are invalid', () => {
    setup({ initial: { ...base, goal: '', injuries: 'x'.repeat(3000) } });
    expect(document.activeElement).toBe(screen.getByLabelText(/goal/i));
  });

  it('focuses the first field named by a server error, in page order @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', () => {
    setup({ serverFields: { injuries: 'Injuries must be text.', goal: 'Goal is required.' } });
    expect(document.activeElement).toBe(screen.getByLabelText(/goal/i));
  });

  it('focuses the first day box when the server names a group of days @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', () => {
    setup({ serverFields: { crossfitDays: 'crossfitDays lists a day more than once.' } });
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: 'CrossFit days' })).getAllByRole('checkbox')[0]);
  });

  it('focuses nothing when the server names only a field this form has no place for', () => {
    setup({ serverFields: { body: 'The request body must be a JSON object.' } });
    expect(document.activeElement).toBe(document.body);
  });
});

// Task 3.1: the form's layout. Fields, values, validation and submit are E1's; these check the new structure.
describe('OnboardingForm: sections and folded optional parts', () => {
  it('shows four sections under headings, with the pain or injury field always visible @spec(form-presentation/sections-and-folded-optional-parts/four-sections)', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Your goal', 'Your level', 'Your week', 'Pain or injury']);
    const pain = screen.getByLabelText(/injuries or pain/i);
    expect(pain.closest('details')).toBeNull(); // not folded away
    const card = (heading: string) => screen.getByRole('heading', { level: 3, name: heading }).closest('[data-slot="card"]') as HTMLElement;
    expect(card('Pain or injury').contains(pain)).toBe(true);
    expect(card('Your goal').contains(screen.getByLabelText('Goal'))).toBe(true);
    expect(card('Your level').contains(screen.getByRole('group', { name: 'Running level' }))).toBe(true);
    expect(card('Your week').contains(screen.getByRole('group', { name: 'Running days' }))).toBe(true);
  });

  it('folds the three optional parts, and opening one shows its fields @spec(form-presentation/sections-and-folded-optional-parts/optional-parts-are-folded)', async () => {
    const { user } = setup();
    for (const title of [PLAN_PART, WEEK_PART, EVENT_PART]) expect(part(title).open, title).toBe(false);
    expect(screen.getAllByText('Optional')).toHaveLength(3);
    await user.click(screen.getByText(EVENT_PART, { selector: 'summary' }));
    expect(part(EVENT_PART).open).toBe(true);
    expect(within(part(EVENT_PART)).getByLabelText(/event name/i)).toBeTruthy();
    expect(part(WEEK_PART).open).toBe(false);
  });

  it('still sends the values of a part the athlete filled and then closed @spec(form-presentation/sections-and-folded-optional-parts/folded-values-are-still-sent)', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await openPart(user, EVENT_PART);
    await user.type(screen.getByLabelText(/event name/i), 'City Half');
    await user.type(screen.getByLabelText(/event date/i), '2099-12-06');
    await user.click(screen.getByText(EVENT_PART, { selector: 'summary' })); // close it
    expect(part(EVENT_PART).open).toBe(false);
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ targetEvent: { name: 'City Half', date: '2099-12-06' } }));
  });

  it('opens the parts that hold a saved answer when the form is pre-filled, so a saved value is never hidden', () => {
    setup({ initial: { ...base, runningDays: ['mon'], existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 3, targetEvent: { name: 'City Half', date: '2099-12-06' } } });
    expect(part(PLAN_PART).open).toBe(true);
    expect(part(EVENT_PART).open).toBe(true);
    expect(part(WEEK_PART).open).toBe(false); // nothing saved there
  });
});

describe('OnboardingForm: level choice', () => {
  it('has a group per level with Beginner, Intermediate and Advanced, none selected on an empty form @spec(form-presentation/level-choice/no-level-on-an-empty-form)', () => {
    setup();
    for (const group of ['Running level', 'CrossFit level']) {
      const radios = within(screen.getByRole('group', { name: group })).getAllByRole('radio') as HTMLInputElement[];
      expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(['Beginner', 'Intermediate', 'Advanced']);
      expect(radios.some((r) => r.checked)).toBe(false);
    }
  });

  it('selects only the chosen level and sends it @spec(form-presentation/level-choice/choosing-a-level)', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.click(level('Running level', 'Advanced'));
    expect(level('Running level', 'Advanced').checked).toBe(true);
    expect(level('Running level', 'Intermediate').checked).toBe(false);
    expect(level('CrossFit level', 'Advanced').checked).toBe(false); // the other group is separate
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ runningLevel: 'advanced', crossfitLevel: 'beginner' }));
  });

  it('asks for a missing level on that control and does not submit @spec(form-presentation/level-choice/level-is-required)', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('Goal'), 'Run a half marathon');
    await user.click(level('CrossFit level', 'Beginner'));
    await user.click(day('Running days', 'Mon'));
    await user.click(submitButton());
    expect(within(screen.getByRole('group', { name: 'Running level' })).getByText('Choose your running level.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('OnboardingForm: day buttons', () => {
  it('has seven toggles per group, Monday to Sunday', () => {
    setup();
    for (const group of ['Running days', 'CrossFit days']) {
      expect(within(screen.getByRole('group', { name: group })).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    }
  });

  it('turns a day on with the first press and off with the second @spec(form-presentation/day-buttons/toggle-a-day)', async () => {
    const { user } = setup();
    const tue = () => day('Running days', 'Tue') as HTMLInputElement;
    await user.click(tue());
    expect(tue().checked).toBe(true);
    expect((day('CrossFit days', 'Tue') as HTMLInputElement).checked).toBe(false);
    await user.click(tue());
    expect(tue().checked).toBe(false);
  });

  it('asks for a training day or a pasted plan when neither is given, and does not submit @spec(form-presentation/day-buttons/no-day-and-no-pasted-plan)', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('Goal'), 'Run a half marathon');
    await user.click(level('Running level', 'Beginner'));
    await user.click(level('CrossFit level', 'Beginner'));
    await user.click(submitButton());
    expect(screen.getAllByText('Pick at least one training day, or paste a running plan.')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// Task 3.2: quick goal ideas, the progress cue, the pinned action bar, and folded parts that hold an error.
describe('OnboardingForm: quick goal ideas', () => {
  const IDEAS = ['Half marathon', '10K', 'Stay fit and balanced', 'Get stronger'];
  const ideas = () => within(screen.getByRole('group', { name: 'Quick ideas' }));

  it('offers four short ideas while the goal is empty, and fills the goal when one is pressed @spec(form-presentation/quick-goal-ideas/an-idea-fills-the-goal)', async () => {
    const { user } = setup();
    expect(ideas().getAllByRole('button').map((b) => b.textContent)).toEqual(IDEAS);
    await user.click(ideas().getByRole('button', { name: '10K' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('10K');
    expect(screen.queryByRole('group', { name: 'Quick ideas' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Goal')); // ready to edit the idea
  });

  it('lets the athlete edit the idea they pressed', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.clear(screen.getByLabelText('Goal'));
    await user.click(ideas().getByRole('button', { name: 'Half marathon' }));
    await user.type(screen.getByLabelText('Goal'), ' in under two hours');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ goal: 'Half marathon in under two hours' }));
  });

  it('shows no idea once the goal has text, so a typed goal can never be replaced @spec(form-presentation/quick-goal-ideas/typed-goals-are-never-replaced)', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Goal'), 'Get faster');
    expect(screen.queryByRole('group', { name: 'Quick ideas' })).toBeNull();
    expect(screen.queryByRole('button', { name: '10K' })).toBeNull();
  });

  it('shows no idea on a form pre-filled with a goal @spec(form-presentation/quick-goal-ideas/typed-goals-are-never-replaced)', () => {
    setup({ initial: { ...base, runningDays: ['mon'] } });
    expect(screen.queryByRole('group', { name: 'Quick ideas' })).toBeNull();
  });

  it('brings the ideas back when the goal is emptied again', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Goal'), 'x');
    await user.clear(screen.getByLabelText('Goal'));
    expect(screen.getByRole('group', { name: 'Quick ideas' })).toBeTruthy();
  });
});

describe('OnboardingForm: progress cue', () => {
  const cue = () => screen.getByText(/of 4 required answers done/).textContent;
  const PASTE = 'Mon 5 km easy';
  // Each row is an onboarding and the number of required answers it has: goal, running level, CrossFit level, and a
  // training day or a pasted plan. The cue must agree with this table and with the shared validator on every row.
  const rows: { name: string; change: Partial<Onboarding>; done: number }[] = [
    { name: 'nothing', change: { goal: '', runningLevel: '' as never, crossfitLevel: '' as never, runningDays: [], crossfitDays: [] }, done: 0 },
    { name: 'goal and running level', change: { goal: 'Run', runningLevel: 'beginner', crossfitLevel: '' as never, runningDays: [], crossfitDays: [] }, done: 2 },
    { name: 'a running day only', change: { goal: '', runningLevel: '' as never, crossfitLevel: '' as never, runningDays: ['mon'], crossfitDays: [] }, done: 1 },
    { name: 'a CrossFit day only', change: { goal: '', runningLevel: '' as never, crossfitLevel: '' as never, runningDays: [], crossfitDays: ['tue'] }, done: 1 },
    { name: 'goal, both levels, a pasted plan and no day', change: { goal: 'Run', runningLevel: 'beginner', crossfitLevel: 'advanced', runningDays: [], crossfitDays: [], existingRunningPlan: PASTE, pastedPlanWeek: 1 }, done: 4 },
    { name: 'a blank pasted plan does not count', change: { goal: 'Run', runningLevel: 'beginner', crossfitLevel: 'advanced', runningDays: [], crossfitDays: [], existingRunningPlan: '   ' }, done: 3 },
    { name: 'everything', change: { goal: 'Run', runningLevel: 'beginner', crossfitLevel: 'advanced', runningDays: ['mon'], crossfitDays: ['tue'] }, done: 4 },
  ];

  it.each(rows)('reads "$done of 4 required answers done" for $name, as the shared validator says @spec(form-presentation/progress-cue/cue-counts-answers) @spec(form-presentation/progress-cue/a-pasted-plan-counts-as-the-training-day-answer)', ({ change, done }) => {
    const onboarding = { ...base, weeklyTraining: null, targetEvent: null, ...change } as Onboarding;
    setup({ initial: onboarding });
    expect(cue()).toBe(`${done} of 4 required answers done`);
    // Cross-check with the validator the form submits through: the required keys without an error are the answers done.
    const result = validateOnboarding({ ...onboarding, existingRunningPlan: onboarding.existingRunningPlan?.trim() ? onboarding.existingRunningPlan : null });
    const failing = result.ok ? new Set<string>() : new Set(Object.keys(result.fields));
    const requiredOk = ['goal', 'runningLevel', 'crossfitLevel'].filter((k) => !failing.has(k)).length + (failing.has('runningDays') || failing.has('crossfitDays') ? 0 : 1);
    expect(requiredOk).toBe(done);
  });

  it('counts up as the athlete answers, starting from 0 on an empty form', async () => {
    const { user } = setup();
    expect(cue()).toBe('0 of 4 required answers done');
    await user.type(screen.getByLabelText('Goal'), 'Run');
    expect(cue()).toBe('1 of 4 required answers done');
    await user.click(level('Running level', 'Beginner'));
    await user.click(level('CrossFit level', 'Beginner'));
    expect(cue()).toBe('3 of 4 required answers done');
    await user.click(day('CrossFit days', 'Tue'));
    expect(cue()).toBe('4 of 4 required answers done');
  });

  it('is plain text read with the form, not announced on every change', () => {
    setup();
    const el = screen.getByText(/of 4 required answers done/);
    expect(el.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('never blocks submitting: with fewer than four answers the E1 messages show and nothing is sent @spec(form-presentation/progress-cue/cue-never-blocks)', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('Goal'), 'Run');
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    await user.click(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose your running level.')).toBeTruthy();
    expect(cue()).toBe('1 of 4 required answers done');
  });

  it('does not enable submitting by itself: four answers still need to pass the validator', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    expect(cue()).toBe('4 of 4 required answers done');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingForm: pinned action bar', () => {
  it('keeps "Build my plan" in a sticky bar at the bottom, with the safe-area inset', () => {
    setup();
    const bar = submitButton().parentElement as HTMLElement;
    const classes = bar.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['sticky', 'bottom-0']));
    expect(bar.className).toContain('env(safe-area-inset-bottom)');
  });
});

describe('OnboardingForm: a folded part with an error is never hidden', () => {
  const eventPart = () => part(EVENT_PART);

  it('opens "Target event" and focuses the date when a past date is submitted from a closed part @spec(form-presentation/sections-and-folded-optional-parts/an-error-inside-a-folded-part-is-never-hidden)', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await openPart(user, EVENT_PART);
    await user.type(screen.getByLabelText(/event name/i), 'City Half');
    await user.type(screen.getByLabelText(/event date/i), '2020-01-01');
    await user.click(screen.getByText(EVENT_PART, { selector: 'summary' })); // close it
    expect(eventPart().open).toBe(false);
    await user.click(submitButton());
    expect(eventPart().open).toBe(true);
    expect(within(eventPart()).getByText('The event date cannot be in the past (UTC).')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/event date/i));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens "My usual week" for a weekly number problem and "I already follow a running plan" for a bad week', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await openPart(user, WEEK_PART);
    await user.type(screen.getByLabelText(/running sessions per week/i), '3'); // CrossFit count missing
    await user.click(screen.getByText(WEEK_PART, { selector: 'summary' }));
    await openPart(user, PLAN_PART);
    await user.type(screen.getByLabelText(/running plan/i), 'Mon 5 km easy');
    await user.type(screen.getByLabelText(/week of your plan/i), '99');
    await user.click(screen.getByText(PLAN_PART, { selector: 'summary' }));
    await user.click(submitButton());
    expect(part(WEEK_PART).open).toBe(true);
    expect(part(PLAN_PART).open).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText(/week of your plan/i)); // the plan part comes first on the page
  });

  it('focuses the weekly field that was left blank, not always the first one', async () => {
    const { user } = setup();
    await fillValid(user);
    await openPart(user, WEEK_PART);
    await user.type(screen.getByLabelText(/running sessions per week/i), '3'); // CrossFit sessions left blank
    await user.click(screen.getByText(WEEK_PART, { selector: 'summary' }));
    await user.click(submitButton());
    expect(part(WEEK_PART).open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText(/crossfit sessions per week/i));
  });

  it('opens a closed part that a server error names, and focuses its field', () => {
    setup({ serverFields: { targetEvent: 'The event date cannot be in the past (UTC).' } });
    expect(eventPart().open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText(/event name/i));
  });

  it('keeps a part closed when it has no error', async () => {
    const { user } = setup();
    await fillValid(user);
    await user.click(submitButton());
    for (const title of [PLAN_PART, WEEK_PART, EVENT_PART]) expect(part(title).open, title).toBe(false);
  });
});

// Task 3.3: the E1 validation and focus behavior on the new markup.
describe('OnboardingForm: focus on the first invalid field when submitting', () => {
  const firstRunningDay = () => within(screen.getByRole('group', { name: 'Running days' })).getAllByRole('checkbox')[0] as HTMLElement;
  const rows: { name: string; fill: (user: ReturnType<typeof userEvent.setup>) => Promise<void>; target: () => Element }[] = [
    { name: 'the goal when nothing is filled', fill: async () => {}, target: () => screen.getByLabelText('Goal') },
    { name: 'the running level once the goal is filled', fill: async (u) => { await u.type(screen.getByLabelText('Goal'), 'Run'); }, target: () => level('Running level', 'Beginner') },
    { name: 'the CrossFit level once the running level is chosen', fill: async (u) => { await u.type(screen.getByLabelText('Goal'), 'Run'); await u.click(level('Running level', 'Beginner')); }, target: () => level('CrossFit level', 'Beginner') },
    { name: 'the first running day once the goal and both levels are chosen', fill: async (u) => { await u.type(screen.getByLabelText('Goal'), 'Run'); await u.click(level('Running level', 'Beginner')); await u.click(level('CrossFit level', 'Beginner')); }, target: firstRunningDay },
  ];

  it.each(rows)('moves focus to $name, and sends nothing @spec(form-presentation/same-validation-and-behavior-as-e1/focus-on-the-first-invalid-field)', async ({ fill, target }) => {
    const { user, onSubmit } = setup();
    await fill(user);
    await user.click(submitButton());
    expect(document.activeElement).toBe(target());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves focus again on a second submit after the athlete has gone elsewhere @spec(form-presentation/same-validation-and-behavior-as-e1/focus-on-the-first-invalid-field)', async () => {
    const { user } = setup();
    await user.click(submitButton());
    expect(document.activeElement).toBe(screen.getByLabelText('Goal'));
    await user.click(screen.getByLabelText(/injuries or pain/i));
    await user.click(submitButton());
    expect(document.activeElement).toBe(screen.getByLabelText('Goal'));
  });

  it('leaves focus alone when the form is valid and sends it', async () => {
    const { user, onSubmit } = setup();
    await fillValid(user);
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(submitButton());
  });
});

describe('OnboardingForm: every error shows words', () => {
  it('gives each invalid control a visible message that names the problem, not only a color or an icon @spec(responsive-accessibility/contrast-and-signals/errors-and-the-safety-note-carry-text)', async () => {
    const { user } = setup();
    await user.click(submitButton());
    const invalid = Array.from(document.querySelectorAll('[aria-invalid="true"]'));
    expect(invalid.length).toBeGreaterThanOrEqual(4); // goal, both levels, the days
    for (const el of invalid) {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
      expect(ids.length, el.outerHTML.slice(0, 80)).toBeGreaterThan(0);
      for (const id of ids) {
        const message = document.getElementById(id);
        expect(message?.textContent?.trim().length, id).toBeGreaterThan(10);
        expect(message?.className).toContain('text-error');
      }
    }
  });

  it('does the same for a message that comes from the server @spec(responsive-accessibility/contrast-and-signals/errors-and-the-safety-note-carry-text)', () => {
    setup({ serverFields: { goal: 'Goal is required from the server.' } });
    const goal = screen.getByLabelText('Goal');
    expect(goal.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(goal.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Goal is required from the server.');
  });
});
