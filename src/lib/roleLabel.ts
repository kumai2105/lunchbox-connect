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
  school_admin: 'Nursery / School Admin',
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
