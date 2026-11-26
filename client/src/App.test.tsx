import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App.js';
import { apiFail, fakeApi, ok, planRecord, planResponse } from './test-helpers.js';
import type { PlanResponse } from 'shared';
import type { Api } from './api.js';

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
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), deletePlan: vi.fn(), postPlan: vi.fn() };
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
    expect(api.postPlan).toHaveBeenCalledWith(expect.objectContaining({ pastedPlanWeek: 6 }), expect.any(String));
  });

  it('submits the pre-filled form once, as any onboarding @spec(plan-storage/plan-next-week/submitting-counts-as-a-normal-call)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(nextWeek());
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledTimes(1);
    expect(api.postPlan).toHaveBeenCalledWith({ ...pastedRecord.onboarding, pastedPlanWeek: 4 }, expect.any(String));
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
    const api = { getPlan: vi.fn(() => gate.p), deletePlan: vi.fn(), postPlan: vi.fn() };
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
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), deletePlan: vi.fn(), postPlan: vi.fn() };
    render(<App api={api} />);
    expect(await screen.findByText('Could not load your saved plan. You can still build a new one.')).toBeTruthy();
    expect(build()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My plan' })).toBeNull();
  });

  it('drops the failed-read message once the athlete builds a plan and presses "New plan" @spec(app-views/start-state/the-failed-read-message-does-not-follow-the-athlete)', async () => {
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), deletePlan: vi.fn(), postPlan: vi.fn(async () => ok(planResponse)) };
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
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/goal/i))); // the focus effect runs just after the message
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
    const slow = { getPlan: vi.fn(() => gate), deletePlan: vi.fn(), postPlan: api.postPlan };
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
    const api = { getPlan: vi.fn(async () => ({ ok: false as const, failure: { kind: 'network' as const } })), deletePlan: vi.fn(), postPlan: vi.fn() };
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

