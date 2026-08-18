import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navFor } from '../lib/roles';
import { initials } from '../lib/format';
import { Btn } from './ui';

// Every route in App.tsx needs an entry here, or its topbar silently falls
// back to showing "Dashboard" regardless of which page is actually open —
// that was true for half the routes (guardians/status/audit/kitchen/
// deliveries/reports/ops/absences) until this was filled in.
const PAGE_TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'LunchBox Connect /'],
  institutions: ['Institutions', 'LunchBox Connect /'],
  students: ['Students', 'LunchBox Connect /'],
  guardians: ['Parents / guardians', 'LunchBox Connect /'],
  classes: ['Classes', 'LunchBox Connect /'],
  status: ['Status / eligibility', 'LunchBox Connect /'],
  audit: ['Audit', 'LunchBox Connect /'],
  menu: ['4-week menu', 'LunchBox Connect /'],
  today: ['Today — serving', 'LunchBox Connect /'],
  kitchen: ['Kitchen production', 'LunchBox Connect /'],
  deliveries: ['Deliveries', 'LunchBox Connect /'],
  reports: ['Reporting', 'LunchBox Connect /'],
  ops: ['Ops log & issues', 'LunchBox Connect /'],
  absences: ['Absences', 'LunchBox Connect /'],
  users: ['Users & roles', 'LunchBox Connect /'],
  parent: ['Parent view', 'LunchBox Connect /'],
};

function todayChip(): string {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Today · ${day}`;
}

export default function Layout() {
  const { profile, session, signOut } = useAuth();
  const location = useLocation();
  const page = location.pathname.replace('/', '') || 'dashboard';
  const title = PAGE_TITLES[page] ?? ['Dashboard', 'LunchBox Connect /'];

  if (!session) return null;
  if (!profile) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="logo">
            <div className="logo-mark">LC</div>
            <div>
              <b>LunchBox Connect</b>
              <span className="sub">Child nutrition platform</span>
            </div>
          </div>
          <h1>Account not provisioned</h1>
          <p className="tagline">
            Your sign-in works, but this user has no app profile yet. Ask a SUPER_ADMIN to create
            your account.
          </p>
          <Btn variant="ghost" onClick={() => void signOut()} style={{ width: '100%' }}>
            Sign out
          </Btn>
        </div>
      </div>
    );
  }

  const role = profile.role;
  const nav = navFor(role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo white">
          <div className="logo-mark">LC</div>
          <div>
            <b>LunchBox</b>
            <span className="sub">Connect</span>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-group">Menu</div>
          {nav
            .filter((item) => !item.hidden)
            .map((item) => (
              <Link
                key={item.page}
                to={`/${item.page}`}
                className={page === item.page ? 'active' : ''}
              >
                <span className="nav-ico">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
        <div className="side-card">
          <b>Spec-driven</b>
          Undefined rules stay isolated in shells — never invented.
        </div>
        <div className="side-foot">
          <div className="avatar">{initials(profile.full_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="u-name">{profile.full_name}</div>
            <div className="u-role">{role}</div>
          </div>
          <button onClick={() => void signOut()}>Log out</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="title-block">
            <div className="crumb">{title[1]}</div>
            <h2>{title[0]}</h2>
          </div>
          <div className="spacer" />
          <span className="chip amber">{todayChip()}</span>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
