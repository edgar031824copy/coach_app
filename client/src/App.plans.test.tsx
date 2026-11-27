import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlanRecord } from 'shared';
import { App } from './App.js';
import { apiFail, fakeApi, ok, planRecord, planResponse } from './test-helpers.js';

// Tasks 2.2 to 2.5 (coach-plan-history): the page holds every stored plan, opens on the right one, moves between weeks,
// lands on the nearest week after a deletion and warns before a plan replaces another. Only Date is faked.
const rec = (id: number, weekStart: string, createdAt = '2026-11-20T10:00:00.000Z', goal = `plan ${id}`): PlanRecord => ({ ...planRecord({ goal }), id, weekStart, createdAt });
const W9 = rec(1, '2026-11-09');
const W16 = rec(2, '2026-11-16');
const W23 = rec(3, '2026-11-23');
const W30 = rec(4, '2026-11-30');
const clock = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };
afterEach(() => vi.useRealTimers());
const realTz = process.env.TZ;
afterEach(() => { if (realTz === undefined) delete process.env.TZ; else process.env.TZ = realTz; });

const earlier = () => screen.getByRole('button', { name: 'Earlier plan' });
const later = () => screen.getByRole('button', { name: 'Later plan' });
const label = () => within(screen.getByRole('region', { name: 'Your plan' })).getByText(/^Week of .* · \d+ of \d+$/).textContent;
const weekLine = () => screen.getByRole('region', { name: 'Your plan' }).textContent;
const build = () => screen.getByRole('button', { name: /build my plan/i });
// The smallest valid form.
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  const inGroup = (group: string, name: string) => within(screen.getByRole('group', { name: group })).getByRole('checkbox', { name });
  await user.type(screen.getByLabelText(/goal/i), 'Run a half marathon');
  await user.click(within(screen.getByRole('group', { name: 'Running level' })).getByRole('radio', { name: 'Intermediate' }));
  await user.click(within(screen.getByRole('group', { name: 'CrossFit level' })).getByRole('radio', { name: 'Beginner' }));
  await user.click(inGroup('Running days', 'Mon'));
  await user.click(inGroup('CrossFit days', 'Tue'));
}

async function open(saved: PlanRecord[], post?: Parameters<typeof fakeApi>[1]) {
  const api = fakeApi(saved, post);
  const user = userEvent.setup();
  render(<App api={api} />);
  await screen.findByRole('region', { name: 'Your plan' });
  return { api, user };
}
// A shown plan is told apart by its week line: "Week of 23 Nov" (one plan) or "Week of 23 Nov · 3 of 4" (switcher).
const shownWeek = () => /Week of (\d+ [A-Z][a-z]{2})/.exec(screen.getByRole('region', { name: 'Your plan' }).textContent ?? '')?.[1];

