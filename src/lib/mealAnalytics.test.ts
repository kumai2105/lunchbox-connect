import { describe, expect, it } from 'vitest';
import {
  aggregateObservations,
  consumptionHumanLabel,
  isLowIntake,
  isNonPreferenceReason,
  isValidPreferenceObservation,
  groupPreferencesByMeal,
  type ObservationLike,
} from './mealAnalytics';
import { CONSUMPTION_VALUES } from './types';

function obs(p: Partial<ObservationLike>): ObservationLike {
  return {
    served_status: 'served',
    consumption_pct: 100,
    behavior: 'ate_independently',
    low_intake_reason: null,
    concern_observed: false,
    ...p,
  };
}

describe('meal analytics (docs/13 Decision 032)', () => {
  it('only 0/25/50/75/100 are approved consumption values', () => {
    expect(CONSUMPTION_VALUES).toEqual([0, 25, 50, 75, 100]);
  });

  it('low intake is 0% or 25% only', () => {
    expect(isLowIntake(0)).toBe(true);
    expect(isLowIntake(25)).toBe(true);
    expect(isLowIntake(50)).toBe(false);
    expect(isLowIntake(75)).toBe(false);
    expect(isLowIntake(100)).toBe(false);
    expect(isLowIntake(null)).toBe(false);
  });

  it('ABSENT, UNWELL, SLEEPING are non-preference reasons (§17) — never Meal dislike', () => {
    expect(isNonPreferenceReason('absent')).toBe(true);
    expect(isNonPreferenceReason('unwell')).toBe(true);
    expect(isNonPreferenceReason('sleeping')).toBe(true);
    expect(isNonPreferenceReason('did_not_like_it')).toBe(false);
    expect(isNonPreferenceReason('not_hungry')).toBe(false);
    expect(isNonPreferenceReason(null)).toBe(false);
    expect(isNonPreferenceReason(undefined)).toBe(false);
  });

  it('valid preference population excludes not_served and non-preference reasons (§42)', () => {
    expect(
      isValidPreferenceObservation({ served_status: 'not_served', low_intake_reason: null }),
    ).toBe(false);
    expect(
      isValidPreferenceObservation({ served_status: 'served', low_intake_reason: 'absent' }),
    ).toBe(false);
    expect(
      isValidPreferenceObservation({ served_status: 'served', low_intake_reason: 'unwell' }),
    ).toBe(false);
    expect(
      isValidPreferenceObservation({ served_status: 'served', low_intake_reason: 'sleeping' }),
    ).toBe(false);
    expect(
      isValidPreferenceObservation({
        served_status: 'served',
        low_intake_reason: 'did_not_like_it',
      }),
    ).toBe(true);
    expect(isValidPreferenceObservation({ served_status: 'served', low_intake_reason: null })).toBe(
      true,
    );
  });

  it('not_served must never present as 0% consumed (§11) — human label stays distinct', () => {
    // A NOT_SERVED record has consumption_pct = null (enforced by the DB
    // constraint), which must render as "Not recorded", not "Did not eat".
    expect(consumptionHumanLabel(null)).toBe('Not recorded');
    expect(consumptionHumanLabel(0)).toBe('Did not eat');
    expect(consumptionHumanLabel(0)).not.toBe(consumptionHumanLabel(null));
  });

  it('human-readable consumption translation (§33)', () => {
    expect(consumptionHumanLabel(100)).toBe('Ate all');
    expect(consumptionHumanLabel(75)).toBe('Ate most');
    expect(consumptionHumanLabel(50)).toBe('Ate about half');
    expect(consumptionHumanLabel(25)).toBe('Ate a little');
  });
});

