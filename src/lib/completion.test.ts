import { describe, expect, it } from 'vitest';
import {
  COMPLETION_LABEL,
  completionState,
  institutionsNeedingAttention,
  weightedAverageConsumption,
} from './completion';
import type { MealPerformanceRow } from './types';

const inst = (expected: number, recorded: number, name = 'ZZ') => ({
  institution_id: name,
  name,
  expected_today: expected,
  meals_today: recorded,
  active_students: 20,
});

describe('factual completion state', () => {
  it('a closure / no-service day is NOT a missing-records day', () => {
    // The defect: 20 eligible students and 0 records read as "No outcomes
    // recorded yet" even though nothing was scheduled to be served.
    expect(completionState(inst(0, 0))).toBe('no_service');
    expect(COMPLETION_LABEL[completionState(inst(0, 0))]).toBe('No meals scheduled today');
  });

  it('records are genuinely outstanding when meals WERE expected', () => {
    expect(completionState(inst(40, 0))).toBe('not_started');
  });

  it('a partly recorded day is in progress', () => {
    expect(completionState(inst(40, 17))).toBe('in_progress');
  });

  it('a fully recorded day is complete', () => {
    expect(completionState(inst(40, 40))).toBe('complete');
  });

  it('never reports more-than-complete as incomplete', () => {
    expect(completionState(inst(40, 41))).toBe('complete');
  });

  it("today's attention lists only institutions that actually owe records", () => {
    const rows = [inst(0, 0, 'closed'), inst(40, 0, 'owes'), inst(40, 40, 'done')];
    expect(institutionsNeedingAttention(rows).map((r) => r.name)).toEqual(['owes']);
  });
});

describe('combined average weighting', () => {
  const meal = (avg: number | null, scored: number, valid: number) =>
    ({ avg_consumption_pct: avg, scored_observations: scored, valid_observations: valid }) as
      MealPerformanceRow;

  it('weights by the SCORED population, not the valid one', () => {
    // Meal A: 100% from 1 scored observation, but 99 further valid rows that
    // carry only a behaviour. Meal B: 0% from 1 scored observation.
    // Weighting by valid_observations would report ~99%; the honest answer,
    // over the observations that actually carry a percentage, is 50%.
    const meals = [meal(100, 1, 100), meal(0, 1, 1)];
    expect(weightedAverageConsumption(meals)).toBe(50);
  });

  it('ignores meals with no scored observations at all', () => {
    expect(weightedAverageConsumption([meal(null, 0, 12), meal(80, 4, 4)])).toBe(80);
  });

  it('is null when nothing anywhere has been scored', () => {
    expect(weightedAverageConsumption([meal(null, 0, 5)])).toBeNull();
  });
});
