import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAV_BY_ROLE, canAccessPage, navFor, navPath, provisionableRoles } from './roles';
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

  it('no role advertises hard delete of a core historical entity', () => {
    // Retention / archive / deletion semantics are NOT_YET_DEFINED, and the
    // database denies these outright. The UI must not advertise an authority
    // that does not exist — a Student delete cascades into operational
    // history, a Class delete nulls historical references, and an Institution
    // delete cascades a whole tenant.
    // 0034/0035 extended this to every entity the database refuses to hard
    // delete. Meals, Menus and Kitchens all carry `active` archive semantics.
    const core: Resource[] = [
      'students',
      'classes',
      'institutions',
      'users',
      'meals',
      'menubuilder',
      'kitchens',
    ];
    const offenders: string[] = [];
    ALL_ROLES.forEach((role) => {
      core.forEach((resource) => {
        if (can(role, resource, 'delete')) offenders.push(`${role} may delete ${resource}`);
      });
    });
    expect(offenders).toEqual([]);
  });

  it('read-only roles hold no write permission anywhere', () => {
    const readOnly: AppRole[] = ['viewer', 'finance_owner'];
    const writeActions = ['create', 'update', 'delete', 'publish', 'record', 'set'] as const;
    // `account` is deliberately exempt, and the exemption is narrow: it is the
    // person's OWN name, phone and password, not a record belonging to the
    // business. "Read-only" describes what a Viewer may do to the platform's
    // data — it was never meant to say that a Viewer may not change their own
    // password, which would leave them permanently on whatever an
    // administrator first typed for them. The authority granted reaches
    // exactly one row, enforced server-side by `p_user = auth.uid()` and by
    // Supabase Auth accepting a password change only on the caller's own
    // session.
    readOnly.forEach((role) => {
      viewableResources(role)
        .filter((resource) => resource !== 'account')
        .forEach((resource) => {
          writeActions.forEach((action) => {
            expect(can(role, resource, action), `${role} must not ${action} ${resource}`).toBe(
              false,
            );
          });
        });
    });
  });

  it('only roles with a real screen can be provisioned an account', () => {
    // The role picker on Users & roles is built from this. A role whose entire
    // navigation is `shell: true` has no product behind it, so creating such
    // an account hands somebody a sign-in that leads to "not built yet".
    const offerable = provisionableRoles().sort();
    expect(offerable).toEqual(
      ['classroom_staff', 'kitchen', 'parent', 'school_admin', 'super_admin'].sort(),
    );
    // And the withdrawal is derived, not hard-coded: each excluded role is
    // excluded BECAUSE every one of its nav entries is a shell.
    ALL_ROLES.filter((r) => !offerable.includes(r)).forEach((role) => {
      expect(
        NAV_BY_ROLE[role].every((item) => item.shell),
        `${role} is withheld only because all its screens are shells`,
      ).toBe(true);
      expect(NAV_BY_ROLE[role].length, `${role} still has a planned surface`).toBeGreaterThan(0);
    });
  });

  it('an Institution Admin is shown no unbuilt modules', () => {
    // A customer's own administrator sees the product they have. Shell entries
    // stay for the Super Admin — LunchBox Connect operating the platform is
    // the one audience that benefits from seeing what is planned.
    expect(NAV_BY_ROLE.school_admin.filter((i) => i.shell)).toEqual([]);
    expect(NAV_BY_ROLE.super_admin.some((i) => i.shell)).toBe(true);
  });

  it('every role can reach its own account, and nobody gains more than that', () => {
    // The account resource is the one cell that is true for all nine roles. If
    // a role ever loses it, that role's people can no longer change their own
    // password — which is how this product started, and why the resource
    // exists.
    ALL_ROLES.forEach((role) => {
      expect(can(role, 'account', 'view'), `${role} must reach its own account`).toBe(true);
      expect(can(role, 'account', 'update'), `${role} must be able to change its own account`).toBe(
        true,
      );
    });
    // And it grants nothing over other people: `users` stays administrator-only.
    ALL_ROLES.filter((r) => r !== 'super_admin' && r !== 'school_admin').forEach((role) => {
      expect(can(role, 'users', 'view'), `${role} must not administer other accounts`).toBe(false);
    });
  });
});

/**
 * The sidebar link and the <Route> must agree on the URL.
 *
 * The suite above compares RESOURCE ids to RESOURCE ids, which is why it
 * passed while the Menu Builder link was dead: `navFor()` said the resource
 * was `menubuilder`, the matrix agreed, and the sidebar rendered
 * `to="/menubuilder"` — a path App.tsx never declares. React Router's
 * catch-all swallowed it and bounced the Super Admin to the dashboard, so the
 * only sidebar route to the Menu Builder silently did nothing.
 *
 * This reads App.tsx itself rather than a hand-copied list, so a route renamed
 * without updating the nav fails here instead of in a user's browser.
 */
describe('nav links resolve to declared routes', () => {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const declaredPaths = new Set([...appSource.matchAll(/path="\/([^":/]+)/g)].map((m) => m[1]));

  it('App.tsx declares routes at all (guards against the regex silently matching nothing)', () => {
    expect(declaredPaths.size).toBeGreaterThan(10);
    expect(declaredPaths.has('dashboard')).toBe(true);
  });

  it('every sidebar link for every role points at a route App.tsx declares', () => {
    const dead: string[] = [];
    ALL_ROLES.forEach((role) => {
      navFor(role).forEach((item) => {
        if (!declaredPaths.has(navPath(item))) {
          dead.push(`${role} -> /${navPath(item)} (resource "${item.page}")`);
        }
      });
    });
    expect(dead).toEqual([]);
  });
});
