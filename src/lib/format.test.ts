import { describe, expect, it } from 'vitest';
import {
  isoWeek,
  operationalDateFor,
  operationalDaysAgoISO,
  weekEndISO,
  weekStartISO,
} from './format';

/**
 * UAE operational date (Asia/Dubai = GST = UTC+4, no DST). The MVP market is
 * Dubai/Sharjah, where a UTC calendar date is wrong between 20:00 and 24:00
 * UTC (00:00-04:00 local). These pin the midnight boundary deterministically.
 */
describe('operational date (Asia/Dubai)', () => {
  it('is UTC+4: 20:30 UTC is already the next calendar day in Dubai', () => {
    // 2026-08-20T20:30Z = 2026-08-21T00:30 Dubai.
    expect(operationalDateFor(new Date('2026-08-20T20:30:00Z'))).toBe('2026-08-21');
    // UTC would say 2026-08-20 here — that is exactly the bug being fixed.
    expect(new Date('2026-08-20T20:30:00Z').toISOString().slice(0, 10)).toBe('2026-08-20');
  });

  it('just before the boundary stays on the same day', () => {
    // 2026-08-20T19:59Z = 2026-08-20T23:59 Dubai.
    expect(operationalDateFor(new Date('2026-08-20T19:59:00Z'))).toBe('2026-08-20');
  });

  it('early-morning UTC is the same Dubai day', () => {
    // 2026-08-20T00:00Z = 2026-08-20T04:00 Dubai.
    expect(operationalDateFor(new Date('2026-08-20T00:00:00Z'))).toBe('2026-08-20');
  });

  it('operationalDaysAgoISO counts back Dubai calendar days across the boundary', () => {
    const base = new Date('2026-08-20T20:30:00Z'); // Dubai 2026-08-21
    expect(operationalDaysAgoISO(0, base)).toBe('2026-08-21');
    expect(operationalDaysAgoISO(1, base)).toBe('2026-08-20');
    expect(operationalDaysAgoISO(7, base)).toBe('2026-08-14');
  });
});

/**
 * isoWeek previously divided by seven twice, so the week number advanced once
 * every SEVEN calendar weeks. Nothing addresses meals by it any more, but it is
 * exported, and a helper that is quietly wrong is a trap for the next caller.
 */
describe('isoWeek', () => {
  it('matches known ISO-8601 week numbers', () => {
    // 2026-01-01 is a Thursday, so ISO week 1 of 2026 runs Mon 2025-12-29..Sun 2026-01-04.
    expect(isoWeek(new Date('2026-01-01T12:00:00'))).toBe(1);
    expect(isoWeek(new Date('2026-01-05T12:00:00'))).toBe(2);
    expect(isoWeek(new Date('2026-08-19T12:00:00'))).toBe(34);
    expect(isoWeek(new Date('2026-12-21T12:00:00'))).toBe(52);
  });

  it('advances by exactly one every week — the regression that froze the menu', () => {
    let prev = isoWeek(new Date('2026-01-05T12:00:00'));
    let changes = 0;
    for (let i = 1; i < 12; i += 1) {
      const d = new Date('2026-01-05T12:00:00');
      d.setDate(d.getDate() + i * 7);
      const w = isoWeek(d);
      if (w !== prev) changes += 1;
      expect(w).toBe(prev + 1);
      prev = w;
    }
    // The broken version managed 2.
    expect(changes).toBe(11);
  });

  it('is stable within a single week', () => {
    const monday = isoWeek(new Date('2026-08-17T12:00:00'));
    for (let i = 0; i < 7; i += 1) {
      const d = new Date('2026-08-17T12:00:00');
      d.setDate(d.getDate() + i);
      expect(isoWeek(d)).toBe(monday);
    }
  });
});

describe('week boundaries', () => {
  it('returns Monday and Sunday of the containing week', () => {
    // 2026-08-19 is a Wednesday.
    expect(weekStartISO(new Date('2026-08-19T12:00:00'))).toBe('2026-08-17');
    expect(weekEndISO(new Date('2026-08-19T12:00:00'))).toBe('2026-08-23');
  });

  it('treats Sunday as the END of its week, not the start', () => {
    expect(weekStartISO(new Date('2026-08-23T12:00:00'))).toBe('2026-08-17');
    expect(weekEndISO(new Date('2026-08-23T12:00:00'))).toBe('2026-08-23');
  });

  it('spans a month boundary correctly', () => {
    expect(weekStartISO(new Date('2026-09-02T12:00:00'))).toBe('2026-08-31');
    expect(weekEndISO(new Date('2026-08-31T12:00:00'))).toBe('2026-09-06');
  });
});
