import { describe, expect, it } from 'vitest';
import { childDataReady, createRequestGuard, toneFor } from './shared';
import type { ServingRecord } from '../../lib/types';

describe('parent child-switch request guard', () => {
  it('discards an earlier response that lands after a later one', () => {
    const guard = createRequestGuard();
    const childA = guard.next(); // parent opens child A
    const childB = guard.next(); // parent switches to child B before A returns

    // A's slow response arrives last and must be ignored...
    expect(guard.isCurrent(childA)).toBe(false);
    // ...while B's response is still the one that counts.
    expect(guard.isCurrent(childB)).toBe(true);
  });

  it('treats the most recent selection as current, however many switches', () => {
    const guard = createRequestGuard();
    guard.next();
    guard.next();
    const latest = guard.next();
    expect(guard.isCurrent(latest)).toBe(true);
  });
});

describe('parent child-switch readiness invariant (render path)', () => {
  it('renders nothing child-specific on the immediate selection render', () => {
    // The exact defect: clicking child B only sets the selected id. React
    // re-renders straight away, still holding child A's loaded dataset, before
    // any effect has run. Readiness must already be false at that instant.
    const loadedForA = 'child-A';
    expect(childDataReady(loadedForA, 'child-B')).toBe(false);
  });

  it('renders child data only once the loaded dataset belongs to that child', () => {
    expect(childDataReady('child-B', 'child-B')).toBe(true);
  });

  it('renders nothing before the first load completes', () => {
    expect(childDataReady(null, 'child-A')).toBe(false);
  });

  it('renders nothing when no child is selected yet', () => {
    expect(childDataReady(null, undefined)).toBe(false);
    expect(childDataReady('child-A', undefined)).toBe(false);
  });

  it('holds across a rapid A -> B -> A switch', () => {
    // Selecting A again while B's data is loaded must not show B's meals.
    expect(childDataReady('child-B', 'child-A')).toBe(false);
    // ...and only becomes ready when A's own data has landed.
    expect(childDataReady('child-A', 'child-A')).toBe(true);
  });

  it('combines with the request guard: a stale response cannot mark ready', () => {
    // A's slow response returns after B was selected. The guard rejects it, so
    // loadedChildId is never set to A, and readiness for B stays false until
    // B's own data lands.
    const guard = createRequestGuard();
    const tokenA = guard.next();
    const tokenB = guard.next();
    const staleAccepted = guard.isCurrent(tokenA);
    expect(staleAccepted).toBe(false);
    const loadedChildId = staleAccepted ? 'child-A' : null;
    expect(childDataReady(loadedChildId, 'child-B')).toBe(false);
    expect(guard.isCurrent(tokenB)).toBe(true);
  });
});

describe('toneFor never colours an unscored meal as the worst outcome', () => {
  const rec = (over: Partial<ServingRecord>): ServingRecord =>
    ({
      id: 'r1',
      serving_date: '2026-08-20',
      class_id: 'c1',
      student_id: 's1',
      period: 'lunch',
      served_status: 'served',
      consumption_pct: null,
      behavior: null,
      low_intake_reason: null,
      concern_observed: false,
      menu_item_id: null,
      meal_service_id: 'ms1',
      recorded_by: 'u1',
      created_at: '',
      updated_at: '',
      ...over,
    }) as ServingRecord;

  it('a served meal with no percentage yet reads as waiting, not "ate none"', () => {
    expect(toneFor(rec({ consumption_pct: null }))).toBe('wait');
  });

  it('an Absent exception is not rendered as a zero-consumption meal', () => {
    expect(toneFor(rec({ consumption_pct: null, low_intake_reason: 'absent' }))).toBe('wait');
  });

  it('a genuine 0% is still shown as the worst outcome', () => {
    expect(toneFor(rec({ consumption_pct: 0 }))).toBe('danger');
  });

  it('normal intake still reads as ok', () => {
    expect(toneFor(rec({ consumption_pct: 75 }))).toBe('ok');
  });
});
