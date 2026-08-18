import type { AppRole } from './types';

export interface NavItem {
  page: string;
  label: string;
  icon: string;
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
    { page: 'dashboard', label: 'Command center', icon: '⌂' },
    { page: 'institutions', label: 'Institutions', icon: '🏛' },
    { page: 'users', label: 'Users', icon: '👤' },
    { page: 'students', label: 'Students', icon: '👪' },
    { page: 'guardians', label: 'Parents / guardians', icon: '👨👩👧' },
    // Reached from within an Institution's row (Manage classes →), not the
    // sidebar — a Class always belongs to exactly one Institution.
    { page: 'classes', label: 'Classes', icon: '🗀', hidden: true },
    { page: 'status', label: 'Status / eligibility', icon: '✓' },
    { page: 'menu', label: 'Menus', icon: '🍱' },
    { page: 'today', label: 'Serving (Today)', icon: '☀' },
    { page: 'kitchen', label: 'Kitchen production', icon: '🍳' },
    { page: 'deliveries', label: 'Deliveries', icon: '🚚', shell: true },
    { page: 'reports', label: 'Reporting', icon: '📊', shell: true },
    { page: 'audit', label: 'Audit', icon: '📋' },
  ],
  school_admin: [
    { page: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { page: 'students', label: 'Students', icon: '👪' },
    { page: 'guardians', label: 'Parents / guardians', icon: '👨👩👧' },
    { page: 'classes', label: 'Classes', icon: '🗀' },
    { page: 'menu', label: 'Menus', icon: '🍱' },
    { page: 'today', label: 'Today — serving', icon: '☀' },
    { page: 'absences', label: 'Absences', icon: '∅', shell: true },
    { page: 'deliveries', label: 'Deliveries', icon: '🚚', shell: true },
    { page: 'reports', label: 'Reporting', icon: '📊', shell: true },
  ],
  operations_manager: [{ page: 'ops', label: 'Ops log & issues', icon: '🔧', shell: true }],
  finance_owner: [{ page: 'reports', label: 'Reports', icon: '📊', shell: true }],
  viewer: [{ page: 'reports', label: 'Reports (read-only)', icon: '📊', shell: true }],
  parent: [{ page: 'parent', label: 'My child', icon: '🏠' }],
  classroom_staff: [
    { page: 'today', label: 'Today — serving', icon: '☀' },
    { page: 'students', label: 'My students', icon: '👪' },
  ],
  kitchen: [
    { page: 'kitchen', label: 'Production demand', icon: '🍳' },
    { page: 'menu', label: 'Menu reference', icon: '🍱' },
  ],
  driver: [{ page: 'deliveries', label: 'My deliveries', icon: '🚚', shell: true }],
};

export function navFor(role: AppRole): NavItem[] {
  return NAV_BY_ROLE[role] ?? [];
}

export function canAccessPage(role: AppRole, page: string): boolean {
  return navFor(role).some((n) => n.page === page);
}