describe('App: the plan shown on start', () => {
  it('opens the plan of the current week, not the one made most recently @spec(stored-plans/the-plan-shown-on-start/the-current-week-opens)', async () => {
    clock('2026-11-26T12:00:00Z');
    await open([W16, W23, { ...W30, createdAt: '2026-11-26T09:00:00.000Z' }]);
    expect(shownWeek()).toBe('23 Nov');
    expect(label()).toBe('Week of 23 Nov · 2 of 3');
  });

  it('opens the plan made most recently when no plan is for the current week @spec(stored-plans/the-plan-shown-on-start/no-plan-for-the-current-week)', async () => {
    clock('2026-11-26T12:00:00Z');
    await open([rec(5, '2026-11-02', '2026-11-03T10:00:00.000Z'), rec(6, '2026-11-09', '2026-11-10T10:00:00.000Z')]);
    expect(shownWeek()).toBe('9 Nov');
  });

  it("takes the current week from the athlete's calendar, not from UTC @spec(stored-plans/the-plan-shown-on-start/the-athletes-calendar-decides-the-current-week)", async () => {
    process.env.TZ = 'Europe/Madrid';
    const at = '2026-11-29T23:30:00Z'; // 00:30 on Monday 30 November in Madrid, still Sunday in UTC
    expect(-new Date(at).getTimezoneOffset()).toBe(60);
    clock(at);
    await open([W23, W30]);
    expect(shownWeek()).toBe('30 Nov');
  });

  it('opens the only plan with one read of the list and none of the single plan @spec(app-views/start-state/a-saved-plan-opens-the-plan-view)', async () => {
    const one = await open([W23]);
    expect(shownWeek()).toBe('23 Nov');
    expect(one.api.getPlans).toHaveBeenCalledTimes(1);
    expect(one.api.getPlan).not.toHaveBeenCalled();
  });

  it('opens the form view when the list is empty @spec(app-views/start-state/no-saved-plan-opens-the-form-view)', async () => {
    const api = fakeApi([]);
    render(<App api={api} />);
    expect(await screen.findByRole('button', { name: /build my plan/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull();
  });
});

describe('App: a built plan joins the list', () => {
  it('adds a new week in order and shows it, and "Earlier plan" shows the week before @spec(stored-plans/a-new-or-replaced-plan-is-shown/a-new-week-joins-the-list)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { api, user } = await open([W16, W23], async () => ok({ ...planResponse, id: 9, weekStart: '2026-11-30' }));
    await user.click(screen.getByRole('button', { name: 'Plan next week' }));
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.postPlan).toHaveBeenCalledWith(expect.anything(), '2026-11-30');
    expect(label()).toBe('Week of 30 Nov · 3 of 3');
    await user.click(earlier());
    expect(shownWeek()).toBe('23 Nov');
  });

  it('puts a rebuilt week in the place of the old one, with the same number of plans @spec(stored-plans/a-new-or-replaced-plan-is-shown/a-rebuilt-week-is-not-duplicated)', async () => {
    clock('2026-11-26T12:00:00Z');
    const rebuilt = { ...planResponse, id: 3, weekStart: '2026-11-23', plan: { ...planResponse.plan, recommendations: ['the new one'] } };
    const { api, user } = await open([W16, W23, W30], async () => ok(rebuilt));
    await user.click(screen.getByRole('button', { name: 'New plan' })); // the current week: 23 Nov
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.postPlan).toHaveBeenCalledWith(expect.anything(), '2026-11-23');
    expect(label()).toBe('Week of 23 Nov · 2 of 3'); // still three plans
    expect(screen.getByText('the new one')).toBeTruthy();
    await user.click(later());
    await user.click(earlier());
    expect(screen.getByText('the new one')).toBeTruthy(); // the old plan of that week is gone, not behind the switcher
  });
});

describe('App: a failed start read', () => {
  const failing = () => ({ ok: false as const, failure: { kind: 'network' as const } });
  const record = (id: number, weekStart: string) => ({ ...planResponse, id, weekStart });

  it('reads the list again after the first successful build, and lists every stored plan @spec(app-views/start-state/a-failed-read-is-read-again-after-a-build)', async () => {
    clock('2026-11-26T12:00:00Z');
    const api = fakeApi([W16, W23], async () => ok(record(9, '2026-11-30')));
    api.getPlans.mockResolvedValueOnce(failing());
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByText(/could not load your saved plan/i);
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.getPlans).toHaveBeenCalledTimes(2);
    expect(label()).toBe('Week of 30 Nov · 3 of 3');
    await user.click(earlier());
    expect(shownWeek()).toBe('23 Nov');
  });

  it('shows the plan just built alone when the second read fails too, and reads no third time @spec(app-views/start-state/a-failed-read-is-read-again-after-a-build)', async () => {
    const api = fakeApi([W16], async () => ok(record(9, '2026-11-30')));
    api.getPlans.mockResolvedValueOnce(failing()).mockResolvedValueOnce(failing());
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByText(/could not load your saved plan/i);
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(shownWeek()).toBe('30 Nov');
    expect(screen.queryByRole('button', { name: 'Earlier plan' })).toBeNull(); // one plan: no switcher
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.getPlans).toHaveBeenCalledTimes(2); // not a third time
  });

  it('stays busy while the list is read again: the button is disabled and a second press sends nothing', async () => {
    const api = fakeApi([W16], async () => ok(record(9, '2026-11-30')));
    let release!: () => void;
    api.getPlans.mockResolvedValueOnce(failing()).mockImplementationOnce(() => new Promise((r) => { release = () => r(ok([W16])); }));
    const user = userEvent.setup();
    render(<App api={api} />);
    await screen.findByText(/could not load your saved plan/i);
    await fillValidForm(user);
    await user.click(build());
    await waitFor(() => expect(api.getPlans).toHaveBeenCalledTimes(2)); // the build is done, the re-read is pending
    expect((build() as HTMLButtonElement).disabled).toBe(true);
    await user.click(build());
    expect(api.postPlan).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
    await screen.findByRole('region', { name: 'Your plan' });
    expect(label()).toBe('Week of 30 Nov · 2 of 2');
  });

  it('does not read again when the start read worked', async () => {
    const { api, user } = await open([W16], async () => ok(record(9, '2026-11-30')));
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    await fillValidForm(user);
    await user.click(build());
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.getPlans).toHaveBeenCalledTimes(1);
  });
});

