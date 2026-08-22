import { OPERATIONAL_STATUS_ELIGIBLE } from './types';

/**
 * Operational status. Exactly one value makes a child eligible to be served;
 * no other statuses are invented. The stored value stays as the database
 * defines it — statusLabel() is the only thing a person ever reads.
 */

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
