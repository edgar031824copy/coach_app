import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import { apiFail, fakeApi, ok, planRecord, planResponse } from './test-helpers.js';
import type { PlanResponse } from 'shared';

afterEach(() => vi.useRealTimers());

const pastedRecord = planRecord({ existingRunningPlan: 'Week 3: Mon 5 km easy', pastedPlanWeek: 3, goal: 'Finish a 10k' });
const nextWeek = () => screen.getByRole('button', { name: 'Plan next week' });
const build = () => screen.getByRole('button', { name: /build my plan/i });
const week = () => (screen.getByLabelText(/week of your plan/i) as HTMLInputElement).value;

// Renders the app with a fake API and waits for the first load of the saved plan to settle.
async function open(saved: ReturnType<typeof planRecord> | null, post?: Parameters<typeof fakeApi>[1]) {
  const api = fakeApi(saved, post);
  const user = userEvent.setup();
  render(<App api={api} />);
  await screen.findByRole('button', { name: /build my plan/i });
  if (saved) await screen.findByRole('region', { name: 'Your plan' });
  return { api, user };
}

describe('App: reload', () => {
  it('shows the saved plan from GET /api/plan without calling the coach @spec(plan-storage/reload-without-a-coach-call/reload-shows-the-same-plan)', async () => {
    const { api } = await open(pastedRecord);
    expect(api.getPlan).toHaveBeenCalledTimes(1);
    expect(api.postPlan).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: 'Your plan' })).getByText('Week 3 of your running plan')).toBeTruthy();
  });

  it('shows the form and no plan, and no "Plan next week", when nothing is saved', async () => {
    await open(null);
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan next week' })).toBeNull();
  });

  it('says the saved plan could not be loaded, and still lets the athlete build one', async () => {
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), postPlan: vi.fn() };
    render(<App api={api} />);
    expect(await screen.findByText(/could not load your saved plan/i)).toBeTruthy();
    expect(build()).toBeTruthy();
  });
});

describe('App: Plan next week', () => {
  it('pre-fills the form from the saved onboarding with the next week, and makes no call @spec(plan-storage/plan-next-week/form-is-pre-filled) @spec(plan-storage/plan-next-week/nothing-changes-before-submitting)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(nextWeek());
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('Finish a 10k');
    expect(week()).toBe('4');
    expect(api.postPlan).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy(); // the saved plan is still shown
  });

  it('lets the athlete edit the pre-filled week before submitting', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(nextWeek());
    await user.clear(screen.getByLabelText(/week of your plan/i));
    await user.type(screen.getByLabelText(/week of your plan/i), '6');
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledWith(expect.objectContaining({ pastedPlanWeek: 6 }));
  });

  it('submits the pre-filled form once, as any onboarding @spec(plan-storage/plan-next-week/submitting-counts-as-a-normal-call)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(nextWeek());
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledTimes(1);
    expect(api.postPlan).toHaveBeenCalledWith({ ...pastedRecord.onboarding, pastedPlanWeek: 4 });
  });

  it('keeps the week null when no plan was pasted @spec(plan-storage/plan-next-week/no-pasted-plan)', async () => {
    const { user } = await open(planRecord({ runningDays: ['mon'] }));
    await user.click(nextWeek());
    expect(screen.queryByLabelText(/week of your plan/i)).toBeNull();
  });

  it('shows week 53 with its field error after week 52, and does not submit it @spec(plan-storage/plan-next-week/week-past-the-maximum)', async () => {
    const { api, user } = await open(planRecord({ existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 52 }));
    await user.click(nextWeek());
    expect(week()).toBe('53');
    expect(screen.getByText('The plan week must be a whole number from 1 to 52.')).toBeTruthy();
    await user.click(build());
    expect(api.postPlan).not.toHaveBeenCalled();
  });
});

describe('App: submitting', () => {
  it('replaces the shown plan with the new one on success', async () => {
    const newer: PlanResponse = { ...planResponse, id: 2, plan: { ...planResponse.plan, recommendations: ['A brand new suggestion.'] } };
    const { user } = await open(pastedRecord, async () => ok(newer));
    expect(screen.queryByText('A brand new suggestion.')).toBeNull();
    await user.click(nextWeek());
    await user.click(build());
    expect(await screen.findByText('A brand new suggestion.')).toBeTruthy();
  });

  it('shows what the server said is wrong next to the fields', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { goal: 'Goal is required from the server.' } }));
    await user.click(nextWeek());
    await user.click(build());
    expect(await screen.findByText('Goal is required from the server.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/highlighted/i);
  });
});

describe('App: errors keep the saved plan, and each has its own message', () => {
  const fail = async (post: Parameters<typeof fakeApi>[1]) => {
    const r = await open(pastedRecord, post);
    await r.user.click(nextWeek());
    await r.user.click(build());
    return { ...r, alert: await screen.findByRole('alert') };
  };

  it('offers a retry after coach_unavailable, and the retry sends the same onboarding again', async () => {
    const { api, user, alert } = await fail(async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    expect(alert.textContent).toMatch(/nothing was saved/i);
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy(); // the old plan is still there
    api.postPlan.mockImplementationOnce(async () => ok(planResponse));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(api.postPlan).toHaveBeenCalledTimes(2);
    expect(api.postPlan.mock.calls[1]).toEqual(api.postPlan.mock.calls[0]);
    expect(screen.queryByRole('alert')).toBeNull(); // a successful retry clears the error
  });

  it('offers a retry after invalid_coach_response', async () => {
    const { alert } = await fail(async () => apiFail('invalid_coach_response', { remainingCallsToday: 5 }));
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('gives plan_unreadable a clear message and no retry button', async () => {
    const { alert } = await fail(async () => apiFail('plan_unreadable', { message: 'No running sessions found for week 4 in your pasted plan.', remainingCallsToday: 5 }));
    expect(alert.textContent).toContain('No running sessions found for week 4 in your pasted plan.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('says the daily limit is reached, with no retry @spec(cost-cap/daily-cap/cap-reached)', async () => {
    const { alert } = await fail(async () => apiFail('daily_limit_reached', { remainingCallsToday: 0 }));
    expect(alert.textContent).toMatch(/daily limit reached/i);
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows the error and that no retries remain when the last allowed call fails @spec(cost-cap/last-allowed-call-fails/last-call-fails)', async () => {
    const { alert } = await fail(async () => apiFail('coach_unavailable', { remainingCallsToday: 0 }));
    expect(alert.textContent).toMatch(/nothing was saved/i);
    expect(alert.textContent).toContain('No retries remain today.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a network failure and a timeout, each with a retry', async () => {
    const a = await fail(async () => ({ ok: false as const, failure: { kind: 'network' as const } }));
    expect(a.alert.textContent).toMatch(/connection/i);
    expect(within(a.alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('App: waiting', () => {
  it('shows a "building" message at once and the "waking up the coach" message after 3 s @spec(deploy/cold-start-experience/server-is-waking-up)', async () => {
    const api = fakeApi(pastedRecord, () => new Promise(() => {})); // never answers
    render(<App api={api} />);
    await screen.findByRole('region', { name: 'Your plan' });
    vi.useFakeTimers(); // plain clicks below: user-event and fake timers wait on each other
    fireEvent.click(nextWeek());
    fireEvent.click(build());
    expect(screen.getByRole('status').textContent).toMatch(/building your plan/i);
    expect((build() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByRole('status').textContent).toMatch(/building your plan/i);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole('status').textContent).toMatch(/waking up the coach/i);
  });
});
