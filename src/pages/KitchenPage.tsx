import { useEffect, useState } from 'react';
import { productionDemand } from '../lib/api';
import type { ProductionDemandRow } from '../lib/types';
import { Banner, Card, EmptyState, PageHead, Spinner } from '../components/ui';

/**
 * Kitchen production demand (docs/02 §31-35, AT-060/061/062, AT-034).
 * Demand is DERIVED from eligible records — counts only, no student identity.
 * Exact production formula and preparation states remain NOT_YET_DEFINED.
 */
export default function KitchenPage() {
  const [rows, setRows] = useState<ProductionDemandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void productionDemand().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalEligible = rows?.reduce((sum, r) => sum + r.eligible_students, 0) ?? 0;
  const totalAllergy = rows?.reduce((sum, r) => sum + r.allergy_flagged, 0) ?? 0;
  const kitchenName = rows?.find((r) => r.kitchen_name)?.kitchen_name ?? null;

  return (
    <div>
      <PageHead
        title="Kitchen production"
        hint={kitchenName ? `derived demand for ${kitchenName}` : 'derived demand — counts only'}
      />
      <Banner kind="info">
        Demand is derived from authoritative eligible records (operational status{' '}
        <b>ACTIVE_BILLABLE_TO_NURSERY</b>). Kitchen staff cannot change eligibility, cannot invent
        counts, and never see student identity (AT-034).
      </Banner>
      <Banner kind="info">
        Responsible Kitchen: <b>{kitchenName ?? '—'}</b>. Kitchen is a LunchBox Connect operational
        entity, not owned by any institution — this is the current active Kitchen (MVP), not
        permanently hard-coded (docs/13 Decision 031).
      </Banner>
      <Banner kind="warn">
        Meal-package assignment and the exact production formula are <b>NOT_YET_DEFINED</b> — this
        is the derived eligible-count floor, not a finished production calculator.
      </Banner>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="stat-grid">
        <div className="stat">
          <div className="label">Eligible demand (meals)</div>
          <div className="value">{totalEligible}</div>
          <div className="trend">across visible institutions</div>
        </div>
        <div className="stat">
          <div className="label">Allergy-flagged</div>
          <div className="value">{totalAllergy}</div>
          <div className="trend">require safe-handling awareness</div>
        </div>
      </div>

      <Card title="Demand by institution">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No eligible students yet in your scope." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Eligible students</th>
                <th>Allergy-flagged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.institution_id}>
                  <td className="cell-name">{r.institution_name}</td>
                  <td className="mono">{r.eligible_students}</td>
                  <td className="mono">{r.allergy_flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
