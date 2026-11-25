import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingForm } from './OnboardingForm.js';
import { onboarding as base } from './test-helpers.js';

const setup = (props: Partial<Parameters<typeof OnboardingForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user };
};
const day = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name });
const submitButton = () => screen.getByRole('button', { name: /build my plan/i });

// Fills the smallest valid form.
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/goal/i), 'Run a half marathon');
  await user.selectOptions(screen.getByLabelText(/running level/i), 'intermediate');
  await user.selectOptions(screen.getByLabelText(/crossfit level/i), 'beginner');
  await user.click(day('Running days', 'Mon'));
  await user.click(day('Running days', 'Wed'));
  await user.click(day('CrossFit days', 'Tue'));
}

describe('OnboardingForm: instant feedback', () => {
  it('shows no error before the athlete has touched anything', () => {
    setup();
    expect(screen.queryByText(/is required/i)).toBeNull();
    expect(screen.getByLabelText(/goal/i).getAttribute('aria-invalid')).not.toBe('true');
  });

  it('shows the message for an empty goal as soon as the field is left, before any submit', async () => {
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
    await user.type(screen.getByLabelText(/event name/i), 'City Half');
    await user.type(screen.getByLabelText(/event date/i), '2020-01-01');
    expect(screen.getByText('The event date cannot be in the past (UTC).')).toBeTruthy();
    await user.type(screen.getByLabelText(/running sessions per week/i), '3');
    expect(screen.getByText('Weekly training sessions must be whole numbers.')).toBeTruthy(); // CrossFit count still empty
  });

  it('asks for the plan week only when a running plan is pasted', async () => {
    const { user } = setup();
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
    await user.type(screen.getByLabelText(/running sessions per week/i), '3');
    await user.type(screen.getByLabelText(/crossfit sessions per week/i), '2');
    await user.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ weeklyTraining: { runningSessions: 3, crossfitSessions: 2, runningKm: null } }));
  });

  it('accepts a pasted plan instead of any training day', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/goal/i), 'Finish a 10k');
    await user.selectOptions(screen.getByLabelText(/running level/i), 'beginner');
    await user.selectOptions(screen.getByLabelText(/crossfit level/i), 'beginner');
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
  it('shows each server message next to its own field', async () => {
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
    expect((screen.getByLabelText(/running level/i) as HTMLSelectElement).value).toBe('intermediate');
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

  it('shows a field error at once for a pre-filled value that is not allowed, such as week 53, and lets the athlete edit it @spec(plan-storage/plan-next-week/week-past-the-maximum)', async () => {
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

  it('focuses the first invalid field in page order, not the goal, when several are invalid', () => {
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
