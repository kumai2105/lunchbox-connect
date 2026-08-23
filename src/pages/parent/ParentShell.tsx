import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  mealsForDates,
  myChildren,
  notesForServing,
  servingRangeForStudent,
  studentPhotoUrl,
} from '../../lib/api';
import type { ServingNote, ServingRecord, Student } from '../../lib/types';
import type { DayMeal } from '../../lib/api';
import { Banner, EmptyState, Spinner } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { operationalDaysAgoISO, todayISO, weekEndISO } from '../../lib/format';
import { ParentContext, type ParentCtx } from './context';
import { childDataReady, createRequestGuard } from './shared';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/parent', label: 'Home', icon: 'home', end: true },
  { to: '/parent/menu', label: 'Menu', icon: 'utensils' },
  { to: '/parent/insights', label: 'Insights', icon: 'barChart' },
  { to: '/parent/profile', label: 'Profile', icon: 'user' },
];

const daysAgoISO = operationalDaysAgoISO;

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
  const [meals, setMeals] = useState<DayMeal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // WHICH child the currently loaded dataset belongs to. Readiness is derived
  // by comparing this against the selected child, so the immediate selection
  // render — which happens before any effect runs — already knows the data on
  // hand belongs to somebody else, and renders none of it.
  const [loadedChildId, setLoadedChildId] = useState<string | null>(null);
  // Discards responses belonging to a child who is no longer selected: without
  // it a slow request for child A could land after child B's and overwrite it.
  const guard = useRef(createRequestGuard()).current;

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
    const token = guard.next();
    const kid = (children ?? []).find((c) => c.id === id);
    // Drop the outgoing child's data and mark nothing as loaded. Belt and
    // braces alongside the derived readiness check below.
    setLoadedChildId(null);
    setRecords([]);
    setNotes({});
    setMeals([]);
    setPhotoUrl(null);
    // Meals are read for THIS child's institution as dated rows, over a range
    // wide enough for every screen that consumes them: Insights looks back 30
    // days, the Menu screen forward to the end of this week. Fetching once
    // here keeps all three screens reading the SAME rows, so they cannot
    // disagree about what was served. The previous call asked for a global ISO-week
    // number, which is institution-agnostic and, because the helper divided
    // by seven twice, only changed every seventh week.
    const [recs, mealRes, url] = await Promise.all([
      servingRangeForStudent(id, daysAgoISO(30), todayISO()),
      kid
        ? mealsForDates(daysAgoISO(30), weekEndISO(), kid.institution_id)
        : Promise.resolve({ data: [] as DayMeal[], error: null }),
      studentPhotoUrl(kid?.photo_path ?? null),
    ]);
    if (!guard.isCurrent(token)) return; // a newer child was selected meanwhile
    setError(recs.error ?? mealRes.error);
    const rows = recs.data ?? [];
    setRecords(rows);
    setMeals(mealRes.data ?? []);
    setPhotoUrl(url);

    // Free-text notes reach a parent ONLY once a reviewer has published them
    // (blueprint Part 66) — unpublished note bodies are filtered out here and
    // are not readable by this role at the database level either.
    const n = await notesForServing(rows.map((r) => r.id));
    if (!guard.isCurrent(token)) return;
    const map: Record<string, ServingNote> = {};
    (n.data ?? []).filter((x) => x.published_at).forEach((x) => (map[x.serving_record_id] = x));
    setNotes(map);
    // Only NOW does this dataset belong to `id` — and only now may the screens
    // render it.
    setLoadedChildId(id);
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
          <EmptyState text="No children are linked to this account yet. Your child's nursery or school links them to your account — there is no way to add a child yourself." />
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
    meals,
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
          {/* The screens render ONLY when the loaded dataset belongs to the
              selected child. On the selection render those ids differ, so
              child A's records can never appear under child B's name. */}
          {childDataReady(loadedChildId, child?.id) ? <Outlet /> : <Spinner />}
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
