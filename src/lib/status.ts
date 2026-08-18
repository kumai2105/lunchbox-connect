import { OPERATIONAL_STATUS_ELIGIBLE } from './types';

/**
 * Operational-status domain (docs/00 §8, docs/03 §5, docs/05 §44).
 * Only ACTIVE_BILLABLE_TO_NURSERY is an approved value. Everything else is
 * NOT_YET_DEFINED — we deliberately offer no invented statuses.
 */

export const STATUS_LABEL = 'ACTIVE_BILLABLE_TO_NURSERY';
export const STATUS_IS_ELIGIBLE = OPERATIONAL_STATUS_ELIGIBLE;

export function statusLabel(status: string | null): string {
  return status === STATUS_IS_ELIGIBLE
    ? 'Active — billable to nursery'
    : 'Not operationally eligible';
}

export function isEligible(status: string | null): boolean {
  return status === STATUS_IS_ELIGIBLE;
}

export function statusPillClass(status: string | null): string {
  return isEligible(status) ? 'pill free' : 'pill na';
}

export function statusDotClass(status: string | null): 'green' | 'gray' {
  return isEligible(status) ? 'green' : 'gray';
}
