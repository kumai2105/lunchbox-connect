import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  listMenu,
  myChildren,
  notesForServing,
  servingRangeForStudent,
  studentPhotoUrl,
} from '../../lib/api';
import type { MenuItem, ServingNote, ServingRecord, Student } from '../../lib/types';
import { Banner, EmptyState, Spinner } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { isoWeek, todayISO } from '../../lib/format';
import { ParentContext, type ParentCtx } from './context';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/parent', label: 'Home', icon: 'home', end: true },
  { to: '/parent/menu', label: 'Menu', icon: 'utensils' },
  { to: '/parent/insights', label: 'Insights', icon: 'barChart' },
  { to: '/parent/profile', label: 'Profile', icon: 'user' },
];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Parent portal shell (blueprint Parts 70-71). Mobile-first: bottom
 * navigation, no administrative chrome, and a child switcher that only ever
 * lists children this account holds an authorized Guardian relationship to —
 * there is no student search anywhere in this portal, and RLS enforces the
 * same boundary server-side.
 */
export default function ParentShell() {
  const [children, setChildren] = useState<Student[] | null>(null);
  const [childId, setChildId] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [records, setRecords] = useState<ServingRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, ServingNote>>({});
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const child = useMemo(
    () => (children ?? []).find((c) => c.id === childId) ?? (children ?? [])[0],
    [children, childId],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const kids = await myChildren();
      if (!active) return;
      if (kids.error) setError(kids.error);
      setChildren(kids.data ?? []);
      if ((kids.data ?? []).length > 0) setChildId((kids.data ?? [])[0].id);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function loadChild(id: string) {
    const [recs, menuRes, url] = await Promise.all([
      servingRangeForStudent(id, daysAgoISO(30), todayISO()),
      listMenu([isoWeek(new Date())]),
      studentPhotoUrl((children ?? []).find((c) => c.id === id)?.photo_path ?? null),
    ]);
    setError(recs.error ?? menuRes.error);
    const rows = recs.data ?? [];
    setRecords(rows);
    setMenu((menuRes.data ?? []).filter((m) => m.published));
    setPhotoUrl(url);

    // Free-text notes reach a parent ONLY once a reviewer has published them
    // (blueprint Part 66) — unpublished note bodies are filtered out here and
    // are not readable by this role at the database level either.
    const n = await notesForServing(rows.map((r) => r.id));
    const map: Record<string, ServingNote> = {};
    (n.data ?? []).filter((x) => x.published_at).forEach((x) => (map[x.serving_record_id] = x));
    setNotes(map);
  }

  useEffect(() => {
    if (!child) return;
    void loadChild(child.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  if (loading) return <Spinner />;

  if (!children || children.length === 0) {
    return (
      <div className="parent-shell">
        <div className="parent-body">
          {error && <Banner kind="err">{error}</Banner>}
          <EmptyState text="No children are linked to this account yet. Your nursery links your child to your account — there is no way to add a child yourself." />
        </div>
      </div>
    );
  }

  const ctx: ParentCtx = {
    child,
    children,
    photoUrl,
    records,
    notes,
    menu,
    reload: () => loadChild(child.id),
  };

  return (
    <ParentContext.Provider value={ctx}>
      <div className="parent-shell">
        {children.length > 1 && (
          <div className="child-switch">
            {children.map((c) => (
              <button
                key={c.id}
                className={`child-chip${c.id === child.id ? ' active' : ''}`}
                onClick={() => setChildId(c.id)}
              >
                {c.given_name}
              </button>
            ))}
          </div>
        )}

        <div className="parent-body">
          {error && <Banner kind="err">{error}</Banner>}
          <Outlet />
        </div>

        <nav className="parent-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `parent-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ParentContext.Provider>
  );
}
