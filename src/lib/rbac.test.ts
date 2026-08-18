import { describe, expect, it } from 'vitest';
import { can, viewableResources } from './rbac';
import type { AppRole } from './types';

const ALL_ROLES: AppRole[] = [
  'super_admin',
  'school_admin',
  'operations_manager',
  'finance_owner',
  'viewer',
  'parent',
  'classroom_staff',
  'kitchen',
  'driver',
];

describe('rbac matrix (9 role domains — docs/02)', () => {
  it('rejects everything for an unknown / null role', () => {
    expect(can(null, 'dashboard', 'view')).toBe(false);
    expect(can(undefined, 'students', 'view')).toBe(false);
    expect(can('santa' as AppRole, 'students', 'view')).toBe(false);
  });

  it('super_admin can view every resource and holds every management power', () => {
    const resources = viewableResources('super_admin');
    expect(resources).toContain('institutions');
    expect(resources).toContain('users');
    expect(resources).toContain('audit');
    for (const r of resources) {
      expect(can('super_admin', r, 'view')).toBe(true);
    }
    expect(can('super_admin', 'students', 'create')).toBe(true);
    expect(can('super_admin', 'status', 'set')).toBe(true);
    expect(can('super_admin', 'menu', 'publish')).toBe(true);
    expect(can('super_admin', 'today', 'record')).toBe(true);
    expect(can('super_admin', 'kitchens', 'create')).toBe(true); // provisions Kitchen entities
  });

  it('school_admin is scoped to own institution and never the central menu', () => {
    expect(can('school_admin', 'students', 'create')).toBe(true);
    expect(can('school_admin', 'guardians', 'update')).toBe(true);
    expect(can('school_admin', 'status', 'set')).toBe(false); // NOT_YET_DEFINED -> deny
    expect(can('school_admin', 'menu', 'create')).toBe(false);
    expect(can('school_admin', 'users', 'view')).toBe(false);
    expect(can('school_admin', 'institutions', 'view')).toBe(false);
    expect(can('school_admin', 'audit', 'view')).toBe(false);
  });

  it('school_admin cannot manage Kitchen accounts or entities (docs/13 Decision 031)', () => {
    // Kitchen belongs to the LunchBox Connect operational side, not the
    // Nursery/School — Nursery Admin has no capability over the kitchens
    // resource at all, mirroring 'users' (only Super Admin provisions accounts).
    for (const action of ['view', 'create', 'update', 'delete'] as const) {
      expect(can('school_admin', 'kitchens', action)).toBe(false);
      expect(can('school_admin', 'users', action)).toBe(false);
    }
  });

  it('classroom_staff is view+record only, assigned scope (AT-032)', () => {
    expect(can('classroom_staff', 'today', 'record')).toBe(true);
    expect(can('classroom_staff', 'students', 'view')).toBe(true);
    expect(can('classroom_staff', 'students', 'create')).toBe(false);
    expect(can('classroom_staff', 'classes', 'view')).toBe(true);
    expect(can('classroom_staff', 'status', 'view')).toBe(false);
    expect(can('classroom_staff', 'menu', 'view')).toBe(true); // allergy awareness
  });

  it('kitchen sees derived production + menu reference only (AT-034)', () => {
    expect(can('kitchen', 'kitchen', 'view')).toBe(true);
    expect(can('kitchen', 'menu', 'view')).toBe(true);
    expect(can('kitchen', 'students', 'view')).toBe(false);
    expect(can('kitchen', 'status', 'set')).toBe(false); // AT-012
    expect(can('kitchen', 'reports', 'view')).toBe(false);
    expect(can('kitchen', 'today', 'record')).toBe(false);
    // Kitchen users cannot manage the kitchens entity table themselves either —
    // provisioning/administration of Kitchen entities is Super Admin only.
    expect(can('kitchen', 'kitchens', 'view')).toBe(false);
  });

  it('driver is scoped to assigned deliveries (AT-033)', () => {
    expect(can('driver', 'deliveries', 'view')).toBe(true);
    expect(can('driver', 'today', 'view')).toBe(false);
    expect(can('driver', 'students', 'view')).toBe(false);
  });

  it('finance_owner is reports only (AT-035) and viewer is read-only (AT-036)', () => {
    expect(can('finance_owner', 'reports', 'view')).toBe(true);
    expect(can('finance_owner', 'students', 'update')).toBe(false);
    expect(can('viewer', 'reports', 'view')).toBe(true);
    for (const action of ['create', 'update', 'delete', 'publish', 'record', 'set'] as const) {
      expect(can('viewer', 'status', action)).toBe(false);
      expect(can('viewer', 'students', action)).toBe(false);
    }
  });

  it('operations_manager: ops log/issues view only', () => {
    expect(can('operations_manager', 'ops', 'view')).toBe(true);
    expect(can('operations_manager', 'students', 'update')).toBe(false);
  });

  it('parent sees only the parent surface + menu (AT-031)', () => {
    const visible = viewableResources('parent').sort();
    expect(visible).toEqual(['menu', 'parent']);
    expect(can('parent', 'today', 'view')).toBe(false);
    expect(can('parent', 'status', 'view')).toBe(false);
    expect(can('parent', 'menu', 'view')).toBe(true); // confirmed parent menu visibility
  });

  it('no role outside the matrix gets invented powers', () => {
    for (const role of ALL_ROLES) {
      expect(can(role, 'menu', 'publish')).toBe(role === 'super_admin');
      expect(can(role, 'status', 'set')).toBe(role === 'super_admin');
    }
  });
});
