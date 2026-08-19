import { describe, expect, it } from 'vitest';
import { NAV_BY_ROLE, canAccessPage, navFor } from './roles';
import { can, viewableResources, type Resource } from './rbac';
import type { AppRole } from './types';

/**
 * Cross-consistency between the two authorization sources.
 *
 * `canAccessPage()` gates every route, and it is implemented over the NAV list
 * — not over the RBAC matrix. That means a role can hold a permission in
 * `rbac.ts` and still be locked out of the page, or (worse) appear in a nav
 * without a matching permission. These are silent failures: nothing throws,
 * the user just sees the wrong thing. This suite makes them loud.
 *
 * The frontend is not the security boundary either way — RLS is — but a
 * mismatch here is still a real defect in what users can reach.
 */

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

// Routes declared in App.tsx, keyed by the `page` passed to <Page page="...">.
// Kept here deliberately: if a route is added without updating this list, the
// "every route is reachable by someone" test below fails.
const ROUTED_PAGES = [
  'dashboard',
  'institutions',
  'users',
  'students',
  'guardians',
  'classes',
  'status',
  'audit',
  'meals',
  'menubuilder',
  'analytics',
  'review',
  'today',
  'kitchen',
  'deliveries',
  'reports',
  'ops',
  'absences',
  'parent',
] as const;

describe('authorization consistency: nav vs rbac matrix', () => {
  it('every nav entry a role has is also a viewable resource in the rbac matrix', () => {
    const mismatches: string[] = [];
    ALL_ROLES.forEach((role) => {
      navFor(role).forEach((item) => {
        if (!can(role, item.page as Resource, 'view')) {
          mismatches.push(`${role} has nav "${item.page}" but rbac denies view`);
        }
      });
    });
    expect(mismatches).toEqual([]);
  });

  it('every resource a role may view is reachable — no permission without a route', () => {
    const unreachable: string[] = [];
    ALL_ROLES.forEach((role) => {
      viewableResources(role).forEach((resource) => {
        // `kitchens` is an entity-level permission (Decision 031), not a page.
        if (resource === 'kitchens') return;
        if (!canAccessPage(role, resource)) {
          unreachable.push(`${role} may view "${resource}" but canAccessPage() denies it`);
        }
      });
    });
    expect(unreachable).toEqual([]);
  });

  it('every routed page is reachable by at least one role', () => {
    const orphaned = ROUTED_PAGES.filter(
      (page) => !ALL_ROLES.some((role) => canAccessPage(role, page)),
    );
    expect(orphaned).toEqual([]);
  });

  it('no role has a duplicate nav entry', () => {
    ALL_ROLES.forEach((role) => {
      const pages = navFor(role).map((i) => i.page);
      expect(new Set(pages).size, `${role} has duplicate nav entries`).toBe(pages.length);
    });
  });

  it('every role lands somewhere: navFor() is never empty', () => {
    ALL_ROLES.forEach((role) => {
      expect(navFor(role).length, `${role} has no landing page`).toBeGreaterThan(0);
    });
  });

  it('a hidden nav item is still access-controlled, not silently public', () => {
    // Classes is hidden from the sidebar for super_admin (reached by drilling
    // into an Institution) but must remain permission-gated.
    const hidden = NAV_BY_ROLE.super_admin.filter((i) => i.hidden);
    hidden.forEach((item) => {
      expect(canAccessPage('super_admin', item.page)).toBe(true);
      // A role without the entry must still be denied.
      expect(canAccessPage('parent', item.page)).toBe(false);
    });
  });

  it('parent, kitchen and driver cannot reach administrative pages', () => {
    const forbidden = ['institutions', 'users', 'students', 'audit', 'analytics', 'review'];
    (['parent', 'kitchen', 'driver'] as AppRole[]).forEach((role) => {
      forbidden.forEach((page) => {
        expect(canAccessPage(role, page), `${role} must not reach ${page}`).toBe(false);
      });
    });
  });

  it('read-only roles hold no write permission anywhere', () => {
    const readOnly: AppRole[] = ['viewer', 'finance_owner'];
    const writeActions = ['create', 'update', 'delete', 'publish', 'record', 'set'] as const;
    readOnly.forEach((role) => {
      viewableResources(role).forEach((resource) => {
        writeActions.forEach((action) => {
          expect(can(role, resource, action), `${role} must not ${action} ${resource}`).toBe(false);
        });
      });
    });
  });
});
