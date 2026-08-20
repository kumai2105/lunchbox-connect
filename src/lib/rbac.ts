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
  | 'schedule'
  | 'students'
  | 'classes'
  | 'staff'
  | 'status'
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
  // Hard DELETE of core historical entities is NOT advertised anywhere:
  // retention / archive / deletion semantics are NOT_YET_DEFINED, a Student
  // delete cascades into operational relationships and history, a Class delete
  // nulls historical references, and an Institution delete cascades a whole
  // tenant. The database denies these outright (0033); the UI must not claim
  // an authority that does not exist. Where an approved `active` / archive
  // mechanism exists (rotations), that is used instead.
  institutions: { super_admin: ['view', 'create', 'update'] },
  users: { super_admin: ['view', 'create', 'update'] },
  // §5: exact Nursery guardian actions are NOT_YET_DEFINED. School Admin keeps
  // read-only visibility of existing authorized relationships; the
  // link/create/delete + Parent provisioning workflow is BLOCKED_BY_SPEC.
  guardians: {
    super_admin: ['view', 'create', 'update', 'delete'],
    school_admin: ['view'],
  },
  students: {
    // read scope differs by role; write is admin-only
    super_admin: ['view', 'create', 'update'],
    school_admin: ['view', 'create', 'update'],
    classroom_staff: ['view'],
  },
  classes: {
    super_admin: ['view', 'create', 'update'],
    school_admin: ['view', 'create', 'update'],
    classroom_staff: ['view'],
  },
  // §4/§17: institution-scoped staff provisioning + class assignment. A Nursery
  // Admin (school_admin) manages classroom staff for their OWN institution; the
  // Edge Function and RLS enforce that boundary server-side regardless of UI.
  staff: {
    super_admin: ['view', 'create', 'update'],
    school_admin: ['view', 'create', 'update'],
  },
  // operational status: exact list/transitions NOT_YET_DEFINED; the single
  // approved value ACTIVE_BILLABLE_TO_NURSERY is settable by Super Admin only.
  status: { super_admin: ['view', 'set'] },
  // Aggregated meal-performance analytics (docs/13 Decision 032). Super Admin
  // is the only approved "management" role (Decision 007); v_meal_performance
  // and the raw records are RLS-scoped independently of this matrix.
  analytics: { super_admin: ['view'] },
  // §4: the reviewer role/process/conditions for publishing Classroom free text
  // are NOT_YET_DEFINED. Only the Super Admin system-wide administrative
  // override may publish; a normal institution-side review workflow is
  // BLOCKED_BY_SPEC and must not be invented.
  review: {
    super_admin: ['view', 'publish'],
  },
  // Migration 0034 removed authenticated hard DELETE from Meals and Menus:
  // both carry `active` archive/deactivation semantics, and exact retention is
  // NOT_YET_DEFINED. Advertising `delete` here promised an action the database
  // refuses, so it is gone from the matrix too.
  // Founder-approved: a Nursery/School Admin may SEE their own institution's
  // published schedule. Read-only by construction — there is no create/update/
  // publish action here, and the database serves only published rows for their
  // own institution (meal_services_select). Menu authorship stays with the
  // Super Admin under `menubuilder`.
  schedule: {
    // The institution's own view of its published menu. A Super Admin is not
    // anchored to one institution and already authors the schedule in Menu
    // Builder, so this resource belongs to the Nursery/School Admin.
    school_admin: ['view'],
  },
  meals: {
    super_admin: ['view', 'create', 'update'],
  },
  menubuilder: {
    super_admin: ['view', 'create', 'update', 'publish'],
  },
  // §3: Classroom meal RECORDING by Nursery/School Admin is NOT_YET_DEFINED and
  // is not granted. Classroom Staff record within assigned classes; Super Admin
  // keeps the explicitly approved administrative override.
  today: {
    super_admin: ['view', 'record'],
    classroom_staff: ['view', 'record'],
  },
  kitchen: { super_admin: ['view'], kitchen: ['view'] },
  // Kitchen *entities* (docs/13 Decision 031) — Super Admin only, same as
  // institutions. Not the production-demand screen above. Archive-only, as for
  // Meals and Menus (0034).
  kitchens: { super_admin: ['view', 'create', 'update'] },
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
