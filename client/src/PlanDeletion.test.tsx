import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PlanView } from './PlanView.js';
import { planRecord } from './test-helpers.js';

afterEach(() => vi.useRealTimers());

// The confirmation state belongs to the App; this stand-in holds it the same way so the control can be exercised alone.
function Harness({ onConfirm, deleting = false, notice = null, weekStart }: { onConfirm: () => void; deleting?: boolean; notice?: { text: string } | null; weekStart?: string }) {
  const [confirming, setConfirming] = useState(false);
  const record = weekStart ? { ...planRecord(), weekStart } : planRecord(); // the shared fixture's week is 2026-11-09
  return <PlanView record={record} deletion={{ confirming, deleting, notice, onAsk: () => setConfirming(true), onCancel: () => setConfirming(false), onConfirm }} />;
}
const card = () => within(screen.getByRole('region', { name: 'Your plan' }));
const trash = () => screen.getByRole('button', { name: 'Delete this plan' });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });
const confirm = () => screen.getByRole('button', { name: 'Delete plan' });
const QUESTION = 'Delete the plan for the week of 9 Nov? This cannot be undone.';
const clock = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-26T12:00:00Z')); };
const later = (ms: number) => act(() => { vi.setSystemTime(Date.now() + ms); });

describe('the delete control in the summary card', () => {
  it('is an icon-only trash button named "Delete this plan", in the summary card, 44 px on touch @spec(plan-deletion/delete-button-with-a-confirmation/button-is-offered-with-a-plan)', () => {
    render(<Harness onConfirm={vi.fn()} />);
    const button = card().getByRole('button', { name: 'Delete this plan' });
    expect(button.textContent).toBe(''); // the icon carries no text: the name is the label
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('title')).toBe('Delete this plan');
    expect(button.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  });

  it('sits in the header row, level with the "Your plan" heading, before the counts', () => {
    render(<Harness onConfirm={vi.fn()} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Your plan' });
    expect(trash().parentElement).toBe(heading.parentElement?.parentElement); // the heading block and the button are siblings in one row
    expect(trash().compareDocumentPosition(screen.getByRole('group', { name: 'Week summary' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers nothing when the view is given no deletion', () => {
    render(<PlanView record={planRecord()} />);
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull();
  });

  it('asks first: the question naming the week replaces the trash button inside the card, focus on Cancel, nothing sent @spec(plan-deletion/delete-button-with-a-confirmation/confirmation-comes-first)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(trash());
    expect(card().getByText(QUESTION)).toBeTruthy();
    expect(card().getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Delete plan']);
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull();
    expect(document.activeElement).toBe(cancel());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Your plan' })).toBeTruthy(); // the heading, and the region's name, stay
  });

  it('names the plan\'s own week in the question', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} weekStart="2026-12-28" />);
    await user.click(trash());
    expect(card().getByText('Delete the plan for the week of 28 Dec? This cannot be undone.')).toBeTruthy();
  });

  it('names the confirmation group by its question, for a screen reader', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} />);
    await user.click(trash());
    expect(screen.getByRole('group', { name: QUESTION.replace('9 Nov', '9\u00a0Nov') })).toBeTruthy(); // "9 Nov" holds a non-breaking space, read as a normal space
  });

  it('draws "Delete plan" in the danger variant and the others as outline', async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} />);
    expect(trash().getAttribute('data-variant')).toBe('outline');
    await user.click(trash());
    expect(confirm().getAttribute('data-variant')).toBe('danger');
    expect(cancel().getAttribute('data-variant')).toBe('outline');
  });

  it('does not confirm on a double click of the trash button @spec(plan-deletion/delete-button-with-a-confirmation/a-double-click-does-not-confirm)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.dblClick(trash());
    expect(card().getByText(QUESTION)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores "Delete plan" in the first half second, and accepts it from 500 ms on @spec(plan-deletion/delete-button-with-a-confirmation/a-double-click-does-not-confirm)', async () => {
    clock();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(trash());
    await user.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(card().getByText(QUESTION)).toBeTruthy(); // still asking
    later(499);
    await user.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
    later(1);
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('starts the half second again each time the confirmation opens', async () => {
    clock();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(trash());
    later(2000);
    await user.click(cancel());
    await user.click(trash());
    await user.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Cancel and brings the trash button back with focus on it, sending nothing @spec(plan-deletion/delete-button-with-a-confirmation/cancel-keeps-the-plan)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(trash());
    await user.click(cancel());
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(document.activeElement).toBe(trash());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not steal focus when it first appears', () => {
    render(<Harness onConfirm={vi.fn()} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('disables both confirmation buttons while the deletion runs @spec(plan-deletion/delete-button-with-a-confirmation/one-request-however-often-it-is-pressed)', () => {
    const props = { onAsk: () => {}, onCancel: () => {}, onConfirm: () => {}, notice: null };
    const { rerender } = render(<PlanView record={planRecord()} deletion={{ ...props, confirming: true, deleting: false }} />);
    rerender(<PlanView record={planRecord()} deletion={{ ...props, confirming: true, deleting: true }} />);
    expect((cancel() as HTMLButtonElement).disabled).toBe(true);
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a failure notice as an alert inside the card @spec(plan-deletion/delete-button-with-a-confirmation/a-failed-deletion-keeps-the-plan)', () => {
    render(<Harness onConfirm={vi.fn()} notice={{ text: 'The plan could not be deleted. Nothing was changed. You can try again.' }} />);
    expect(card().getByRole('alert').textContent).toContain('The plan could not be deleted.');
    expect(trash()).toBeTruthy(); // the trash button is still there beside it
  });
});
