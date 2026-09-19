import { describe, expect, it } from 'vitest';
import {
  isoWeekdayIndex,
  resolveMeal,
  rotationWeekFor,
  type CalendarExceptionLike,
  type ResolveInput,
  type RotationSlotLike,
} from './calendar';
import type { AppPeriod } from './types';

const ALL_PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];

// 2-week rotation, Mon-Fri, all four periods.
// Week 1 => MEAL_A, Week 2 => MEAL_B (so the two weeks are distinguishable).
const SLOTS: RotationSlotLike[] = [1, 2].flatMap((week) =>
  [0, 1, 2, 3, 4].flatMap((weekday) =>
    ALL_PERIODS.map((period) => ({
      rotationId: 'ROT',
      weekNumber: week,
      weekday,
      period,
      mealId: week === 1 ? 'MEAL_A' : 'MEAL_B',
    })),
  ),
);

const ROTATION = {
  rotationId: 'ROT',
  effectiveFrom: '2026-08-03', // a Monday
  anchorWeek: 1,
  weekCount: 2,
};

function input(over: Partial<ResolveInput> = {}): ResolveInput {
  return {
    date: '2026-08-04',
    period: 'lunch',
    planPeriods: ALL_PERIODS,
    exceptions: [],
    rotation: ROTATION,
    slots: SLOTS,
    ...over,
  };
}

describe('weekday convention', () => {
  it('0 = Monday .. 6 = Sunday', () => {
    expect(isoWeekdayIndex(new Date('2026-08-03T00:00:00'))).toBe(0); // Mon
    expect(isoWeekdayIndex(new Date('2026-08-07T00:00:00'))).toBe(4); // Fri
    expect(isoWeekdayIndex(new Date('2026-08-09T00:00:00'))).toBe(6); // Sun
  });
});

describe('rotationWeekFor (Decision 033 — Part 104)', () => {
  it('repeats after the final rotation week', () => {
    const anchor = new Date('2026-08-03T00:00:00');
    const weeks = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'].map((d) =>
      rotationWeekFor(new Date(`${d}T00:00:00`), anchor, 1, 2),
    );
    expect(weeks).toEqual([1, 2, 1, 2, 1]);
  });

  it('every day inside one calendar week resolves to the same rotation week', () => {
    const anchor = new Date('2026-08-03T00:00:00');
    const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
    const weeks = days.map((d) => rotationWeekFor(new Date(`${d}T00:00:00`), anchor, 1, 2));
    expect(new Set(weeks)).toEqual(new Set([1]));
  });

  it('rotation length is data-driven, not fixed at four weeks', () => {
    const anchor = new Date('2026-08-03T00:00:00');
    // A 6-week rotation must cycle over 6, not wrap at 4.
    const six = ['2026-08-03', '2026-09-07'].map((d) =>
      rotationWeekFor(new Date(`${d}T00:00:00`), anchor, 1, 6),
    );
    expect(six).toEqual([1, 6]); // 5 weeks later => week 6
    expect(rotationWeekFor(new Date('2026-09-14T00:00:00'), anchor, 1, 6)).toBe(1); // wraps
  });

  it('honours a non-1 anchor week', () => {
    const anchor = new Date('2026-08-03T00:00:00');
    expect(rotationWeekFor(new Date('2026-08-03T00:00:00'), anchor, 3, 4)).toBe(3);
    expect(rotationWeekFor(new Date('2026-08-10T00:00:00'), anchor, 3, 4)).toBe(4);
    expect(rotationWeekFor(new Date('2026-08-17T00:00:00'), anchor, 3, 4)).toBe(1);
  });

  it('returns null before the assignment starts', () => {
    expect(
      rotationWeekFor(new Date('2026-07-27T00:00:00'), new Date('2026-08-03T00:00:00'), 1, 2),
    ).toBeNull();
  });
});

