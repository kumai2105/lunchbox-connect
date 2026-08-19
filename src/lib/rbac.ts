import type { AppRole } from './types';

/**
 * Pure authorization matrix — frontend mirror of the RLS policies
 * (migrations 0004/0010/0011) and docs/02. Implemented values use only the
 * approved keys YES/SCOPED/READ_ONLY from the spec matrix; every cell the spec
 * marks NOT_YET_DEFINED is DENIED here (no invention).
 */

export type Resource =
  | 'dashboard'
  | 'institutions'
  | 'users'
  | 'guardians'
  | 'students'
  | 'classes'
  | 'status'
  | 'menu'
  | 'meals'
  | 'menubuilder'
  | 'analytics'
  | 'review'
  | 'today'
  | 'kitchen'
  | 'kitchens'
  | 'deliveries'
  | 'reports'
  | 'ops'
  | 'absences'
  | 'audit'
  | 'parent';

export type Action = 'view' | 'create' | 'update' | 'delete' | 'publish' | 'record' | 'set';

const MATRIX: Record<Resource, Partial<Record<AppRole, Action[]>>> = {
  dashboard: {
    super_admin: ['view'],
    school_admin: ['view'],
  },
  institutions: { super_admin: ['view', 'create', 'update', 'delete'] },
  users: { super_admin: ['view', 'create', 'update', 'delete'] },
  guardians: {
    super_admin: ['view', 'create', 'update', 'delete'],
    school_admin: ['view', 'create', 'update', 'delete'],
  },
  students: {
    // read scope differs by role; write is admin-only
    super_admin: ['view', 'create', 'update', 'delete'],
    school_admin: ['view', 'create', 'update', 'delete'],
    classroom_staff: ['view'],
  },
  classes: {
    super_admin: ['view', 'create', 'update', 'delete'],
    school_admin: ['view', 'create', 'update', 'delete'],
    classroom_staff: ['view'],
  },
  // operational status: exact list/transitions NOT_YET_DEFINED; the single
  // approved value ACTIVE_BILLABLE_TO_NURSERY is settable by Super Admin only.
  status: { super_admin: ['view', 'set'] },
  // Aggregated meal-performance analytics (docs/13 Decision 032). Super Admin
  // is the only approved "management" role (Decision 007); v_meal_performance
  // and the raw records are RLS-scoped independently of this matrix.
  analytics: { super_admin: ['view'] },
  // Parent-safe note review (blueprint Parts 66-67). Institution-side admins
  // review their own staff's notes; serving_notes RLS scopes the rows.
  review: {
    super_admin: ['view', 'publish'],
    school_admin: ['view', 'publish'],
  },
  meals: {
    super_admin: ['view', 'create', 'update', 'delete'],
  },
  menubuilder: {
    super_admin: ['view', 'create', 'update', 'delete', 'publish'],
  },
  menu: {
    super_admin: ['view', 'create', 'update', 'delete', 'publish'],
    school_admin: ['view'],
    classroom_staff: ['view'],
    kitchen: ['view'],
    parent: ['view'],
  },
  today: {
    super_admin: ['view', 'record'],
    school_admin: ['view', 'record'],
    classroom_staff: ['view', 'record'],
  },
  kitchen: { super_admin: ['view'], kitchen: ['view'] },
  // Kitchen *entities* (docs/13 Decision 031) — Super Admin only, same as
  // institutions. Not the production-demand screen above.
  kitchens: { super_admin: ['view', 'create', 'update', 'delete'] },
  deliveries: { super_admin: ['view'], school_admin: ['view'], driver: ['view'] },
  reports: {
    super_admin: ['view'],
    school_admin: ['view'],
    finance_owner: ['view'],
    viewer: ['view'],
  },
  ops: { super_admin: ['view'], operations_manager: ['view'] },
  absences: { super_admin: ['view'], school_admin: ['view'] },
  audit: { super_admin: ['view'] },
  parent: { super_admin: ['view'], parent: ['view'] },
};

export function can(role: AppRole | null | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  return MATRIX[resource]?.[role]?.includes(action) ?? false;
}

export function viewableResources(role: AppRole): Resource[] {
  return (Object.keys(MATRIX) as Resource[]).filter((r) => can(role, r, 'view'));
}
