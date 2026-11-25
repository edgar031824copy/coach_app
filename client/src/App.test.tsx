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
const newPlan = () => screen.getByRole('button', { name: 'New plan' });
const myPlan = () => screen.getByRole('button', { name: 'My plan' });
const planRegion = () => screen.queryByRole('region', { name: 'Your plan' });
// The smallest valid form.
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  const inGroup = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name });
  await user.type(screen.getByLabelText(/goal/i), 'Run a half marathon');
  await user.click(within(screen.getByRole('group', { name: 'Running level' })).getByRole('radio', { name: 'Intermediate' }));
  await user.click(within(screen.getByRole('group', { name: 'CrossFit level' })).getByRole('radio', { name: 'Beginner' }));
  await user.click(inGroup('Running days', 'Mon'));
  await user.click(inGroup('CrossFit days', 'Tue'));
}
const week = () => (screen.getByLabelText(/week of your plan/i) as HTMLInputElement).value;

// Renders the app with a fake API and waits for the first load of the saved plan to settle.
async function open(saved: ReturnType<typeof planRecord> | null, post?: Parameters<typeof fakeApi>[1]) {
  const api = fakeApi(saved, post);
  const user = userEvent.setup();
  render(<App api={api} />);
  if (saved) await screen.findByRole('region', { name: 'Your plan' });
  else await screen.findByRole('button', { name: /build my plan/i });
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
    await user.click(myPlan());
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy(); // the saved plan is still there
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

  it('shows what the server said is wrong next to the fields @spec(messages-and-states/failures/validation-failure-shows-fields)', async () => {
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

  it('offers a retry after coach_unavailable, and the retry sends the same onboarding again @spec(messages-and-states/failures/alert-role) @spec(messages-and-states/failures/a-retry-is-offered-where-e1-offers-one)', async () => {
    const { api, user, alert } = await fail(async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    expect(alert.textContent).toMatch(/nothing was saved/i);
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull(); // the form view stays open on a failure
    api.postPlan.mockImplementationOnce(async () => ok(planResponse));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(api.postPlan).toHaveBeenCalledTimes(2);
    expect(api.postPlan.mock.calls[1]).toEqual(api.postPlan.mock.calls[0]);
    expect(screen.queryByRole('alert')).toBeNull(); // a successful retry clears the error
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy(); // and opens the plan view
  });

  it('offers a retry after invalid_coach_response @spec(messages-and-states/failures/a-retry-is-offered-where-e1-offers-one)', async () => {
    const { alert } = await fail(async () => apiFail('invalid_coach_response', { remainingCallsToday: 5 }));
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('gives plan_unreadable a clear message and no retry button @spec(messages-and-states/failures/unreadable-pasted-week)', async () => {
    const { alert } = await fail(async () => apiFail('plan_unreadable', { message: 'No running sessions found for week 4 in your pasted plan.', remainingCallsToday: 5 }));
    expect(alert.textContent).toContain('No running sessions found for week 4 in your pasted plan.');
    expect(alert.textContent).toContain('Check the pasted plan and the week number'); // the client's hint follows the server's sentence
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('says the daily limit is reached, with no retry @spec(cost-cap/daily-cap/cap-reached) @spec(messages-and-states/failures/daily-limit)', async () => {
    const { alert } = await fail(async () => apiFail('daily_limit_reached', { remainingCallsToday: 0 }));
    expect(alert.textContent).toMatch(/daily limit reached/i);
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows the error and that no retries remain when the last allowed call fails @spec(cost-cap/last-allowed-call-fails/last-call-fails) @spec(messages-and-states/failures/retry-rules-unchanged)', async () => {
    const { alert } = await fail(async () => apiFail('coach_unavailable', { remainingCallsToday: 0 }));
    expect(alert.textContent).toMatch(/nothing was saved/i);
    expect(alert.textContent).toContain('No retries remain today.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a network failure with a retry @spec(messages-and-states/failures/a-retry-is-offered-where-e1-offers-one)', async () => {
    const { alert } = await fail(async () => ({ ok: false as const, failure: { kind: 'network' as const } }));
    expect(alert.textContent).toMatch(/connection/i);
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a timeout with a retry, and says the plan may still have been saved @spec(messages-and-states/failures/timeout-keeps-its-hint) @spec(messages-and-states/failures/a-retry-is-offered-where-e1-offers-one)', async () => {
    const { alert } = await fail(async () => ({ ok: false as const, failure: { kind: 'timeout' as const } }));
    expect(alert.textContent).toMatch(/too long/i);
    expect(alert.textContent).toMatch(/may still have been saved/i);
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('App: waiting', () => {
  it('shows a "building" message at once and the "waking up the coach" message after 3 s @spec(deploy/cold-start-experience/server-is-waking-up) @spec(messages-and-states/loading-building-and-waking-states/building) @spec(messages-and-states/loading-building-and-waking-states/waking-after-three-seconds)', async () => {
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

// Task 2.1: the page is two views (plan, form) on one page, and a start state while the saved plan is read.
describe('App: start state', () => {
  const pending = () => { let resolve!: (v: ReturnType<typeof ok<typeof pastedRecord | null>>) => void; const p = new Promise<ReturnType<typeof ok<typeof pastedRecord | null>>>((r) => { resolve = r; }); return { p, resolve }; };

  it('shows only "Loading your saved plan…" until the read ends @spec(app-views/start-state/loading-before-the-read-ends)', async () => {
    const gate = pending();
    const api = { getPlan: vi.fn(() => gate.p), postPlan: vi.fn() };
    render(<App api={api} />);
    expect(screen.getByRole('status').textContent).toBe('Loading your saved plan…');
    expect(planRegion()).toBeNull();
    expect(screen.queryByRole('button', { name: /build my plan/i })).toBeNull();
    expect(screen.queryByLabelText(/goal/i)).toBeNull();
    await act(async () => { gate.resolve(ok(pastedRecord)); });
    expect(await screen.findByRole('region', { name: 'Your plan' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('opens the plan view, without the form, when a plan is saved @spec(app-views/start-state/a-saved-plan-opens-the-plan-view)', async () => {
    await open(pastedRecord);
    expect(screen.queryByRole('button', { name: /build my plan/i })).toBeNull();
    expect(screen.queryByLabelText(/goal/i)).toBeNull();
    expect(newPlan()).toBeTruthy();
    expect(nextWeek()).toBeTruthy();
  });

  it('opens an empty form, without "My plan", when nothing is saved @spec(app-views/start-state/no-saved-plan-opens-the-form-view)', async () => {
    await open(null);
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByRole('button', { name: 'My plan' })).toBeNull();
    expect(planRegion()).toBeNull();
  });

  it('opens the form with the failed-read message when the read fails @spec(app-views/start-state/a-failed-read-opens-the-form-view-with-a-message)', async () => {
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), postPlan: vi.fn() };
    render(<App api={api} />);
    expect(await screen.findByText('Could not load your saved plan. You can still build a new one.')).toBeTruthy();
    expect(build()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My plan' })).toBeNull();
  });

  it('drops the failed-read message once the athlete builds a plan and presses "New plan" @spec(app-views/start-state/the-failed-read-message-does-not-follow-the-athlete)', async () => {
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), postPlan: vi.fn(async () => ok(planResponse)) };
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByText(/could not load your saved plan/i);
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(screen.queryByText(/could not load your saved plan/i)).toBeNull();
    await user.click(newPlan());
    expect(screen.queryByText(/could not load your saved plan/i)).toBeNull();
  });
});

describe('App: moving between views', () => {
  it('opens an empty form with "New plan", and sends no request @spec(app-views/moving-between-views/new-plan-opens-an-empty-form)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(newPlan());
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByLabelText(/week of your plan/i)).toBeNull();
    expect(planRegion()).toBeNull();
    expect(api.postPlan).not.toHaveBeenCalled();
  });

  it('opens the form prefilled with the next week through "Plan next week" @spec(app-views/moving-between-views/plan-next-week-opens-a-prefilled-form)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(nextWeek());
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('Finish a 10k');
    expect(week()).toBe('4');
    expect(planRegion()).toBeNull();
    expect(api.postPlan).not.toHaveBeenCalled();
  });

  it('goes back to the same plan with "My plan", without a request @spec(app-views/moving-between-views/my-plan-goes-back-without-a-request)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(newPlan());
    await user.click(myPlan());
    expect(within(screen.getByRole('region', { name: 'Your plan' })).getByText('Week 3 of your running plan')).toBeTruthy();
    expect(screen.queryByLabelText(/goal/i)).toBeNull();
    expect(api.postPlan).not.toHaveBeenCalled();
    expect(api.getPlan).toHaveBeenCalledTimes(1);
  });

  it('prefills from the saved plan, not from a failed attempt or anything typed @spec(app-views/moving-between-views/plan-next-week-uses-the-saved-plan)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await user.click(nextWeek());
    await user.clear(screen.getByLabelText(/week of your plan/i));
    await user.type(screen.getByLabelText(/week of your plan/i), '9');
    await user.type(screen.getByLabelText(/goal/i), ' and more');
    await user.click(build());
    await screen.findByRole('alert');
    await user.click(myPlan());
    await user.click(nextWeek());
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe('Finish a 10k');
    expect(week()).toBe('4');
  });
});

describe('App: outcomes of a submit', () => {
  const failing = () => open(pastedRecord, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
  const submitFromNextWeek = async (user: ReturnType<typeof userEvent.setup>) => { await user.click(nextWeek()); await user.click(build()); };

  it('opens the plan view with the new plan on success @spec(app-views/outcomes-of-a-submit/success-shows-the-new-plan)', async () => {
    const newer: PlanResponse = { ...planResponse, id: 2, plan: { ...planResponse.plan, recommendations: ['Fresh advice.'] } };
    const { user } = await open(pastedRecord, async () => ok(newer));
    await submitFromNextWeek(user);
    expect(await screen.findByText('Fresh advice.')).toBeTruthy();
    expect(screen.queryByLabelText(/goal/i)).toBeNull();
  });

  it('keeps the form open with the failure, and the earlier plan one press away @spec(app-views/outcomes-of-a-submit/failure-keeps-the-form-and-the-earlier-plan) @spec(messages-and-states/earlier-plan-survives-a-failure/earlier-plan-after-a-failure)', async () => {
    const { user } = await failing();
    await submitFromNextWeek(user);
    expect((await screen.findByRole('alert')).textContent).toMatch(/nothing was saved/i);
    expect(screen.getByLabelText(/goal/i)).toBeTruthy();
    await user.click(myPlan());
    expect(within(screen.getByRole('region', { name: 'Your plan' })).getByText('Week 3 of your running plan')).toBeTruthy();
  });

  it('shows no failure and no field error on a new form after the athlete left @spec(app-views/outcomes-of-a-submit/a-failure-does-not-follow-the-athlete-to-a-new-form)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { goal: 'Goal is required from the server.' } }));
    await submitFromNextWeek(user);
    await screen.findByText('Goal is required from the server.');
    await user.click(myPlan());
    await user.click(newPlan());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Goal is required from the server.')).toBeNull();
  });

  it('clears a failure when the athlete goes to "My plan" and back with "Plan next week" @spec(app-views/outcomes-of-a-submit/a-failure-does-not-follow-the-athlete-to-a-new-form)', async () => {
    const { user } = await failing();
    await submitFromNextWeek(user);
    await screen.findByRole('alert');
    await user.click(myPlan());
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(nextWeek());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables "Build my plan" and "My plan" while the request runs, and enables them after @spec(app-views/outcomes-of-a-submit/controls-are-disabled-while-the-request-runs)', async () => {
    let answer!: () => void;
    const post = () => new Promise<ReturnType<typeof ok<PlanResponse>>>((resolve) => { answer = () => resolve(ok(planResponse)); });
    const { user } = await open(pastedRecord, post);
    await user.click(nextWeek());
    expect((myPlan() as HTMLButtonElement).disabled).toBe(false);
    await user.click(build());
    expect((build() as HTMLButtonElement).disabled).toBe(true);
    expect((myPlan() as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { answer(); });
    expect(await screen.findByRole('region', { name: 'Your plan' })).toBeTruthy();
  });

  it('sends the same onboarding again with "Try again" and opens the plan view on success @spec(app-views/outcomes-of-a-submit/try-again-after-a-failure)', async () => {
    const { api, user } = await failing();
    await submitFromNextWeek(user);
    const alert = await screen.findByRole('alert');
    api.postPlan.mockImplementationOnce(async () => ok(planResponse));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(api.postPlan.mock.calls[1]).toEqual(api.postPlan.mock.calls[0]);
    expect(await screen.findByRole('region', { name: 'Your plan' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps "Plan next week" on the saved plan after a failed submit @spec(app-views/moving-between-views/plan-next-week-uses-the-saved-plan)', async () => {
    const { user } = await failing();
    await submitFromNextWeek(user);
    await screen.findByRole('alert');
    await user.click(myPlan());
    await user.click(nextWeek());
    expect(week()).toBe('4');
  });
});

// Task 2.2: headings and focus. One h1 (the app name), one h2 per view (tabIndex -1 so it can take focus), h3 per day.
describe('App: headings', () => {
  it('has one level-1 heading, one level-2 heading per view, and a level-3 heading per day', async () => {
    const { user } = await open(pastedRecord);
    const levels = () => screen.getAllByRole('heading').filter((h) => !h.closest('[hidden]')).map((h) => `${h.tagName}:${h.textContent}`);
    expect(levels().filter((h) => h.startsWith('H1'))).toEqual(['H1:Hybrid Coach']);
    expect(levels().filter((h) => h.startsWith('H2'))).toEqual(['H2:Your plan']);
    expect(levels().filter((h) => h.startsWith('H3'))).toHaveLength(7);
    await user.click(newPlan());
    expect(levels().filter((h) => h.startsWith('H2'))).toEqual(['H2:New plan']);
    expect(screen.getByRole('heading', { level: 2, name: 'New plan' }).getAttribute('tabindex')).toBe('-1');
  });

  it('makes the plan heading focusable by script only', async () => {
    await open(pastedRecord);
    expect(screen.getByRole('heading', { level: 2, name: 'Your plan' }).getAttribute('tabindex')).toBe('-1');
  });
});

describe('App: focus', () => {
  const heading = (name: string) => screen.getByRole('heading', { level: 2, name });

  it('moves no focus when the page opens, with a saved plan or without @spec(app-views/start-state/opening-the-page-does-not-move-focus)', async () => {
    await open(pastedRecord);
    expect(document.activeElement).toBe(document.body);
  });

  it('moves no focus when the page opens on the empty form @spec(app-views/start-state/opening-the-page-does-not-move-focus)', async () => {
    await open(null);
    expect(document.activeElement).toBe(document.body);
  });

  it('puts focus on the heading of the view the athlete opens @spec(app-views/moving-between-views/focus-follows-the-view)', async () => {
    const { user } = await open(pastedRecord);
    await user.click(newPlan());
    expect(document.activeElement).toBe(heading('New plan'));
    await user.click(myPlan());
    expect(document.activeElement).toBe(heading('Your plan'));
    await user.click(nextWeek());
    expect(document.activeElement).toBe(heading('New plan')); // week 4: nothing to fix, so the heading, not a field
  });

  it('puts focus on the first field with an error when "Plan next week" gives week 53, not on the heading @spec(app-views/moving-between-views/focus-goes-to-the-first-error-when-the-form-opens-with-one)', async () => {
    const { user } = await open(planRecord({ existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 52 }));
    await user.click(nextWeek());
    expect(document.activeElement).toBe(screen.getByLabelText(/week of your plan/i));
    expect(document.activeElement).not.toBe(heading('New plan'));
  });

  it('puts focus on the plan heading when a submit succeeds @spec(app-views/outcomes-of-a-submit/success-shows-the-new-plan)', async () => {
    const { user } = await open(pastedRecord);
    await user.click(nextWeek());
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(document.activeElement).toBe(heading('Your plan'));
  });

  it('puts focus on the failure message when the failure names no field @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await user.click(nextWeek());
    await user.click(build());
    expect(document.activeElement).toBe(await screen.findByRole('alert'));
  });

  it('puts focus on the first field a server error names, not on the message @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { goal: 'Goal is required from the server.' } }));
    await user.click(nextWeek());
    await user.click(build());
    await screen.findByText('Goal is required from the server.');
    expect(document.activeElement).toBe(screen.getByLabelText(/goal/i));
  });

  it('puts focus on the failure message when the server names only a field the form has no place for @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { body: 'The request body must be a JSON object.' } }));
    await user.click(nextWeek());
    await user.click(build());
    expect(document.activeElement).toBe(await screen.findByRole('alert'));
  });

  it('puts focus back on the failure message after "Try again" fails again @spec(app-views/outcomes-of-a-submit/a-failure-moves-focus)', async () => {
    const { api, user } = await open(pastedRecord, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await user.click(nextWeek());
    await user.click(build());
    const first = await screen.findByRole('alert');
    await user.click(within(first).getByRole('button', { name: 'Try again' }));
    expect(api.postPlan).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});

// Task 2.4: the states use the new components. Behavior and wording stay as in E1; only roles and looks are checked here.
describe('App: states look like the design system', () => {
  const classesOf = (el: HTMLElement) => el.className.split(/\s+/);

  it('shows the loading, building and waking lines as status messages on the soft surface @spec(messages-and-states/loading-building-and-waking-states/building)', async () => {
    const api = fakeApi(pastedRecord, () => new Promise(() => {}));
    let release!: () => void;
    const gate = new Promise<ReturnType<typeof ok<typeof pastedRecord>>>((r) => { release = () => r(ok(pastedRecord)); });
    const slow = { getPlan: vi.fn(() => gate), postPlan: api.postPlan };
    render(<App api={slow} />);
    const loading = screen.getByRole('status');
    expect(loading.textContent).toBe('Loading your saved plan…');
    expect(classesOf(loading)).toContain('bg-secondary');
    await act(async () => { release(); });
    await screen.findByRole('region', { name: 'Your plan' });
    vi.useFakeTimers();
    fireEvent.click(nextWeek());
    fireEvent.click(build());
    expect(classesOf(screen.getByRole('status'))).toContain('bg-secondary');
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole('status').textContent).toMatch(/waking up the coach/i);
    expect(classesOf(screen.getByRole('status'))).toContain('bg-secondary');
  });

  it('shows a failure as an alert in the danger style with a warning icon and a primary "Try again" button @spec(messages-and-states/failures/alert-role)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await user.click(nextWeek());
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(classesOf(alert)).toEqual(expect.arrayContaining(['bg-alert', 'border-alert-border', 'text-alert-foreground']));
    expect(alert.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(alert.textContent).toMatch(/nothing was saved/i);
    expect(classesOf(within(alert).getByRole('button', { name: 'Try again' }))).toContain('bg-primary');
  });

  it('shows no retry and "No retries remain today." for an unreadable week on the last call @spec(messages-and-states/failures/no-retries-remain-for-an-unreadable-week)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('plan_unreadable', { message: 'No running sessions found for week 4 in your pasted plan.', remainingCallsToday: 0 }));
    await user.click(nextWeek());
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No retries remain today.');
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows the validation failure with its sentence and each field message, and no retry @spec(messages-and-states/failures/validation-failure-shows-fields)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { goal: 'Goal is required from the server.' } }));
    await user.click(nextWeek());
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Some answers need fixing. Check the highlighted fields.');
    expect(screen.getByText('Goal is required from the server.')).toBeTruthy();
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows the failed-read message in the soft style, not as an alert', async () => {
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), postPlan: vi.fn() };
    render(<App api={api} />);
    const note = await screen.findByText('Could not load your saved plan. You can still build a new one.');
    expect(classesOf(note.closest('[data-slot="alert"]') as HTMLElement)).toContain('bg-secondary');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('App: labels named by the E1 specs', () => {
  it('shows "from your plan", "coach suggestion", "Rest day", the week, the safety note and "Plan next week" @spec(app-views/labels-named-by-the-e1-specs-keep-their-wording/spec-named-labels-are-present)', async () => {
    const base = planRecord({ existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 3 });
    const record = {
      ...base,
      plan: {
        days: base.plan.days.map((d) => (d.day === 'mon' ? { ...d, sessions: [{ discipline: 'running' as const, description: '5 km easy', intensity: 'easy' as const, source: 'athlete' as const }] } : d)),
        recommendations: ['Add a mobility session.'],
        safetyNote: 'Please see a qualified professional.',
      },
    };
    await open(record);
    expect(screen.getByText('from your plan')).toBeTruthy();
    expect(screen.getByText('coach suggestion')).toBeTruthy();
    expect(screen.getAllByText('Rest day')).toHaveLength(6);
    expect(screen.getByText('Week 3 of your running plan')).toBeTruthy();
    expect(within(screen.getByRole('note', { name: 'Safety note' })).getByText('Please see a qualified professional.')).toBeTruthy();
    expect(nextWeek()).toBeTruthy();
  });
});

describe('App: review fixes', () => {
  it('puts focus on the plan heading when the first plan is built from an empty form @spec(app-views/outcomes-of-a-submit/success-shows-the-new-plan)', async () => {
    const { user } = await open(null);
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Your plan' }));
  });

  it('shows "My plan" as an outline design-system button', async () => {
    const { user } = await open(pastedRecord);
    await user.click(newPlan());
    const classes = myPlan().className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['border-border', 'bg-card', 'h-11', 'pointer-fine:h-9']));
  });
});
