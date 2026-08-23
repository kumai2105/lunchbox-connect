import type { AppRole } from './types';
import type { IconName } from '../components/icons';
import { can, type Resource } from './rbac';

export interface NavItem {
  /**
   * The RBAC resource id — the key `can()` and `canAccessPage()` are asked
   * about. It is NOT the URL. Conflating the two is what broke the Menu
   * Builder link: the resource is `menubuilder`, the route is `/menu-builder`,
   * and a sidebar that navigated to `/${page}` sent every Super Admin to a
   * path no <Route> matched — the catch-all bounced them to the dashboard, so
   * the only sidebar entry point to the Menu Builder did nothing at all.
   */
  page: string;
  /**
   * URL path segment, when it differs from the resource id. Defaults to
   * `page`. Keep this in step with the <Route path=…> in App.tsx.
   */
  path?: string;
  label: string;
  icon: IconName;
  shell?: boolean; // planned but not built — honest shell, no invented features
  // Reachable and access-controlled the same as any other page, but not
  // listed in the sidebar — Classes always belongs to one Institution
  // (docs/04 §8), so it's reached by drilling into an Institution instead of
  // sitting as an unrelated top-level menu item.
  hidden?: boolean;
}

// Nine approved role domains from docs/02 + docs/06 screen inventory.
export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  super_admin: [
    { page: 'dashboard', label: 'Command center', icon: 'home' },
    { page: 'institutions', label: 'Institutions', icon: 'building' },
    { page: 'users', label: 'Users', icon: 'user' },
    { page: 'students', label: 'Students', icon: 'users' },
    { page: 'guardians', label: 'Parents / guardians', icon: 'heart' },
    // Reached from within an Institution's row (Manage classes →), not the
    // sidebar — a Class always belongs to exactly one Institution.
    { page: 'classes', label: 'Classes', icon: 'folder', hidden: true },
    { page: 'status', label: 'Status / eligibility', icon: 'checkCircle' },
    { page: 'meals', label: 'Meal Library', icon: 'apple' },
    { page: 'menubuilder', path: 'menu-builder', label: 'Menu Builder', icon: 'utensils' },
    { page: 'analytics', label: 'Meal analytics', icon: 'barChart' },
    { page: 'today', label: 'Serving (Today)', icon: 'sun' },
    { page: 'review', label: 'Parent-safe updates', icon: 'checkCircle' },
    { page: 'kitchen', label: 'Kitchen production', icon: 'flame' },
    { page: 'deliveries', label: 'Deliveries', icon: 'truck', shell: true },
    { page: 'reports', label: 'Reporting', icon: 'barChart', shell: true },
    { page: 'audit', label: 'Audit', icon: 'clipboardList' },
  ],
  school_admin: [
    { page: 'dashboard', label: 'Dashboard', icon: 'home' },
    { page: 'students', label: 'Students', icon: 'users' },
    { page: 'guardians', label: 'Parents / guardians', icon: 'heart' },
    { page: 'schedule', label: 'Published menu', icon: 'utensils' },
    { page: 'classes', label: 'Classes', icon: 'folder' },
    { page: 'staff', label: 'Staff', icon: 'user' },
    // §3/§4: Classroom recording and note publication by a Nursery Admin are
    // NOT_YET_DEFINED, so Today (serving) and Parent-safe updates are not in the
    // Nursery Admin nav.
    //
    // Absences, Deliveries and Reporting are ALSO absent, and that is a
    // deliberate removal rather than an oversight. All three were empty shells
    // — real menu entries leading to a screen that says the module is not
    // built. A customer's administrator signing in to their own nursery should
    // see the product they actually have, not three promises. The Super Admin
    // (that is, LunchBox Connect itself) keeps its shell entries, because the
    // operator of the platform is the one person who benefits from seeing what
    // is planned and unbuilt.
  ],
  operations_manager: [{ page: 'ops', label: 'Ops log & issues', icon: 'wrench', shell: true }],
  finance_owner: [{ page: 'reports', label: 'Reports', icon: 'barChart', shell: true }],
  viewer: [{ page: 'reports', label: 'Reports (read-only)', icon: 'barChart', shell: true }],
  parent: [{ page: 'parent', label: 'My child', icon: 'home' }],
  classroom_staff: [
    { page: 'today', label: 'Today — serving', icon: 'sun' },
    { page: 'students', label: 'My students', icon: 'users' },
  ],
  kitchen: [{ page: 'kitchen', label: 'Production demand', icon: 'flame' }],
  driver: [{ page: 'deliveries', label: 'My deliveries', icon: 'truck', shell: true }],
};

/**
 * Your own account screen.
 *
 * Hidden from the sidebar list — it is reached by clicking your own name in
 * the sidebar footer, where people look for it — but it is a real route, so it
 * still needs a nav entry for canAccessPage() and resourceForPath() to know
 * about. Every role has one; the Parent portal has its own equivalent inside
 * the Parent shell and does not use this route.
 */
const ACCOUNT_ITEM: NavItem = {
  page: 'account',
  label: 'Your account',
  icon: 'user',
  hidden: true,
};

/**
 * The roles an administrator may actually issue an account for.
 *
 * DERIVED, not listed by hand: a role is offerable only if at least one page
 * in its navigation is a REAL screen rather than a `shell: true` placeholder.
 * Today that removes Operations Manager, Finance / Owner, Viewer and Driver —
 * every one of those roles' entire product is a screen that says the module is
 * not built, so creating such an account hands somebody a sign-in that leads
 * nowhere. Those role values stay in the database enum, in the RBAC matrix and
 * in the spec, because the roles are real and their screens are planned; what
 * is withdrawn is the offer to provision a person into one today.
 *
 * When one of those modules is built, its nav entry loses `shell: true` and
 * the role reappears here on its own. Nothing needs remembering.
 */
export function provisionableRoles(): AppRole[] {
  return (Object.keys(NAV_BY_ROLE) as AppRole[]).filter((role) =>
    NAV_BY_ROLE[role].some((item) => !item.shell),
  );
}

export function navFor(role: AppRole): NavItem[] {
  return NAV_BY_ROLE[role] ?? [];
}

/** The URL segment a nav item links to. */
export function navPath(item: NavItem): string {
  return item.path ?? item.page;
}

/**
 * Inverse of `navPath`: the RBAC resource behind a URL segment.
 *
 * The chrome (topbar title, active sidebar item) is keyed by resource, but all
 * it has to work from is `location.pathname`. Without this, `/menu-builder`
 * resolved to no known resource and the topbar silently displayed
 * "Dashboard" while the sidebar highlighted nothing.
 */
const RESOURCE_BY_PATH: Record<string, string> = Object.fromEntries(
  [...Object.values(NAV_BY_ROLE).flat(), ACCOUNT_ITEM].map((item) => [navPath(item), item.page]),
);

export function resourceForPath(segment: string): string {
  return RESOURCE_BY_PATH[segment] ?? segment;
}

/**
 * Route gate.
 *
 * Derived from the RBAC matrix — the authorization source of truth — NOT from
 * the nav list, which is a presentation concern. Deriving it from nav meant a
 * role could hold a documented permission and still be locked out of the page,
 * which was true for six role/page pairs (super_admin -> ops, absences, parent;
 * classroom_staff -> classes, menu; parent -> menu). Nav now decides what is
 * *shown*; the matrix decides what is *reachable*.
 *
 * This is a convenience gate for routing only. It is not the security boundary
 * — RLS is, and it re-checks every read and write independently.
 */
export function canAccessPage(role: AppRole, page: string): boolean {
  return can(role, page as Resource, 'view');
}