describe('App: the week switcher', () => {
  const five = [rec(5, '2026-11-02'), W9, W16, W23, W30];

  it('shows the position and the two buttons @spec(stored-plans/moving-between-weeks/the-switcher-shows-the-position)', async () => {
    clock('2026-11-19T12:00:00Z');
    await open(five);
    expect(label()).toBe('Week of 16 Nov · 3 of 5');
    expect(earlier()).toBeTruthy();
    expect(later()).toBeTruthy();
    expect(earlier().textContent).toBe(''); // icon only: the name is the label
    expect(earlier().className.split(/\s+/)).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  });

  it('moves one stored week earlier and later and sends no request @spec(stored-plans/moving-between-weeks/earlier-and-later-move-one-stored-week)', async () => {
    clock('2026-11-19T12:00:00Z');
    const { api, user } = await open(five);
    await user.click(earlier());
    expect(label()).toBe('Week of 9 Nov · 2 of 5');
    await user.click(later());
    expect(label()).toBe('Week of 16 Nov · 3 of 5');
    expect(api.postPlan).not.toHaveBeenCalled();
    expect(api.deletePlan).not.toHaveBeenCalled();
    expect(api.getPlans).toHaveBeenCalledTimes(1);
    expect(api.getPlan).not.toHaveBeenCalled();
  });

  it('skips weeks without a plan @spec(stored-plans/moving-between-weeks/weeks-without-a-plan-are-skipped)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { user } = await open([rec(5, '2026-11-02'), W23]);
    await user.click(earlier());
    expect(label()).toBe('Week of 2 Nov · 1 of 2');
  });

  it.each([['Earlier plan', '2026-11-12T12:00:00Z', 'Week of 9 Nov · 1 of 2'], ['Later plan', '2026-11-26T12:00:00Z', 'Week of 23 Nov · 2 of 2']])('%s does nothing at its end, keeps focus and is aria-disabled, not disabled @spec(stored-plans/moving-between-weeks/the-ends-do-nothing)', async (name, now, text) => {
    clock(now);
    const { user } = await open([W9, W23]);
    const button = screen.getByRole('button', { name });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(false);
    await user.click(button);
    expect(label()).toBe(text);
    expect(document.activeElement).toBe(button);
    // the other button is not marked
    expect(screen.getByRole('button', { name: name === 'Earlier plan' ? 'Later plan' : 'Earlier plan' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps focus on the pressed button after moving, and marks the end it reaches', async () => {
    clock('2026-11-12T12:00:00Z');
    const { user } = await open([W9, W16]);
    await user.click(later());
    expect(document.activeElement).toBe(later());
    expect(later().getAttribute('aria-disabled')).toBe('true'); // focus did not drop although it is now the last plan
    expect(earlier().getAttribute('aria-disabled')).toBeNull();
  });

  it('has no switcher, no count and no buttons with one plan @spec(stored-plans/moving-between-weeks/one-plan-has-no-switcher)', async () => {
    await open([W23]);
    expect(screen.queryByRole('button', { name: 'Earlier plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Later plan' })).toBeNull();
    expect(weekLine()).toContain('Week of 23 Nov');
    expect(weekLine()).not.toMatch(/\d+ of \d+/);
  });

  it('announces the new text in a polite live region @spec(stored-plans/moving-between-weeks/the-change-is-announced)', async () => {
    clock('2026-11-19T12:00:00Z');
    const { user } = await open(five);
    const region = screen.getByText('Week of 16 Nov · 3 of 5');
    expect(region.getAttribute('aria-live')).toBe('polite');
    await user.click(later());
    expect(screen.getByText('Week of 23 Nov · 4 of 5')).toBe(region); // the same element changes its text
  });

  describe('what a move clears', () => {
    const NOT_DELETED = 'The plan could not be deleted. Nothing was changed. You can try again.';
    async function ask(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
      act(() => { vi.setSystemTime(Date.now() + 600); });
    }

    it('closes an open question @spec(stored-plans/moving-between-weeks/moving-closes-a-question)', async () => {
      clock('2026-11-19T12:00:00Z');
      const { user } = await open(five);
      await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
      expect(screen.getByRole('group', { name: /delete the plan/i })).toBeTruthy();
      await user.click(later());
      expect(screen.queryByRole('group', { name: /delete the plan/i })).toBeNull();
      expect(label()).toBe('Week of 23 Nov · 4 of 5');
      expect(screen.getByRole('button', { name: 'Delete this plan' })).toBeTruthy(); // the trash button is back
    });

    it('clears a deletion alert @spec(stored-plans/moving-between-weeks/moving-clears-a-failure-alert)', async () => {
      clock('2026-11-19T12:00:00Z');
      const { api, user } = await open(five);
      api.deletePlan.mockResolvedValueOnce(apiFail('server_error'));
      await ask(user);
      await user.click(screen.getByRole('button', { name: 'Delete plan' }));
      expect((await screen.findByRole('alert')).textContent).toContain(NOT_DELETED);
      await user.click(earlier());
      expect(screen.queryByRole('alert')).toBeNull();
      expect(label()).toBe('Week of 9 Nov · 2 of 5');
    });

    it('clears the status line of a deletion @spec(stored-plans/moving-between-weeks/moving-clears-the-status-line)', async () => {
      clock('2026-11-19T12:00:00Z');
      const { user } = await open(five);
      await ask(user);
      await user.click(screen.getByRole('button', { name: 'Delete plan' }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Deleted the plan/));
      await user.click(earlier());
      expect(screen.getByRole('status').textContent).toBe('');
    });

    it('disables both buttons while a deletion runs @spec(stored-plans/moving-between-weeks/disabled-while-a-deletion-runs)', async () => {
      clock('2026-11-19T12:00:00Z');
      const { api, user } = await open(five);
      let release!: () => void;
      api.deletePlan.mockImplementationOnce(() => new Promise((r) => { release = () => r(ok(undefined)); }));
      await ask(user);
      await user.click(screen.getByRole('button', { name: 'Delete plan' }));
      expect((earlier() as HTMLButtonElement).disabled).toBe(true);
      expect((later() as HTMLButtonElement).disabled).toBe(true);
      await act(async () => { release(); });
      await waitFor(() => expect((screen.getByRole('button', { name: 'Earlier plan' }) as HTMLButtonElement).disabled).toBe(false));
    });
  });
});

describe('App: a deletion lands on the nearest week', () => {
  async function remove(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
    act(() => { vi.setSystemTime(Date.now() + 600); });
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
  }
  const status = () => screen.getByRole('status').textContent;

  it('shows the next later week first, with the status line, and focuses the heading @spec(plan-deletion/delete-button-with-a-confirmation/the-next-later-week-is-shown-first)', async () => {
    clock('2026-11-19T12:00:00Z'); // opens on 16 Nov, the middle one of 9, 16, 23
    const { user } = await open([W9, W16, W23]);
    await remove(user);
    await waitFor(() => expect(shownWeek()).toBe('23 Nov'));
    expect(status()).toBe('Deleted the plan for the week of 16 Nov. Showing the week of 23 Nov.');
    expect(label()).toBe('Week of 23 Nov · 2 of 2');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Your plan' })));
  });

  it('shows the previous week when none is later @spec(plan-deletion/delete-button-with-a-confirmation/the-previous-week-is-shown-when-none-is-later)', async () => {
    clock('2026-11-26T12:00:00Z'); // opens on 23 Nov, the newest
    const { user } = await open([W9, W16, W23]);
    await remove(user);
    await waitFor(() => expect(shownWeek()).toBe('16 Nov'));
    expect(status()).toBe('Deleted the plan for the week of 23 Nov. Showing the week of 16 Nov.');
  });

  it('skips weeks without a plan, and with one plan left shows no switcher', async () => {
    clock('2026-11-12T12:00:00Z');
    const { user } = await open([W9, W23]);
    await remove(user);
    await waitFor(() => expect(shownWeek()).toBe('23 Nov'));
    expect(screen.queryByRole('button', { name: 'Earlier plan' })).toBeNull();
  });

  it('deletes the plan that is shown by its id, whichever week the switcher opened, and the other plan stays @spec(plan-deletion/delete-button-with-a-confirmation/the-deletion-names-the-shown-plan)', async () => {
    clock('2026-11-26T12:00:00Z'); // opens on 23 Nov (id 3)
    const { api, user } = await open([W9, W16, W23]);
    await user.click(earlier()); // 16 Nov, id 2
    await remove(user);
    expect(api.deletePlan).toHaveBeenCalledTimes(1);
    expect(api.deletePlan).toHaveBeenCalledWith(2);
    await waitFor(() => expect(shownWeek()).toBe('23 Nov')); // the plan of the later week is still there
  });

  it('opens the empty form when the last plan is deleted @spec(plan-deletion/delete-button-with-a-confirmation/confirming-deletes-the-plan-and-opens-a-new-form)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { user } = await open([W23]);
    await remove(user);
    const heading = await screen.findByRole('heading', { level: 2, name: 'New plan' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull();
  });

  it('treats a 404 like a success @spec(plan-deletion/delete-button-with-a-confirmation/a-plan-that-is-already-gone-counts-as-deleted)', async () => {
    clock('2026-11-19T12:00:00Z');
    const { api, user } = await open([W9, W16, W23]);
    api.deletePlan.mockResolvedValueOnce(apiFail('not_found'));
    await remove(user);
    await waitFor(() => expect(shownWeek()).toBe('23 Nov'));
    expect(status()).toContain('Deleted the plan for the week of 16 Nov.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ends the question with "Your other plans stay." only while other plans are stored @spec(plan-deletion/delete-button-with-a-confirmation/confirmation-comes-first)', async () => {
    clock('2026-11-19T12:00:00Z');
    const { user } = await open([W9, W16]);
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
    expect(screen.getByText(/^Delete the plan for the week of 16.Nov\? This cannot be undone\. Your other plans stay\.$/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await remove(user); // deletes 16 Nov; one plan (9 Nov) is left
    await waitFor(() => expect(shownWeek()).toBe('9 Nov'));
    await user.click(screen.getByRole('button', { name: 'Delete this plan' }));
    expect(screen.getByText(/This cannot be undone\.$/)).toBeTruthy();
    expect(screen.queryByText(/your other plans stay/i)).toBeNull();
  });
});

describe('App: the note before a plan replaces another', () => {
  const note = (week: string) => `You already have a plan for the week of ${week}. Building a new one replaces it.`;
  const nextWeekBtn = () => screen.getByRole('button', { name: 'Plan next week' });

  it('warns on "New plan" for the current week when it has a plan @spec(stored-plans/a-warning-before-a-plan-replaces-another/new-plan-for-a-week-that-has-a-plan)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { user } = await open([W23]);
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    expect(screen.getByRole('note').textContent).toBe(note('23 Nov'));
  });

  it('warns on "Plan next week" into a stored week @spec(stored-plans/a-warning-before-a-plan-replaces-another/plan-next-week-into-a-week-that-has-a-plan)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { user } = await open([W23, W30]); // opens on 23 Nov
    await user.click(nextWeekBtn());
    expect(screen.getByRole('note').textContent).toBe(note('30 Nov'));
  });

  it('shows no note for a free week @spec(stored-plans/a-warning-before-a-plan-replaces-another/no-note-for-a-free-week)', async () => {
    clock('2026-11-26T12:00:00Z');
    const { user } = await open([W23]);
    await user.click(nextWeekBtn());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('shows no note for the first plan @spec(stored-plans/a-warning-before-a-plan-replaces-another/the-first-plan-has-no-note)', async () => {
    clock('2026-11-26T12:00:00Z');
    render(<App api={fakeApi([])} />);
    await screen.findByRole('button', { name: /build my plan/i });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('does not block: the request is sent for the week the note names, and "Try again" keeps both @spec(stored-plans/a-warning-before-a-plan-replaces-another/the-note-does-not-block)', async () => {
    clock('2026-11-26T12:00:00Z');
    let n = 0;
    const { api, user } = await open([W23, W30], async () => (++n === 1 ? apiFail('coach_unavailable') : ok({ ...planResponse, id: 4, weekStart: '2026-11-30' })));
    await user.click(nextWeekBtn());
    expect(screen.getByRole('note').textContent).toBe(note('30 Nov'));
    await user.click(build());
    await screen.findByRole('alert');
    expect(api.postPlan.mock.calls[0]?.[1]).toBe('2026-11-30'); // the note's week is the request's week
    expect(screen.getByRole('note').textContent).toBe(note('30 Nov')); // still there beside the failure
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('region', { name: 'Your plan' });
    expect(api.postPlan).toHaveBeenCalledTimes(2);
    expect(api.postPlan.mock.calls[1]?.[1]).toBe('2026-11-30');
  });
});