describe('App: week 53 after Plan next week', () => {
  it('opens the form with week 53, its error and focus on that field, and lets the athlete fix it @spec(form-presentation/same-validation-and-behavior-as-e1/week-53-after-plan-next-week)', async () => {
    const { api, user } = await open(planRecord({ existingRunningPlan: 'Mon 5 km', pastedPlanWeek: 52 }));
    await user.click(nextWeek());
    expect(week()).toBe('53');
    expect(screen.getByText('The plan week must be a whole number from 1 to 52.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/week of your plan/i));
    expect(screen.getByRole('heading', { level: 2, name: 'New plan' })).toBeTruthy();
    // the value is editable before submitting, and the error goes once it is fixed
    await user.clear(screen.getByLabelText(/week of your plan/i));
    await user.type(screen.getByLabelText(/week of your plan/i), '1');
    expect(screen.queryByText('The plan week must be a whole number from 1 to 52.')).toBeNull();
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledWith(expect.objectContaining({ pastedPlanWeek: 1 }), expect.any(String));
  });
});

// Task 2.1: every plan request names its week. Only Date is faked (user-event needs the real timers), and the zone is
// changed through TZ; the offset check proves the zone really moved.
describe('App: the week every request asks for', () => {
  const realTz = process.env.TZ;
  afterEach(() => {
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  });
  const clock = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };
  const shownWeek = (weekStart: string) => ({ ...planRecord(), weekStart });
  const sentWeek = (api: Awaited<ReturnType<typeof open>>['api'], call = 0) => api.postPlan.mock.calls[call]?.[1];

  it('asks for the current week with the first plan @spec(plan-week/the-client-asks-for-the-right-week/first-plan-is-for-the-current-week)', async () => {
    clock('2026-11-26T12:00:00Z'); // a Thursday
    const { api, user } = await open(null);
    await fillValidForm(user);
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledTimes(1);
    expect(sentWeek(api)).toBe('2026-11-23');
  });

  it('lets the athlete see no week field: the week is not theirs to edit', async () => {
    clock('2026-11-26T12:00:00Z');
    await open(null);
    expect(screen.queryByLabelText(/week start|starts on|week of/i)).toBeNull(); // "week of your plan" appears only with a pasted plan
  });

  it('takes the week from the athlete\'s calendar, not from UTC @spec(plan-week/the-client-asks-for-the-right-week/the-week-follows-the-athletes-calendar)', async () => {
    process.env.TZ = 'Europe/Madrid';
    const at = '2026-11-29T23:30:00Z'; // 00:30 on Monday 30 November in Madrid, still Sunday in UTC
    expect(-new Date(at).getTimezoneOffset()).toBe(60);
    clock(at);
    const { api, user } = await open(null);
    await fillValidForm(user);
    await user.click(build());
    expect(sentWeek(api)).toBe('2026-11-30');
  });

  it('asks for the shown week plus 7 days with "Plan next week" @spec(plan-week/the-client-asks-for-the-right-week/plan-next-week-moves-one-week)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { api, user } = await open(shownWeek('2026-11-23'));
    await user.click(nextWeek());
    await user.click(build());
    expect(sentWeek(api)).toBe('2026-11-30');
  });

  it('crosses a month and a year @spec(plan-week/the-client-asks-for-the-right-week/plan-next-week-crosses-a-month-and-a-year)', async () => {
    clock('2026-12-30T12:00:00Z');
    const { api, user } = await open(shownWeek('2026-12-28'));
    await user.click(nextWeek());
    await user.click(build());
    expect(sentWeek(api)).toBe('2027-01-04');
  });

  it('never plans the past: an old shown week gives the current Monday @spec(plan-week/the-client-asks-for-the-right-week/plan-next-week-never-plans-the-past)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { api, user } = await open(shownWeek('2026-10-26')); // four weeks back
    await user.click(nextWeek());
    await user.click(build());
    expect(sentWeek(api)).toBe('2026-11-23');
  });

  it('asks for the current week again with "New plan", even when a later week is shown @spec(plan-week/the-client-asks-for-the-right-week/new-plan-is-for-the-current-week-again)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { api, user } = await open(shownWeek('2026-12-07'));
    await user.click(newPlan());
    await fillValidForm(user);
    await user.click(build());
    expect(sentWeek(api)).toBe('2026-11-23');
  });

  it('does not keep the next week after the athlete goes back and chooses "New plan"', async () => {
    clock('2026-11-26T12:00:00Z');
    const { api, user } = await open(shownWeek('2026-11-23'));
    await user.click(nextWeek());
    await user.click(myPlan());
    await user.click(newPlan());
    await fillValidForm(user);
    await user.click(build());
    expect(sentWeek(api)).toBe('2026-11-23');
  });

  it('repeats the week of a first plan on "Try again" when the calendar has moved on @spec(plan-week/the-client-asks-for-the-right-week/a-retry-keeps-the-week)', async () => {
    clock('2026-11-29T20:00:00Z'); // Sunday evening: this week is 2026-11-23
    const { api, user } = await open(null, async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await fillValidForm(user);
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(sentWeek(api)).toBe('2026-11-23');
    vi.setSystemTime(new Date('2026-12-08T09:00:00Z')); // "now" would give 2026-12-07
    api.postPlan.mockImplementationOnce(async () => ok(planResponse));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(sentWeek(api, 1)).toBe('2026-11-23');
  });

  it('repeats the same week on "Try again", even after the calendar has moved on @spec(plan-week/the-client-asks-for-the-right-week/a-retry-keeps-the-week)', async () => {
    clock('2026-11-29T20:00:00Z'); // Sunday evening
    const { api, user } = await open(shownWeek('2026-11-23'), async () => apiFail('coach_unavailable', { remainingCallsToday: 5 }));
    await user.click(nextWeek());
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(sentWeek(api)).toBe('2026-11-30');
    vi.setSystemTime(new Date('2026-12-08T09:00:00Z')); // a week later: "now" would give 2026-12-07
    api.postPlan.mockImplementationOnce(async () => ok(planResponse));
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(api.postPlan).toHaveBeenCalledTimes(2);
    expect(sentWeek(api, 1)).toBe('2026-11-30');
  });
});

