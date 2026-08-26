import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { navFor, navPath, resourceForPath } from '../lib/roles';
import { Btn, Spinner } from './ui';
import logoUrl from '../assets/lunchbox-connect-logo.png';
import { Icon } from './icons';
import { formatOperationalDate, initials } from '../lib/format';
import { roleLabel } from '../lib/roleLabel';
import NoAccessPage from '../pages/NoAccessPage';

// Every route in App.tsx needs an entry here, or its topbar silently falls
// back to showing "Dashboard" regardless of which page is actually open —
// that was true for half the routes (guardians/status/audit/kitchen/
// reports/ops/absences) until this was filled in.
const PAGE_TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'LunchBox Connect /'],
  institutions: ['Institutions', 'LunchBox Connect /'],
  students: ['Students', 'LunchBox Connect /'],
  guardians: ['Parents / guardians', 'LunchBox Connect /'],
  schedule: ['Published menu', 'LunchBox Connect /'],
  classes: ['Classes', 'LunchBox Connect /'],
  staff: ['Staff', 'LunchBox Connect /'],
  status: ['Status / eligibility', 'LunchBox Connect /'],
  audit: ['Audit', 'LunchBox Connect /'],
  meals: ['Meal Library', 'LunchBox Connect /'],
  menubuilder: ['Menu Builder', 'LunchBox Connect /'],
  analytics: ['Meal analytics', 'LunchBox Connect /'],
  review: ['Parent-safe updates', 'LunchBox Connect /'],
  today: ['Today — serving', 'LunchBox Connect /'],
  kitchen: ['Kitchen production', 'LunchBox Connect /'],
  reports: ['Reporting', 'LunchBox Connect /'],
  ops: ['Ops log & issues', 'LunchBox Connect /'],
  absences: ['Absences', 'LunchBox Connect /'],
  users: ['Users & roles', 'LunchBox Connect /'],
  account: ['Your account', 'LunchBox Connect /'],
  parent: ['Parent view', 'LunchBox Connect /'],
};

function todayChip(): string {
  // "Today" here means the OPERATIONAL day the records are filed under, so it
  // is rendered in the operational timezone, not the device's.
  const day = formatOperationalDate(new Date(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Today · ${day}`;
}

export default function Layout() {
  const { profile, session, loading, authError, signOut } = useAuth();
  const location = useLocation();
  // First path segment only — nested detail routes (/students/:id,
  // /institutions/:id) must still resolve to their section's title and keep
  // that section highlighted in the sidebar.
  // …then translated from URL segment to RBAC resource, because the two are
  // not always the same word (`/menu-builder` is the `menubuilder` resource).
  const segment = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const page = resourceForPath(segment);
  const title = PAGE_TITLES[page] ?? ['Dashboard', 'LunchBox Connect /'];

  // Every authenticated route is nested inside this Layout, so its <Outlet/> —
  // and therefore the per-route <Guard> — only mounts if Layout renders. It
  // previously returned null while unauthenticated, which meant the Guard never
  // ran, the redirect never fired, and a logged-out user opening a bookmarked
  // /dashboard link saw a permanently blank page. Layout owns the redirect now.
  if (loading) {
    return (
      <div className="auth-wrap">
        <Spinner />
      </div>
    );
  }
  if (authError && !session) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Can't reach the service</h1>
          <p className="tagline">{authError}</p>
          <Btn variant="brand" onClick={() => window.location.reload()} style={{ width: '100%' }}>
            Try again
          </Btn>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  // A settled session with no profile: deactivated, or never provisioned. One
  // screen says so for the whole product rather than this shell carrying its
  // own slightly different wording (§9).
  if (!profile) return <NoAccessPage />;

  const role = profile.role;
  const nav = navFor(role);

  // The Parent portal is a different product surface, not a narrow version of
  // the admin one (blueprint Parts 4/70): no sidebar, no operational chrome,
  // its own bottom navigation. ParentShell renders that chrome itself.
  if (role === 'parent') {
    return (
      <div className="parent-root">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* The official logo, at every width. The supplied artwork is on
            white and its own outline is navy, so against the navy rail it gets
            the smallest white plate that separates it; the logo is never
            recoloured. On the 64px rail it shrinks to 48px rather than being
            swapped for a lettered placeholder (styles.css). */}
        <div className="side-brand">
          <img className="brand-logo" src={logoUrl} alt="LunchBox Connect" />
        </div>
        <nav className="nav">
          <div className="nav-group">Menu</div>
          {nav
            .filter((item) => !item.hidden)
            .map((item) => (
              <Link
                key={item.page}
                to={`/${navPath(item)}`}
                className={page === item.page ? 'active' : ''}
              >
                <span className="nav-ico">
                  <Icon name={item.icon} size={17} />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
        <div className="side-card">
          <b>{todayChip()}</b>
          Meals are recorded against the Gulf Standard Time day, wherever you are signed in from.
        </div>
        <div className="side-foot">
          {/* Your own name is where people look for their own settings, so it
              is the link to them. The role is shown through roleLabel() — the
              raw stored value said "school_admin" to a nursery manager. */}
          <Link className="side-foot-me" to="/account">
            <div className="avatar">{initials(profile.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="u-name">{profile.full_name}</div>
              <div className="u-role">{roleLabel(role)}</div>
            </div>
          </Link>
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
