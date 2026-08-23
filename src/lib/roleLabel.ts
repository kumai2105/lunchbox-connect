import type { AppRole } from './types';

/**
 * Stored role values are lower_snake identifiers — SUPER_ADMIN, CLASSROOM_STAFF
 * and the rest are the database's vocabulary, not a customer's. Anywhere a role
 * is shown to a person it goes through here, so screens read "Classroom staff"
 * rather than shouting an enum at a nursery manager.
 *
 * The stored value is never changed by this — only what is displayed.
 */
const LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  // The person administering ONE customer Institution, which may be a nursery
  // or a school. "School Admin" told a nursery manager they were something they
  // are not; naming both is clumsy and still implies the two are different
  // roles. The STORED value stays `school_admin` — renaming a database enum
  // that RLS, RBAC and years of tests depend on would be a migration in service
  // of a label.
  school_admin: 'Institution Admin',
  operations_manager: 'Operations Manager',
  finance_owner: 'Finance / Owner',
  viewer: 'Viewer',
  parent: 'Parent',
  classroom_staff: 'Classroom staff',
  kitchen: 'Kitchen',
  driver: 'Driver',
};

export function roleLabel(role: AppRole | string | null | undefined): string {
  if (!role) return 'No role';
  return LABELS[role] ?? String(role).replace(/_/g, ' ');
}
