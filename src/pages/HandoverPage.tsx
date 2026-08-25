import { useCallback, useEffect, useState } from 'react';
import { confirmHandover, listIssues, manifestLines, manifestsForDate, reportIssue } from '../lib/api';
import { PERIOD_LABEL } from '../lib/periods';
import { operationalToday } from '../lib/format';
import type { DeliveryManifest, ManifestLine, OperationalIssue } from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Pill, Spinner } from '../components/ui';

const ISSUE_CATEGORIES = [
  'Missing Item',
  'Wrong Item',
  'Damaged Packaging',
  'Missing Special Meal',
  'Other',
];

/**
 * TODAY'S DELIVERY — the institution's side of custody.
 *
 * The normal action is ONE button, and it deliberately does not ask for a
 * quantity. The manifest already says 120; making the receiver retype 120 adds
 * a chance to type 12 and adds nothing else. LunchBox delivers the exact
 * required order, so confirming receipt is an acknowledgement, not a stock
 * count.
 *
 * Reporting an issue is the SECONDARY path, and it never quietly marks the
 * delivery clean: the receiver either accepts custody with the issue recorded,
 * or leaves the delivery unaccepted until it is resolved.
 */
export default function HandoverPage() {
  const [rows, setRows] = useState<DeliveryManifest[] | null>(null);
  const [lines, setLines] = useState<Record<string, ManifestLine[]>>({});
  const [issues, setIssues] = useState<OperationalIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ manifest: DeliveryManifest } | null>(null);
  const date = operationalToday();

  const load = useCallback(async () => {
    const [m, i] = await Promise.all([manifestsForDate(date), listIssues(date)]);
    if (m.error) {
      setError(m.error);
      setRows([]);
      return;
    }
    const data = m.data ?? [];
    setRows(data);
    setIssues(i.data ?? []);
    const map: Record<string, ManifestLine[]> = {};
    await Promise.all(
      data.map(async (x) => {
        const l = await manifestLines(x.id);
        map[x.id] = l.data ?? [];
      }),
    );
    setLines(map);
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<{ error: string | null }>, done: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fn();
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    setOk(done);
    setDialog(null);
    await load();
    return true;
  }

  return (
    <>
      <PageHead title="Today's delivery" hint={date} />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No delivery is scheduled for your institution today." />
      ) : (
        rows.map((m) => {
          const mine = issues.filter((i) => i.manifest_id === m.id);
          return (
            <Card
              key={m.id}
              title={`Run ${m.run_number}`}
              hint={
                m.window_from
                  ? `Expected ${m.window_from.slice(0, 5)}–${(m.window_to ?? '').slice(0, 5)}`
                  : undefined
              }
            >
              <p>
                <Pill variant={m.state === 'HANDED_OVER' ? 'green' : 'amber'}>
                  {m.state.replace(/_/g, ' ')}
                </Pill>
                {m.handover_with_issue && <Pill variant="amber"> accepted with an issue</Pill>}
              </p>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sitting</th>
                      <th>Packages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lines[m.id] ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>{PERIOD_LABEL[l.period]}</td>
                        <td>
                          <b>{l.total_quantity}</b>
                          {l.special_quantity > 0 && (
                            <span className="muted">
                              {' '}
                              ({l.standard_quantity} standard + {l.special_quantity} special)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {m.state === 'ARRIVED' && (
                <>
                  <Btn
                    variant="brand"
                    disabled={busy}
                    onClick={() =>
                      void run(() => confirmHandover(m.id, false), 'Delivery received. Thank you.')
                    }
                  >
                    {busy ? 'Saving…' : 'Confirm full delivery received'}
                  </Btn>{' '}
                  <Btn variant="ghost" disabled={busy} onClick={() => setDialog({ manifest: m })}>
                    Report delivery issue
                  </Btn>
                  <p className="hint">
                    You do not need to retype the quantities — the manifest above is what was sent.
                  </p>
                </>
              )}

              {m.state === 'HANDED_OVER' && (
                <Banner kind="ok">
                  Received{m.handed_over_at ? ` at ${m.handed_over_at.slice(11, 16)}` : ''}.
                </Banner>
              )}

              {m.state !== 'ARRIVED' && m.state !== 'HANDED_OVER' && (
                <Banner kind="info">
                  This delivery has not arrived yet. The confirmation appears once the driver
                  records arrival.
                </Banner>
              )}

              {mine.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Issue</th>
                        <th>What happened</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mine.map((i) => (
                        <tr key={i.id}>
                          <td>{i.category}</td>
                          <td>{i.description}</td>
                          <td>
                            <Pill variant={i.status === 'CLOSED' ? 'green' : 'amber'}>
                              {i.status.replace(/_/g, ' ')}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}

      {dialog && (
        <IssueDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onReport={async (category, description, accept) => {
            const raised = await run(
              () =>
                reportIssue({
                  stage: 'DELIVERY',
                  category,
                  description,
                  institutionId: dialog.manifest.institution_id,
                  date,
                  manifestId: dialog.manifest.id,
                }),
              accept
                ? 'Issue recorded, and the delivery accepted with it open.'
                : 'Issue recorded. The delivery stays unaccepted until it is resolved.',
            );
            if (raised && accept) {
              await run(
                () => confirmHandover(dialog.manifest.id, true),
                'Issue recorded, and the delivery accepted with it open.',
              );
            }
            return raised;
          }}
        />
      )}
    </>
  );
}

function IssueDialog({
  busy,
  onClose,
  onReport,
}: {
  busy: boolean;
  onClose: () => void;
  onReport: (category: string, description: string, accept: boolean) => Promise<boolean>;
}) {
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const valid = description.trim().length > 0;

  return (
    <Modal
      title="Report a delivery issue"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="ghost"
            disabled={!valid || busy}
            onClick={() => void onReport(category, description, false)}
          >
            Report and do not accept yet
          </Btn>
          <Btn
            variant="brand"
            disabled={!valid || busy}
            onClick={() => void onReport(category, description, true)}
          >
            {busy ? 'Saving…' : 'Accept delivery with issue'}
          </Btn>
        </>
      }
    >
      <Banner kind="info">
        Accepting with an issue records both: you have taken custody of what did arrive, and the
        problem stays open until LunchBox resolves it. It is never quietly closed.
      </Banner>
      <Field label="What kind of issue">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="What happened">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
