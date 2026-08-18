import { describe, expect, it } from 'vitest';
import {
  consumptionHumanLabel,
  isLowIntake,
  isNonPreferenceReason,
  isValidPreferenceObservation,
} from './mealAnalytics';
import { CONSUMPTION_VALUES } from './types';

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
