import { describe, expect, it } from 'vitest';
import { configInEffectOn } from './api';

/**
 * EVIDENCE that per-Institution configuration is effective-dated, and that the
 * UI reads it the same way the database resolver does.
 *
 * An Institution's supported configuration is not a fixed list of fields; it is
 * effective-dated record sets (`institution_service_plans`,
 * `institution_rotation_assignments`, both in migration 0016). Changing a
 * nursery's package or menu means adding a row with a LATER effective_from —
 * the old row keeps governing the days it already governed.
 *
 * The database picks the governing row with `order by effective_from desc
 * limit 1` filtered to `effective_from <= p_date` (resolve_rotation_week and
 * service_plan_includes, 0016). The Service tab previously took the newest row
 * UNCONDITIONALLY and labelled it "Current", so the moment anyone scheduled a
 * change for a future date the screen claimed that change was already live.
 * `configInEffectOn` is the client-side mirror of the database rule.
 */
const rows = [
  { effective_from: '2026-09-01', label: 'breakfast + lunch + afternoon snack' },
  { effective_from: '2026-06-15', label: 'breakfast + lunch' },
  { effective_from: '2026-01-05', label: 'lunch' },
];

describe('configInEffectOn — which configuration governs a date', () => {
  it('picks the newest row that has already started, not the newest row', () => {
    // 2026-09-01 exists but has not started yet on 2026-08-22.
    expect(configInEffectOn(rows, '2026-08-22')?.label).toBe('breakfast + lunch');
  });

  it('treats the effective date itself as in effect', () => {
    expect(configInEffectOn(rows, '2026-06-15')?.label).toBe('breakfast + lunch');
  });

  it('returns the day before an effective date to the previous configuration', () => {
    expect(configInEffectOn(rows, '2026-06-14')?.label).toBe('lunch');
  });

  it('honours a scheduled change once its date arrives, with no further action', () => {
    expect(configInEffectOn(rows, '2026-09-01')?.label).toBe('breakfast + lunch + afternoon snack');
    expect(configInEffectOn(rows, '2027-03-30')?.label).toBe(
      'breakfast + lunch + afternoon snack',
    );
  });

  it('returns null before any configuration exists — never a guessed default', () => {
    expect(configInEffectOn(rows, '2025-12-31')).toBeNull();
  });

  it('returns null for an institution with no configuration at all', () => {
    expect(configInEffectOn([], '2026-08-22')).toBeNull();
  });
});
