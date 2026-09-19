-- =====================================================================
-- 0039 — Restore security_invoker on the dashboard read model, and set it
--        on the analytics views for defence in depth.
--
-- PROVEN DEFECT (found by the post-apply verification of this release).
--
-- 0031 deliberately created v_dashboard_institutions
--
--     create or replace view v_dashboard_institutions
--     with (security_invoker = true) as ...
--
-- 0033 rebuilt the same view to fix the completion denominator and wrote
--
--     create or replace view v_dashboard_institutions as ...
--
-- omitting the WITH clause. CREATE OR REPLACE VIEW RESETS reloptions when the
-- clause is absent, so the option was silently dropped and the view reverted to
-- OWNER rights. Every base-table read inside it then executed as `postgres`,
-- bypassing both the grants and the RLS policies of whoever was asking.
--
-- `anon` holds SELECT on this view, so the exposure was UNAUTHENTICATED.
-- Reproduced before writing this migration:
--
--     set role anon; select * from institutions;
--       -> ERROR: permission denied for table institutions
--     set role anon; select name, classrooms, active_students
--                      from v_dashboard_institutions;
--       -> Al Noor Nursery        | 2 | 5
--          Sunshine Valley School | 2 | 4
--
-- i.e. every institution's name, classroom count and eligible-child headcount
-- was readable by anyone holding the public anon key. No child-level data was
-- reachable, but institution identity and headcount across every tenant was.
--
-- THE FIX
-- Restore what 0031 intended. With security_invoker the base-table reads run as
-- the CALLER, so RLS decides the rows: anon is refused outright, a School Admin
-- sees only their own institution, a Super Admin sees all.
--
-- The three analytics views are given the same option. They were never
-- exploitable — each selects from a SECURITY DEFINER *_impl() function that
-- checks auth.uid() itself, so an anonymous caller already got zero rows — but
-- as invoker views they now also require the caller to hold EXECUTE on that
-- function, which turns a silent empty result into an explicit refusal, and
-- clears the linter finding rather than leaving a standing ERROR that future
-- reviewers must re-triage.
--
-- No policy, grant, column or row is changed by this migration.
-- =====================================================================

alter view v_dashboard_institutions    set (security_invoker = true);
alter view v_meal_performance          set (security_invoker = true);
alter view v_meal_revision_performance set (security_invoker = true);
alter view v_production_demand         set (security_invoker = true);

comment on view v_dashboard_institutions is
  'Dashboard read model. SECURITY INVOKER: the base-table reads run as the '
  'caller so RLS scopes them. It carries no role test of its own, which is '
  'exactly why the invoker option is load-bearing here — 0033 dropped it by '
  'omitting the WITH clause on a CREATE OR REPLACE, and that exposed every '
  'institution name and headcount to the anon key.';
