import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TrashIcon, WarningIcon } from '@/components/icons';

// A press on "Delete plan" this soon after the question opens is ignored: it is a stray second click, not a decision.
// Half a second 🔶 (design.md). With the trash button at the top of the card the confirm button no longer sits under the
// cursor, so this is a cheap extra, not the main protection.
export const CONFIRM_GUARD_MS = 500;

// Everything the plan view needs to offer deletion. The App owns the state, so every change of view can reset it.
export interface DeletionProps {
  confirming: boolean; // "Delete this plan" was pressed and not yet confirmed or cancelled
  deleting: boolean; // the deletion request is running: both confirmation buttons are disabled
  notice: { text: string } | null; // a failed deletion, shown as an alert in the card
  noticeRef?: Ref<HTMLDivElement>; // the App focuses the alert when a failure arrives
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

// The delete control, in two pieces for two places in the summary card: `trigger` (the icon-only trash button, top right
// of the header, not shown while the question is open) and `panel` (the question naming the plan's week, then any failure
// notice, under the header). Nothing is sent from here: "Delete plan" only calls `onConfirm`. Focus follows the change: to
// "Cancel" when the question opens, back to the trash button after "Cancel" only (a failure puts it on the alert instead).
export function useDeleteControl(weekLabel: string, deletion: DeletionProps | undefined): { trigger: ReactNode; panel: ReactNode } {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const trashButton = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(0);
  const refocusTrash = useRef(false);
  const confirming = deletion?.confirming ?? false;

  useEffect(() => {
    if (confirming) {
      openedAt.current = Date.now();
      cancelButton.current?.focus();
    } else if (refocusTrash.current) {
      refocusTrash.current = false;
      trashButton.current?.focus();
    }
  }, [confirming]);

  if (!deletion) return { trigger: null, panel: null };
  const { deleting, notice, noticeRef, onAsk, onCancel, onConfirm } = deletion;

  const trigger = confirming ? null : (
    <Button type="button" variant="outline" ref={trashButton} aria-label="Delete this plan" title="Delete this plan" className="w-11 shrink-0 px-0 pointer-fine:w-9" onClick={onAsk}>
      <TrashIcon className="size-5" />
    </Button>
  );

  // A non-breaking space keeps "23 Nov" on one line (on a phone the question broke between the day and the month).
  const question = `Delete the plan for the week of ${weekLabel.replace(' ', ' ')}? This cannot be undone.`;
  const panel = (
    <>
      {confirming && (
        <div role="group" aria-labelledby="delete-question" className="grid gap-3 rounded-lg border border-border bg-secondary px-3.5 py-3">
          <p id="delete-question" className="m-0 text-base font-semibold">{question}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" ref={cancelButton} disabled={deleting} onClick={() => { refocusTrash.current = true; onCancel(); }}>Cancel</Button>
            <Button type="button" variant="danger" disabled={deleting} onClick={() => { if (Date.now() - openedAt.current >= CONFIRM_GUARD_MS) onConfirm(); }}>Delete plan</Button>
          </div>
        </div>
      )}
      {notice && (
        <Alert variant="danger" role="alert" ref={noticeRef} tabIndex={-1} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <WarningIcon aria-hidden="true" />
          <p className="m-0 break-words">{notice.text}</p>
        </Alert>
      )}
    </>
  );
  return { trigger, panel };
}