describe('aggregateObservations (blueprint Parts 24/27)', () => {
  it('returns null rates rather than 0 when there is nothing to divide by', () => {
    const a = aggregateObservations([]);
    expect(a.total).toBe(0);
    expect(a.valid).toBe(0);
    expect(a.avgConsumption).toBeNull();
    expect(a.refusalRate).toBeNull();
    expect(a.encouragementRate).toBeNull();
    expect(a.lowIntakeRate).toBeNull();
  });

  it('excludes absent/unwell/sleeping/not-served from the average, and reports them', () => {
    const rows = [
      obs({ consumption_pct: 100 }),
      obs({ consumption_pct: 50 }),
      // none of these may drag the average toward zero:
      obs({ consumption_pct: 0, low_intake_reason: 'absent' }),
      obs({ consumption_pct: 0, low_intake_reason: 'unwell' }),
      obs({ consumption_pct: 0, low_intake_reason: 'sleeping' }),
      obs({ served_status: 'not_served', consumption_pct: null }),
    ];
    const a = aggregateObservations(rows);
    expect(a.total).toBe(6);
    expect(a.valid).toBe(2);
    expect(a.excluded).toBe(4);
    expect(a.avgConsumption).toBe(75); // (100 + 50) / 2 — not /6
  });

  it('counts every low-intake reason, including the excluded ones', () => {
    const a = aggregateObservations([
      obs({ consumption_pct: 0, low_intake_reason: 'did_not_like_it' }),
      obs({ consumption_pct: 0, low_intake_reason: 'did_not_like_it' }),
      obs({ consumption_pct: 0, low_intake_reason: 'unwell' }),
    ]);
    expect(a.reasons.did_not_like_it).toBe(2);
    expect(a.reasons.unwell).toBe(1);
    // ...but the unwell child is still out of the preference population
    expect(a.valid).toBe(2);
  });

  it('rates are percentages of the valid population only', () => {
    const a = aggregateObservations([
      obs({ consumption_pct: 0, behavior: 'refused' }),
      obs({ consumption_pct: 100 }),
      obs({ consumption_pct: 75, behavior: 'needed_encouragement' }),
      obs({ consumption_pct: 100, low_intake_reason: 'absent' }), // excluded
    ]);
    expect(a.valid).toBe(3);
    expect(a.refusalRate).toBe(33.3);
    expect(a.encouragementRate).toBe(33.3);
    expect(a.lowIntakeRate).toBe(33.3); // the single 0%
  });

  it('distribution buckets only the valid population', () => {
    const a = aggregateObservations([
      obs({ consumption_pct: 100 }),
      obs({ consumption_pct: 100 }),
      obs({ consumption_pct: 25 }),
      obs({ consumption_pct: 0, low_intake_reason: 'absent' }),
      obs({ served_status: 'not_served', consumption_pct: null }),
    ]);
    expect(a.distribution).toEqual({ 0: 0, 25: 1, 50: 0, 75: 0, 100: 2 });
  });
});

describe('groupPreferencesByMeal (§9/§30/§31)', () => {
  it('groups the same meal served on different dates into one favourite', () => {
    // Chicken Pasta (meal m1) served 3 times over 3 service ids, Beef Rice (m2) once.
    const idFor: Record<string, { id: string; label: string }> = {
      s1: { id: 'm1', label: 'Chicken Pasta' },
      s2: { id: 'm1', label: 'Chicken Pasta' },
      s3: { id: 'm1', label: 'Chicken Pasta' },
      s4: { id: 'm2', label: 'Beef Rice' },
    };
    const records = [
      { meal_service_id: 's1', consumption_pct: 100 },
      { meal_service_id: 's2', consumption_pct: 50 },
      { meal_service_id: 's3', consumption_pct: 75 },
      { meal_service_id: 's4', consumption_pct: 25 },
    ];
    const out = groupPreferencesByMeal(records, (id) => idFor[id]);
    // Two meals, not four.
    expect(out).toHaveLength(2);
    const pasta = out.find((m) => m.label === 'Chicken Pasta')!;
    expect(pasta.count).toBe(3); // three servings contributed
    expect(pasta.value).toBe(75); // (100+50+75)/3
    expect(out.find((m) => m.label === 'Beef Rice')!.count).toBe(1);
    // sorted by value desc
    expect(out[0].label).toBe('Chicken Pasta');
  });

  it('§9: groups by stable meal_id even when a later revision renamed the dish', () => {
    // Same meal m1, but the second serving carries the renamed revision label.
    const idFor: Record<string, { id: string; label: string }> = {
      s1: { id: 'm1', label: 'Veg Curry' },
      s2: { id: 'm1', label: 'Vegetable Curry' }, // renamed, same meal
    };
    const out = groupPreferencesByMeal(
      [
        { meal_service_id: 's1', consumption_pct: 100 },
        { meal_service_id: 's2', consumption_pct: 50 },
      ],
      (id) => idFor[id],
    );
    // One meal, not two — the rename does not split history.
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].value).toBe(75);
  });

  it('§9: does NOT merge two different meals that share a dish name', () => {
    const idFor: Record<string, { id: string; label: string }> = {
      s1: { id: 'm1', label: 'Soup' },
      s2: { id: 'm2', label: 'Soup' }, // different meal, same text
    };
    const out = groupPreferencesByMeal(
      [
        { meal_service_id: 's1', consumption_pct: 100 },
        { meal_service_id: 's2', consumption_pct: 0 },
      ],
      (id) => idFor[id],
    );
    expect(out).toHaveLength(2);
  });

  it('skips records with no meal-service link (pre-cutover)', () => {
    const out = groupPreferencesByMeal(
      [{ meal_service_id: null, consumption_pct: 100 }],
      () => ({ id: 'x', label: 'X' }),
    );
    expect(out).toHaveLength(0);
  });
})
