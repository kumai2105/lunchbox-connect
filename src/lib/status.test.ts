import { describe, expect, it } from 'vitest';
import { isEligible, statusDotClass, statusLabel, statusPillClass } from './status';

describe('operational status domain (single approved value)', () => {
  it('recognises the only approved value as eligible', () => {
    expect(isEligible('ACTIVE_BILLABLE_TO_NURSERY')).toBe(true);
    expect(isEligible(null)).toBe(false);
    expect(isEligible('active')).toBe(false); // invented values are not eligible
  });

  it('labels the approved value and the "not eligible" fallback', () => {
    expect(statusLabel('ACTIVE_BILLABLE_TO_NURSERY')).toContain('Active — billable to nursery');
    expect(statusLabel(null)).toBe('Not operationally eligible');
  });

  it('maps statuses to pill/dot classes consistently', () => {
    expect(statusPillClass('ACTIVE_BILLABLE_TO_NURSERY')).toBe('pill free');
    expect(statusPillClass(null)).toBe('pill na');
    expect(statusDotClass('ACTIVE_BILLABLE_TO_NURSERY')).toBe('green');
    expect(statusDotClass(null)).toBe('gray');
  });
});
