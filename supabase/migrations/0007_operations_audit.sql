-- 0007: operational hardening & RLS audit --------------------------------------

-- Explicit grants for the authenticated role on core tables (belt and braces;
-- RLS still enforces every row).
grant select, insert, update, delete on students, classes, eligibility, serving_records,
      serving_notes, menus, messages, student_parents to authenticated;
grant select on institutions, app_users to authenticated;
grant usage on sequence serving_records_id_seq to authenticated;

-- RLS audit view: a live checklist of which tables enforce RLS and how.
create or replace view v_rls_audit
with (security_invoker = true) as
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  count(p.policyname)::int as policy_count
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;

comment on table institutions is 'Schools and nurseries in the chain.';
comment on table app_users is 'Operator users, including the role every boundary is checked against.';
comment on table students is 'Enrolled children, one institution, optional class.';
comment on table eligibility is 'Free/reduced/paid determination workflow.';
comment on table menus is 'Central 4-week menu grid (super admin edits, all read).';
comment on table serving_records is 'Daily outcome per student per period.';
comment on table serving_notes is 'Notes on a serving; families see only published rows.';
comment on table messages is 'Parent -> institution staff inbox.';