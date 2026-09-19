import { describe, expect, it } from 'vitest';
import { groupDemandByRevision, type DemandRowLike } from './kitchen';

function row(p: Partial<DemandRowLike>): DemandRowLike {
  return {
    institution_id: 'i1',
    institution_name: 'Nursery',
    period: 'lunch',
    meal_revision_id: 'rev-1',
    meal_name: 'Chicken Pasta',
    eligible_students: 1,
    safety_note_flagged: 0,
    ...p,
  };
}

describe('groupDemandByRevision (kitchen production identity)', () => {
  it('two different revisions with the SAME name stay separate production lines', () => {
    const rows = [
      row({ meal_revision_id: 'rev-A', meal_name: 'Soup', eligible_students: 3 }),
      row({ meal_revision_id: 'rev-B', meal_name: 'Soup', eligible_students: 5 }),
    ];
    const out = groupDemandByRevision(rows);
    expect(out).toHaveLength(2); // NOT merged by the shared name
    expect(out.find((l) => l.meal_revision_id === 'rev-A')!.total).toBe(3);
    expect(out.find((l) => l.meal_revision_id === 'rev-B')!.total).toBe(5);
  });

  it('the SAME revision at several sites is one line with summed headcount', () => {
    const rows = [
      row({ institution_id: 'i1', meal_revision_id: 'rev-1', eligible_students: 4 }),
      row({
        institution_id: 'i2',
        meal_revision_id: 'rev-1',
        eligible_students: 6,
        safety_note_flagged: 2,
      }),
    ];
    const out = groupDemandByRevision(rows);
    expect(out).toHaveLength(1);
    expect(out[0].total).toBe(10);
    expect(out[0].safetyNotes).toBe(2);
    expect(out[0].sites).toHaveLength(2);
  });

  it('the same revision in different periods is not merged across periods', () => {
    const rows = [
      row({ period: 'breakfast', meal_revision_id: 'rev-1' }),
      row({ period: 'lunch', meal_revision_id: 'rev-1' }),
    ];
    const out = groupDemandByRevision(rows);
    expect(out).toHaveLength(2);
    // breakfast sorts before lunch
    expect(out[0].period).toBe('breakfast');
  });
});
