import { describe, expect, it } from 'vitest';
import { createRequestGuard, toneFor } from './shared';
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
