import { useCallback, useEffect, useState } from 'react';
import {
  driverConfirmArrival,
  driverConfirmCollection,
  manifestLines,
  myManifests,
} from '../lib/api';
import { PERIOD_LABEL } from '../lib/periods';
import { operationalToday } from '../lib/format';
import type { DeliveryManifest, ManifestLine } from '../lib/types';
import { Banner, Btn, Card, EmptyState, PageHead, Pill, Spinner } from '../components/ui';

const STATE_LABEL: Record<string, string> = {
  PREPARING: 'Being prepared',
  READY_FOR_DISPATCH: 'Ready — not yet released',
  RELEASED: 'Released to you',
  IN_TRANSIT: 'In transit',
  ARRIVED: 'Arrived — awaiting handover',
  HANDED_OVER: 'Handed over',
};

/**
 * MY DELIVERIES — the Driver's whole product.
 *
 * Deliberately small. A Driver needs to know where they are going, when it is
 * expected, and what is on board. They do not get route optimisation, a fleet
 * dashboard, child profiles or parent data — and that is not enforced by
 * hiding it here, it is enforced by RLS, which returns only this Driver's own
 * manifests and no student rows at all.
 *
 * Two actions, in order: collected, then arrived. Handover is NOT here. The
 * institution takes custody of its own food, by a person it authorised.
 */
export default function DriverPage() {
  const [rows, setRows] = useState<DeliveryManifest[] | null>(null);
  const [lines, setLines] = useState<Record<string, ManifestLine[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await myManifests(operationalToday());
    if (r.error) {
      setError(r.error);
      setRows([]);
      return;
    }
    const data = r.data ?? [];
    setRows(data);
    const map: Record<string, ManifestLine[]> = {};
    await Promise.all(
      data.map(async (m) => {
        const l = await manifestLines(m.id);
        map[m.id] = l.data ?? [];
      }),
    );
    setLines(map);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<{ error: string | null }>, done: string) {
    setBusy(id);
    setError(null);
    setOk(null);
    const res = await fn();
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOk(done);
    await load();
  }

  return (
    <>
      <PageHead title="My deliveries" hint="Your assigned runs" />

      {error && <Banner kind="err">{error}</Banner>}
      {ok && <Banner kind="ok">{ok}</Banner>}

      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState text="No deliveries are assigned to you." />
      ) : (
        rows.map((m) => (
          <Card
            key={m.id}
            title={`${m.institution_name ?? 'Institution'} — run ${m.run_number}`}
            hint={`${m.service_date}${
              m.window_from
                ? ` · ${m.window_from.slice(0, 5)}–${(m.window_to ?? '').slice(0, 5)}`
                : ''
            }`}
          >
            <p>
              <Pill variant={m.state === 'HANDED_OVER' ? 'green' : 'amber'}>
                {STATE_LABEL[m.state] ?? m.state}
              </Pill>
            </p>
            {m.delivery_point && (
              <p>
                <b>Deliver to:</b> {m.delivery_point}
              </p>
            )}

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

            {m.state === 'RELEASED' && (
              <Btn
                variant="brand"
                disabled={busy === m.id}
                onClick={() =>
                  void act(m.id, () => driverConfirmCollection(m.id), 'Collection confirmed.')
                }
              >
                {busy === m.id ? 'Saving…' : 'Confirm collection'}
              </Btn>
            )}

            {m.state === 'IN_TRANSIT' && (
              <Btn
                variant="brand"
                disabled={busy === m.id}
                onClick={() =>
                  void act(m.id, () => driverConfirmArrival(m.id), 'Arrival recorded.')
                }
              >
                {busy === m.id ? 'Saving…' : 'Arrived at institution'}
              </Btn>
            )}

            {m.state === 'ARRIVED' && (
              <Banner kind="info">
                Arrival recorded. The institution completes the handover — that is their
                confirmation to give, not yours.
              </Banner>
            )}

            {m.state === 'READY_FOR_DISPATCH' && (
              <Banner kind="info">Not released by the kitchen yet.</Banner>
            )}
          </Card>
        ))
      )}
    </>
  );
}