describe('resolveMeal precedence (Decision 033 — Part 19)', () => {
  it('resolves from the normal rotation by default', () => {
    expect(resolveMeal(input())).toEqual({ mealId: 'MEAL_A', source: 'rotation' });
    // Following week is rotation week 2.
    expect(resolveMeal(input({ date: '2026-08-11' }))).toEqual({
      mealId: 'MEAL_B',
      source: 'rotation',
    });
  });

  it('Part 107 — the service plan filters periods the institution does not receive', () => {
    const threeMeal: AppPeriod[] = ['breakfast', 'snack', 'lunch'];
    expect(resolveMeal(input({ period: 'lunch', planPeriods: threeMeal })).mealId).toBe('MEAL_A');
    // The master rotation HAS an afternoon snack, but this institution does not
    // receive one — it must not be served.
    expect(resolveMeal(input({ period: 'afternoon_snack', planPeriods: threeMeal }))).toEqual({
      mealId: null,
      source: 'none',
    });
  });

  it('no service plan on file means no coverage — service is never assumed', () => {
    expect(resolveMeal(input({ planPeriods: [] }))).toEqual({ mealId: null, source: 'none' });
  });

  it('Part 105 — a closure suppresses that day WITHOUT shifting the rotation', () => {
    const closure: CalendarExceptionLike = {
      kind: 'closure',
      dateFrom: '2026-08-05', // Wednesday
      dateTo: '2026-08-05',
      period: null,
    };
    // Wednesday: closed.
    expect(resolveMeal(input({ date: '2026-08-05', exceptions: [closure] }))).toEqual({
      mealId: null,
      source: 'closure',
    });
    // Thursday still serves THURSDAY's slot — it does not inherit Wednesday's.
    const thu = resolveMeal(input({ date: '2026-08-06', exceptions: [closure] }));
    expect(thu.source).toBe('rotation');
    // And the following week is still rotation week 2: the closure did not
    // shift the rotation forward or backward.
    expect(resolveMeal(input({ date: '2026-08-11', exceptions: [closure] })).mealId).toBe('MEAL_B');
  });

  it('Part 106 — a date override changes only that date', () => {
    const override: CalendarExceptionLike = {
      kind: 'override',
      dateFrom: '2026-08-07', // one Friday
      dateTo: '2026-08-07',
      period: 'lunch',
      mealId: 'MEAL_OVERRIDE',
    };
    expect(resolveMeal(input({ date: '2026-08-07', exceptions: [override] }))).toEqual({
      mealId: 'MEAL_OVERRIDE',
      source: 'override',
    });
    // The NEXT Friday returns to the normal rotation (week 2 => MEAL_B).
    expect(resolveMeal(input({ date: '2026-08-14', exceptions: [override] }))).toEqual({
      mealId: 'MEAL_B',
      source: 'rotation',
    });
    // A different period on the overridden date is untouched.
    expect(
      resolveMeal(input({ date: '2026-08-07', period: 'breakfast', exceptions: [override] }))
        .source,
    ).toBe('rotation');
  });

  it('closure outranks an override on the same date', () => {
    const exceptions: CalendarExceptionLike[] = [
      {
        kind: 'override',
        dateFrom: '2026-08-05',
        dateTo: '2026-08-05',
        period: 'lunch',
        mealId: 'X',
      },
      { kind: 'closure', dateFrom: '2026-08-05', dateTo: '2026-08-05', period: null },
    ];
    expect(resolveMeal(input({ date: '2026-08-05', exceptions })).source).toBe('closure');
  });

  it('a special period applies for its range, then normal service resumes', () => {
    const special: CalendarExceptionLike = {
      kind: 'special_period',
      dateFrom: '2026-08-10',
      dateTo: '2026-08-14',
      period: null,
      rotationId: 'CAMP',
    };
    const campSlots: RotationSlotLike[] = ALL_PERIODS.flatMap((period) =>
      [0, 1, 2, 3, 4].map((weekday) => ({
        rotationId: 'CAMP',
        weekNumber: 1,
        weekday,
        period,
        mealId: 'CAMP_MEAL',
      })),
    );
    expect(
      resolveMeal(
        input({ date: '2026-08-11', exceptions: [special], slots: [...SLOTS, ...campSlots] }),
      ),
    ).toEqual({ mealId: 'CAMP_MEAL', source: 'special_period' });

    // After the camp ends the base rotation resumes, unshifted: w/c 2026-08-17
    // is rotation week 1 again.
    expect(
      resolveMeal(
        input({ date: '2026-08-18', exceptions: [special], slots: [...SLOTS, ...campSlots] }),
      ),
    ).toEqual({ mealId: 'MEAL_A', source: 'rotation' });
  });

  it('never fabricates a meal when nothing applies', () => {
    expect(resolveMeal(input({ rotation: null }))).toEqual({ mealId: null, source: 'none' });
    expect(resolveMeal(input({ slots: [] }))).toEqual({ mealId: null, source: 'none' });
    // A weekend has no slot in a Mon-Fri rotation.
    expect(resolveMeal(input({ date: '2026-08-09' }))).toEqual({ mealId: null, source: 'none' });
  });
});