// Task 2.2: the server refuses a week (an old page left open for months, or a clock far off).
describe('App: a refused week', () => {
  it('says the week is too far away, highlights no field and offers no retry @spec(plan-week/the-client-asks-for-the-right-week/a-week-that-is-too-far-away-is-explained)', async () => {
    const { user } = await open(pastedRecord, async () => apiFail('validation_error', { fields: { weekStart: 'The week must start on a Monday, within half a year of today.' } }));
    await user.click(nextWeek());
    await user.click(build());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That week is too far from today. Use New plan to start from this week.');
    expect(alert.textContent).not.toMatch(/highlighted/i);
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull(); // no control is flagged: the week is not a field
    // E1b's rule stays: a server field the form has no place for is shown, never hidden, so the server's own sentence
    // also appears under the form.
    expect(screen.getByText('The week must start on a Monday, within half a year of today.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(alert)); // the alert takes focus: no form field was named
  });
});

// Task 2.4 (coach-plan-week-and-delete): the button and its confirmation, as the App wires them. The behaviour of the
// confirmation itself (focus, the half second, Cancel) is in PlanActions.test.tsx.
describe('App: the delete button', () => {
  const deleteButton = () => screen.getByRole('button', { name: 'Delete this plan' });

  it('is offered in the summary card, and the row below holds only "Plan next week" and "New plan" @spec(plan-deletion/delete-button-with-a-confirmation/button-is-offered-with-a-plan)', async () => {
    await open(pastedRecord);
    expect(within(screen.getByRole('region', { name: 'Your plan' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Delete this plan']);
    const outside = screen.getAllByRole('button').filter((b) => !screen.getByRole('region', { name: 'Your plan' }).contains(b));
    expect(outside.map((b) => b.textContent)).toEqual(['Plan next week', 'New plan']);
  });

  it('is not offered in the form view, with or without a saved plan @spec(plan-deletion/delete-button-with-a-confirmation/button-is-offered-with-a-plan)', async () => {
    const { user } = await open(pastedRecord);
    await user.click(newPlan());
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull();
    cleanup();
    await open(null);
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull();
  });

  it('is not offered while the saved plan loads @spec(plan-deletion/delete-button-with-a-confirmation/button-is-offered-with-a-plan)', () => {
    const api = { getPlan: vi.fn(() => new Promise<never>(() => {})), postPlan: vi.fn(), deletePlan: vi.fn() };
    render(<App api={api} />);
    expect(screen.getByRole('status').textContent).toMatch(/loading your saved plan/i);
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull();
  });

  it('asks first: the question replaces the three buttons and nothing is sent @spec(plan-deletion/delete-button-with-a-confirmation/confirmation-comes-first)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(deleteButton());
    expect(screen.getByText('Delete the plan for the week of 9 Nov? This cannot be undone.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Delete plan', 'Plan next week', 'New plan']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(within(screen.getByRole('region', { name: 'Your plan' })).getByText('Delete the plan for the week of 9 Nov? This cannot be undone.')).toBeTruthy(); // the question is in the card
    expect(api.deletePlan).not.toHaveBeenCalled();
    expect(api.postPlan).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy(); // the plan is still shown
  });

  it('keeps the plan on Cancel, with the trash button back and focus on it @spec(plan-deletion/delete-button-with-a-confirmation/cancel-keeps-the-plan)', async () => {
    const { api, user } = await open(pastedRecord);
    await user.click(deleteButton());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Delete this plan', 'Plan next week', 'New plan']);
    expect(document.activeElement).toBe(deleteButton());
    expect(api.deletePlan).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Your plan' })).toBeTruthy();
  });
});

// Task 2.5 (coach-plan-week-and-delete): "Delete plan" sends the deletion and every outcome has its own screen. Only Date
// is faked, so the half second after the question opens can pass without waiting.
describe('App: deleting the shown plan', () => {
  const NOT_DELETED = 'The plan could not be deleted. Nothing was changed. You can try again.';
  const MAYBE_DELETED = 'The plan may already be deleted. Reload the page to check, or try again.';
  const three = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent); // the icon button has no text
  const gate = () => { let resolve!: (r: Awaited<ReturnType<Api['deletePlan']>>) => void; const p = new Promise<Awaited<ReturnType<Api['deletePlan']>>>((r) => { resolve = r; }); return { p, resolve }; };

  // Opens the question and lets the half second pass, so the next press on "Delete plan" counts.
  async function ask(user: ReturnType<typeof userEvent.setup>) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
    act(() => { vi.setSystemTime(Date.now() + 600); });
  }
  const yes = () => screen.getByRole('button', { name: 'Delete plan' });

  it('sends the deletion of the shown plan, by its id, and nothing else @spec(plan-deletion/delete-button-with-a-confirmation/the-deletion-names-the-shown-plan)', async () => {
    const { api, user } = await open({ ...pastedRecord, id: 41 });
    await ask(user);
    await user.click(yes());
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
    expect(api.deletePlan).toHaveBeenCalledWith(41);
    expect(api.postPlan).not.toHaveBeenCalled(); // the coach is never asked
  });

  it('names the plan made in this visit, not an older stored one @spec(plan-deletion/delete-button-with-a-confirmation/the-deletion-names-the-shown-plan)', async () => {
    const { api, user } = await open({ ...pastedRecord, id: 3 }, async () => ok({ ...planResponse, id: 9 }));
    await user.click(nextWeek());
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    await ask(user);
    await user.click(yes());
    expect(api.deletePlan).toHaveBeenCalledWith(9);
  });

  it('clears the plan and opens the empty form with its heading focused @spec(plan-deletion/delete-button-with-a-confirmation/confirming-deletes-the-plan-and-opens-a-new-form)', async () => {
    const { api, user } = await open(pastedRecord);
    await ask(user);
    await user.click(yes());
    expect(await screen.findByRole('heading', { level: 2, name: 'New plan' })).toBeTruthy();
    expect(planRegion()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'New plan' })));
    expect((screen.getByLabelText(/goal/i) as HTMLTextAreaElement).value).toBe(''); // no answers of the deleted plan
    expect(screen.queryByLabelText(/week of your plan/i)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'My plan' })).toBeNull(); // nothing to go back to
    expect(api.postPlan).not.toHaveBeenCalled();
  });

  it('does not bring an older stored plan back until the page is reloaded @spec(plan-deletion/delete-button-with-a-confirmation/an-older-plan-can-remain-stored)', async () => {
    const { api, user } = await open(pastedRecord, async () => ok({ ...planResponse, id: 9 }));
    await user.click(nextWeek());
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    await ask(user);
    await user.click(yes());
    await screen.findByRole('heading', { level: 2, name: 'New plan' });
    expect(planRegion()).toBeNull();
    expect(screen.queryByRole('button', { name: 'My plan' })).toBeNull(); // neither the deleted plan nor the older one can be opened
    expect(api.getPlan).toHaveBeenCalledTimes(1); // the older plan is read again only by a reload
  });

  it('treats a plan that is already gone (404) as deleted @spec(plan-deletion/delete-button-with-a-confirmation/a-plan-that-is-already-gone-counts-as-deleted)', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('not_found'));
    await ask(user);
    await user.click(yes());
    expect(await screen.findByRole('heading', { level: 2, name: 'New plan' })).toBeTruthy();
    expect(planRegion()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends one request however often "Delete plan" is pressed, and disables both buttons while it runs @spec(plan-deletion/delete-button-with-a-confirmation/one-request-however-often-it-is-pressed)', async () => {
    const { api, user } = await open(pastedRecord);
    const g = gate();
    api.deletePlan.mockReturnValueOnce(g.p);
    await ask(user);
    const button = yes();
    act(() => { button.click(); button.click(); }); // two presses before the screen has changed
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
    expect((yes() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(yes());
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
    await act(async () => { g.resolve(ok(undefined)); });
    expect(await screen.findByRole('heading', { level: 2, name: 'New plan' })).toBeTruthy();
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
  });

  it('keeps the plan and says nothing was changed after a server error, with focus on the alert @spec(plan-deletion/delete-button-with-a-confirmation/a-failed-deletion-keeps-the-plan)', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('server_error'));
    await ask(user);
    await user.click(yes());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(NOT_DELETED);
    expect(planRegion()).toBeTruthy();
    expect(planRegion()?.contains(alert)).toBe(true); // the alert is in the summary card, next to the trash button
    expect(three()).toEqual(['Delete this plan', 'Plan next week', 'New plan']);
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it('says the same after any other error the server sends, such as a refused id @spec(plan-deletion/delete-button-with-a-confirmation/a-failed-deletion-keeps-the-plan)', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('validation_error', { fields: { id: 'bad' } }));
    await ask(user);
    await user.click(yes());
    expect((await screen.findByRole('alert')).textContent).toContain(NOT_DELETED);
    expect(planRegion()).toBeTruthy();
  });

  it.each([['network'], ['timeout']] as const)('says the plan may already be deleted after a %s failure, and keeps the plan @spec(plan-deletion/delete-button-with-a-confirmation/a-deletion-that-may-have-happened-says-so)', async (kind) => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce({ ok: false, failure: { kind } });
    await ask(user);
    await user.click(yes());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(MAYBE_DELETED);
    expect(planRegion()).toBeTruthy();
    expect(three()).toEqual(['Delete this plan', 'Plan next week', 'New plan']);
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it('lets the athlete try again after a failure, and the alert goes @spec(plan-deletion/delete-button-with-a-confirmation/a-failed-deletion-keeps-the-plan)', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('server_error'));
    await ask(user);
    await user.click(yes());
    await screen.findByRole('alert');
    await ask(user); // a second attempt starts from "Delete this plan" again
    await user.click(yes());
    expect(await screen.findByRole('heading', { level: 2, name: 'New plan' })).toBeTruthy();
    expect(api.deletePlan).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts focus on the alert again when a second attempt fails too', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValue(apiFail('server_error'));
    await ask(user);
    await user.click(yes());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Delete this plan' })); // focus leaves the alert
    act(() => { vi.setSystemTime(Date.now() + 600); });
    await user.click(yes());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')));
  });

  it('clears the alert on every change of view', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('server_error'));
    await ask(user);
    await user.click(yes());
    await screen.findByRole('alert');
    await user.click(newPlan());
    expect(screen.queryByText(NOT_DELETED)).toBeNull();
    await user.click(myPlan());
    expect(screen.queryByText(NOT_DELETED)).toBeNull();
    expect(planRegion()).toBeTruthy();
  });

  it('drops the confirmation on a failure, so the athlete is not left on a question that has been answered', async () => {
    const { api, user } = await open(pastedRecord);
    api.deletePlan.mockResolvedValueOnce(apiFail('server_error'));
    await ask(user);
    await user.click(yes());
    await screen.findByRole('alert');
    expect(screen.queryByText('Delete the plan for the week of 9 Nov? This cannot be undone.')).toBeNull();
  });

  it.each([['Plan next week'], ['New plan']])('closes an open question when "%s" is pressed, and it does not come back @spec(plan-deletion/delete-button-with-a-confirmation/cancel-keeps-the-plan)', async (name) => {
    const { api, user } = await open(pastedRecord);
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
    expect(screen.getByText('Delete the plan for the week of 9 Nov? This cannot be undone.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name }));
    await user.click(myPlan());
    expect(screen.queryByText('Delete the plan for the week of 9 Nov? This cannot be undone.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete this plan' })).toBeTruthy();
    expect(api.deletePlan).not.toHaveBeenCalled();
  });
});
