import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './api';

/**
 * The defect this guards: mealObservations() ended with `.limit(5000)` and
 * MealAnalytics computed every KPI, table and chart for the requested window
 * from whatever came back. A 90-day period with more than 5,000 observations
 * therefore produced wrong-but-plausible numbers — silently.
 */
describe('exhaustive pagination (no silent analytics cap)', () => {
  const server = (total: number) =>
    vi.fn(async (from: number, to: number) => {
      const rows = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ id: i });
      return { data: rows, error: null };
    });

  it('returns EVERY row past the old 5,000 cap', async () => {
    const total = 12_345;
    const fetchPage = server(total);
    const res = await fetchAllPages<{ id: number }>(1000, fetchPage);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(total);
    // and no row is dropped or duplicated
    expect(new Set(res.data!.map((r) => r.id)).size).toBe(total);
    expect(res.data![0].id).toBe(0);
    expect(res.data![total - 1].id).toBe(total - 1);
  });

  it('the aggregate over the full set is exact, not the first page', async () => {
    // 6,000 rows, every one a 100% observation: the honest mean is 100. A
    // capped read would still say 100 here, so make the tail different: the
    // last 1,000 rows are 0%. Mean over ALL 6,000 is 83.333…; a 5,000-row cap
    // would report 100 and look perfectly reasonable.
    const total = 6000;
    const fetchPage = vi.fn(async (from: number, to: number) => {
      const rows = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) {
        rows.push({ id: i, pct: i < 5000 ? 100 : 0 });
      }
      return { data: rows, error: null };
    });
    const res = await fetchAllPages<{ id: number; pct: number }>(1000, fetchPage);
    const mean = res.data!.reduce((s, r) => s + r.pct, 0) / res.data!.length;
    expect(res.data).toHaveLength(6000);
    expect(Math.round(mean)).toBe(83);
    expect(Math.round(mean)).not.toBe(100); // what the old cap would have said
  });

  it('stops on the first short page rather than looping forever', async () => {
    const fetchPage = server(1500);
    await fetchAllPages(1000, fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops exactly at an even page boundary', async () => {
    // 2,000 rows in pages of 1,000: page 3 comes back empty and ends it.
    const fetchPage = server(2000);
    const res = await fetchAllPages(1000, fetchPage);
    expect(res.data).toHaveLength(2000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('surfaces a server error instead of returning a partial set as complete', async () => {
    const fetchPage = vi.fn(async (from: number) =>
      from === 0
        ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }
        : { data: null, error: 'connection lost' },
    );
    const res = await fetchAllPages(1000, fetchPage);
    expect(res.error).toBe('connection lost');
    expect(res.data).toBeNull();
  });
});
