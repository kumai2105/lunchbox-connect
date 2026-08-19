-- =====================================================================
-- 05_revert_unapproved_changes.sql — UNDO the unapproved business changes
-- that the withdrawn apply_to_production.sql already committed to prod.
--
-- It returns the two institutions to an UNCONFIGURED state so their real
-- rotation assignment and service plan can be set explicitly via 03, and
-- their calendar published explicitly via 04. It does NOT delete the meal
-- library or the rotation template (those are legitimate legacy-menu data)
-- and it does NOT touch the security fix (01).
--
-- THREE destructive statements, each explained. Each is guarded so it can
-- never destroy real operational history.
--
-- ── TRANSACTION SAFETY ── does NOT commit. Review the before/after
--    notices, then `commit;` in psql (Supabase editor auto-commits — use
--    psql for a real checkpoint).
-- =====================================================================
begin;

do $before$
begin
  raise notice 'BEFORE  service_plans=%, rotation_assignments=%, published_services=%, drafts=%',
    (select count(*) from institution_service_plans),
    (select count(*) from institution_rotation_assignments),
    (select count(*) from meal_services where published),
    (select count(*) from meal_services where not published);
end $before$;

-- --------------------------------------------------------------------
-- DESTRUCTIVE #1 — delete speculatively-published Meal Services.
--
-- The withdrawn script published ~2056 services with no approved calendar
-- context. Remove them so publication becomes an explicit act (04).
--
-- SAFETY: only rows that NO serving_record references are deleted. The FK
-- is ON DELETE SET NULL, so deleting a referenced service would silently
-- null a real observation's meal link — we refuse to do that. Any such
-- service is KEPT and reported.
-- --------------------------------------------------------------------
with deletable as (
  select ms.id from meal_services ms
  where not exists (select 1 from serving_records sr where sr.meal_service_id = ms.id)
)
delete from meal_services where id in (select id from deletable);
do $d1$
declare kept int;
begin
  select count(*) into kept from meal_services;   -- whatever survived is referenced by history
  raise notice 'DELETED unreferenced services. Services still present (referenced by observations, kept): %', kept;
end $d1$;

-- --------------------------------------------------------------------
-- DESTRUCTIVE #2 — delete inferred Institution Service Plans.
--
-- The withdrawn script rebuilt every plan from the master menu's periods.
-- Service Plans are contracted agreements and must not be menu-derived, so
-- these inferred rows are removed. Institutions are left with NO plan until
-- 03 sets the real one (an institution with no plan resolves no meals —
-- correct, not broken). Nothing FKs to this table, so no cascade risk.
-- --------------------------------------------------------------------
delete from institution_service_plans;
do $d2$ begin
  raise notice 'DELETED all service plans (were menu-inferred). Institutions now await explicit config (03).';
end $d2$;

-- --------------------------------------------------------------------
-- DESTRUCTIVE #3 — delete auto-created Rotation Assignments.
--
-- The withdrawn script assigned one rotation to every institution without
-- an approved assignment. Remove those so the assignment is made explicitly
-- (03). Nothing FKs to this table. The rotation TEMPLATE and meal library
-- are NOT deleted — only the unapproved institution↔rotation links.
-- --------------------------------------------------------------------
delete from institution_rotation_assignments;
do $d3$ begin
  raise notice 'DELETED all rotation assignments (were auto-assigned). Assign explicitly via 03.';
end $d3$;

do $after$
begin
  raise notice 'AFTER   service_plans=%, rotation_assignments=%, published_services=%, drafts=%',
    (select count(*) from institution_service_plans),
    (select count(*) from institution_rotation_assignments),
    (select count(*) from meal_services where published),
    (select count(*) from meal_services where not published);
  raise notice 'Meal library and rotation template are preserved: meals=%, rotations=%, slots=%',
    (select count(*) from meals), (select count(*) from rotations), (select count(*) from rotation_slots);
  raise notice 'serving_records preserved: %', (select count(*) from serving_records);
  raise notice 'Review the before/after above, then:  commit;  (or rollback;)';
end $after$;
-- NO commit here on purpose.
