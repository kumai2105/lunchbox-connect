import { OPERATIONAL_STATUS_ELIGIBLE } from './types';

/**
 * Operational status. Exactly one value makes a child eligible to be served;
 * no other statuses are invented. The stored value stays as the database
 * defines it — statusLabel() is the only thing a person ever reads.
 */

export const STATUS_IS_ELIGIBLE = OPERATIONAL_STATUS_ELIGIBLE;

/**
 * What a person reads. The STORED value stays ACTIVE_BILLABLE_TO_NURSERY —
 * it is in the database, in RLS predicates and in the spec, and renaming it
 * would be a migration in service of a label.
 *
 * "billable to nursery" is what the displayed text used to say, and it was
 * wrong twice over: an institution here may be a school, not a nursery, and a
 * school administrator reading "billable to nursery" about one of their own
 * pupils is being told something that is not true of them. What the flag
 * actually means is that this child is in the meal service — counted by the
 * kitchen, expected in the classroom register, and charged to their
 * institution. Say that.
 */
export function statusLabel(status: string | null): string {
  return status === STATUS_IS_ELIGIBLE ? 'Active — in the meal service' : 'Not in the meal service';
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
