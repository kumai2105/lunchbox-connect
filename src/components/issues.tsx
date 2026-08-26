import { useState } from 'react';
import type { OperationalIssue } from '../lib/types';
import { Banner, Btn, Field, Modal } from './ui';

/**
 * THE ISSUE LIFECYCLE, AS TWO DIALOGS.
 *
 * They live here rather than on a page because LunchBox works issues from two
 * screens — Operations for a Super Admin, Kitchen production for the Kitchen —
 * and the same action performed in two places has to ask the same questions,
 * carry the same warnings and produce the same record. A second copy is how
 * one of them quietly stops requiring the note.
 *
 * The institution's own step (acknowledging a delivery issue) is NOT here: it
 * is a different question asked of a different organisation, and it belongs
 * beside the delivery it concerns.
 */

/**
 * ACTION ISSUE — and the note is not optional.
 *
 * "LunchBox actioned it" with nothing recorded about WHAT was done is a status
 * that survives an audit and answers no question. The database refuses it too;
 * this asks for it up front rather than letting the operator discover the rule
 * by being rejected.
 */
export function IssueActionDialog({
  issue,
  busy,
  onClose,
  onAction,
}: {
  issue: OperationalIssue;
  busy: boolean;
  onClose: () => void;
  onAction: (resolution: string) => Promise<boolean>;
}) {
  const [resolution, setResolution] = useState('');
  const valid = resolution.trim().length > 0;
  return (
    <Modal
      title={`Action issue — ${issue.category}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="brand" disabled={!valid || busy} onClick={() => void onAction(resolution)}>
            {busy ? 'Saving…' : 'Action issue'}
          </Btn>
        </>
      }
    >
      <p>
        <b>What happened:</b> {issue.description}
      </p>
      <Banner kind="info">
        {issue.stage === 'DELIVERY'
          ? 'The institution sees what you write here and acknowledges it. The issue stays open until they do, and closes only afterwards.'
          : 'This is an internal issue. The institution never sees it, and it closes once actioned.'}
      </Banner>
      <Field label="What was done about it">
        <textarea
          rows={3}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          autoFocus
        />
      </Field>
      {!valid && <p className="hint">A factual account of the action taken is required.</p>}
    </Modal>
  );
}

export function IssueCloseDialog({
  issue,
  busy,
  onClose,
  onConfirm,
}: {
  issue: OperationalIssue;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string | null) => Promise<boolean>;
}) {
  const [note, setNote] = useState('');
  const unacknowledged = issue.stage === 'DELIVERY' && issue.status === 'LUNCHBOX_ACTIONED';
  return (
    <Modal
      title={`Close issue — ${issue.category}`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="brand" disabled={busy} onClick={() => void onConfirm(note || null)}>
            {busy ? 'Closing…' : 'Close issue'}
          </Btn>
        </>
      }
    >
      <p>
        <b>What happened:</b> {issue.description}
      </p>
      {issue.resolution && (
        <p>
          <b>What was done:</b> {issue.resolution}
        </p>
      )}
      {unacknowledged && (
        <Banner kind="warn">
          The institution has not acknowledged this yet. Closing now is allowed, but the normal
          course is to let them confirm they are satisfied first.
        </Banner>
      )}
      <Banner kind="info">A closed issue cannot be reopened — raise a new one instead.</Banner>
      <Field label="Closing note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
