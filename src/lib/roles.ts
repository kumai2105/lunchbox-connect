import type { AppRole } from './types';
import type { IconName } from '../components/icons';
import { can, type Resource } from './rbac';

export interface NavItem {
  page: string;
  label: string;
  icon: IconName;
  shell?: boolean; // NOT_YET_DEFINED spec area — honest shell, no invented features
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
    { page: 'menu', label: 'Menus', icon: 'utensils' },
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
    { page: 'classes', label: 'Classes', icon: 'folder' },
    { page: 'menu', label: 'Menus', icon: 'utensils' },
    { page: 'today', label: 'Today — serving', icon: 'sun' },
    { page: 'review', label: 'Parent-safe updates', icon: 'checkCircle' },
    { page: 'absences', label: 'Absences', icon: 'xCircle', shell: true },
    { page: 'deliveries', label: 'Deliveries', icon: 'truck', shell: true },
    { page: 'reports', label: 'Reporting', icon: 'barChart', shell: true },
  ],
  operations_manager: [{ page: 'ops', label: 'Ops log & issues', icon: 'wrench', shell: true }],
  finance_owner: [{ page: 'reports', label: 'Reports', icon: 'barChart', shell: true }],
  viewer: [{ page: 'reports', label: 'Reports (read-only)', icon: 'barChart', shell: true }],
  parent: [{ page: 'parent', label: 'My child', icon: 'home' }],
  classroom_staff: [
    { page: 'today', label: 'Today — serving', icon: 'sun' },
    { page: 'students', label: 'My students', icon: 'users' },
  ],
  kitchen: [
    { page: 'kitchen', label: 'Production demand', icon: 'flame' },
    { page: 'menu', label: 'Menu reference', icon: 'utensils' },
  ],
  driver: [{ page: 'deliveries', label: 'My deliveries', icon: 'truck', shell: true }],
};

export function navFor(role: AppRole): NavItem[] {
  return NAV_BY_ROLE[role] ?? [];
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
