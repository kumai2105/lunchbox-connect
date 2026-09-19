import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pendingParentNotes, publishParentNote, type PendingNote } from '../lib/api';
import { Banner, Btn, Card, EmptyState, PageHead, Spinner } from '../components/ui';
import { Icon } from '../components/icons';

const PERIOD_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  snack: 'Morning snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

/**
 * Parent-safe updates — review queue (blueprint Parts 66-67).
 *
 * Unrestricted staff free text must never reach a parent automatically. A note
 * stays internal until a reviewer approves it here, and the reviewer may redact
 * the wording first. This is not merely a screen convention: the serving_notes
 * RLS policy only exposes rows with a published_at to a parent, so an
 * unreviewed body is unreadable to them no matter what any client does.
 */
export default function ReviewPage() {
  const [notes, setNotes] = useState<PendingNote[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load() {
    const res = await pendingParentNotes();
    setError(res.error);
    setNotes(res.data ?? []);
    const d: Record<string, string> = {};
    (res.data ?? []).forEach((n) => (d[n.id] = n.body));
    setDrafts(d);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, []);

  async function approve(note: PendingNote) {
    setBusyId(note.id);
    setDone(null);
    const res = await publishParentNote(note.id, drafts[note.id] ?? note.body);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    const name = note.record?.student
      ? `${note.record.student.given_name} ${note.record.student.family_name}`
      : 'the child';
    setDone(`Published to ${name}'s family.`);
    await load();
  }

  return (
    <div>
      <PageHead
        title="Parent-safe updates"
        hint="staff notes awaiting review before any family can see them"
      />

      <Banner kind="info">
        Structured meal results (how much was eaten, behaviour, reason) reach families
        automatically. Free-text notes do not — they stay internal until reviewed here, and the
        database enforces that independently of this screen.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}
      {done && <Banner kind="info">{done}</Banner>}

      {!notes ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <EmptyState text="No notes are waiting for review." />
      ) : (
        notes.map((n) => {
          const s = n.record?.student;
          return (
            <Card
              key={n.id}
              title={s ? `${s.given_name} ${s.family_name}` : 'Unknown student'}
              hint={
                n.record
                  ? `${PERIOD_LABEL[n.record.period] ?? n.record.period} · ${n.record.serving_date}`
                  : undefined
              }
              actions={
                n.record?.student_id ? (
                  <Link to={`/students/${n.record.student_id}`} className="btn ghost sm">
                    Open profile
                  </Link>
                ) : undefined
              }
            >
              <div className="review-body">
                <label className="review-label">
                  Note submitted by staff — edit to redact before approving
                </label>
                <textarea
                  rows={3}
                  value={drafts[n.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [n.id]: e.target.value }))}
                />
                <div className="review-actions">
                  <span className="cell-sub">
                    Submitted {new Date(n.created_at).toLocaleString()}
                  </span>
                  <div className="spacer" />
                  <Btn
                    variant="brand"
                    onClick={() => void approve(n)}
                    disabled={busyId === n.id || !(drafts[n.id] ?? '').trim()}
                  >
                    {busyId === n.id ? 'Publishing…' : 'Approve for family'}
                  </Btn>
                </div>
                <div className="review-hint">
                  <Icon name="alertTriangle" size={13} /> Leaving a note unapproved keeps it
                  internal — that is the safe default, and no family sees it.
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
