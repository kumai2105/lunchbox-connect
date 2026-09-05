-- 0014: Classroom meal tracking v2 — structured consumption, served status,
-- behavior, low-intake reason, concern flag, Meal traceability, Student photos
-- (docs/13 Decision 032). serving_records has 0 rows in production as of this
-- migration, so the old provisional `outcome`/`meal_outcome` column and type
-- are dropped outright rather than migrated — there is no data to preserve.

-- ---------------------------------------------------------------- structured outcome
drop view if exists v_serving_day;

alter table serving_records drop column if exists outcome;
drop type if exists meal_outcome;

create type meal_served_status as enum ('served', 'not_served');
create type eating_behavior as enum ('ate_independently', 'needed_encouragement', 'refused');
create type low_intake_reason as enum (
  'not_hungry', 'did_not_like_it', 'distracted', 'sleeping', 'absent', 'unwell', 'other'
);

alter table serving_records
  add column served_status meal_served_status not null default 'served',
  add column consumption_pct smallint,
  add column behavior eating_behavior,
  add column low_intake_reason low_intake_reason,
  add column concern_observed boolean not null default false,
  add column menu_item_id uuid references menus (id) on delete set null;

alter table serving_records
  add constraint serving_records_consumption_values
  check (consumption_pct is null or consumption_pct in (0, 25, 50, 75, 100));

-- served != not_served facts (docs/13 Decision 032 §11): a not-served meal
-- carries no consumption/behavior reading at all.
alter table serving_records
  add constraint serving_records_served_consumption
  check (
    served_status = 'served'
    or (consumption_pct is null and behavior is null)
  );

create index idx_serving_records_menu_item on serving_records (menu_item_id);

comment on column serving_records.served_status is
  'SERVED / NOT_SERVED (docs/13 Decision 032). NOT_SERVED never implies 0% consumed.';
comment on column serving_records.consumption_pct is
  'Structured consumption, only meaningful when served_status = served. One of 0/25/50/75/100.';
comment on column serving_records.low_intake_reason is
  'Relevant at low consumption (0/25%). ABSENT/UNWELL/SLEEPING/not-served must never count as '
  'Meal dislike in analytics (docs/13 Decision 032 §17, §42).';
comment on column serving_records.menu_item_id is
  'The specific Menu row this observation was recorded against — Meal traceability for analytics '
  '(docs/13 Decision 032), resolved by the app via the existing week/weekday/period Menu lookup.';

-- ---------------------------------------------------------------- record_serving_batch v2
create or replace function record_serving_batch(p_class uuid, p_rows jsonb, p_date date default current_date)
returns table (out_id uuid, out_student_id uuid)
language plpgsql
as $$
declare
  r jsonb;
  new_id uuid;
begin
  if jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into serving_records (
      class_id, student_id, period, recorded_by, serving_date,
      served_status, consumption_pct, behavior, low_intake_reason, concern_observed,
      menu_item_id, note
    )
    values (
      p_class,
      (r->>'student_id')::uuid,
      (r->>'period')::app_period,
      app_current_user_id(),
      p_date,
      coalesce((r->>'served_status')::meal_served_status, 'served'),
      nullif(r->>'consumption_pct', '')::smallint,
      nullif(r->>'behavior', '')::eating_behavior,
      nullif(r->>'low_intake_reason', '')::low_intake_reason,
      coalesce((r->>'concern_observed')::boolean, false),
      nullif(r->>'menu_item_id', '')::uuid,
      r->>'note'
    )
    on conflict (student_id, serving_date, period)
    do update set
      served_status = excluded.served_status,
      consumption_pct = excluded.consumption_pct,
      behavior = excluded.behavior,
      low_intake_reason = excluded.low_intake_reason,
      concern_observed = excluded.concern_observed,
      menu_item_id = excluded.menu_item_id,
      note = excluded.note,
      recorded_by = excluded.recorded_by,
      class_id = excluded.class_id,
      updated_at = now()
    returning id into new_id;

    out_id := new_id;
    out_student_id := (r->>'student_id')::uuid;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- v_serving_day v2
create or replace view v_serving_day
with (security_invoker = true) as
select
  sr.serving_date,
  sr.class_id,
  c.name as class_name,
  sr.period,
  count(*)::int as recorded,
  count(*) filter (where sr.served_status = 'served')::int as served_count,
  count(*) filter (where sr.served_status = 'not_served')::int as not_served_count,
  count(*) filter (where sr.behavior = 'refused')::int as refused_count,
  count(*) filter (where sr.behavior = 'needed_encouragement')::int as encouragement_count,
  count(*) filter (where sr.concern_observed)::int as concern_count,
  round(avg(sr.consumption_pct) filter (where sr.served_status = 'served'), 1) as avg_consumption_pct
from serving_records sr
join classes c on c.id = sr.class_id
group by sr.serving_date, sr.class_id, c.name, sr.period;

-- ---------------------------------------------------------------- meal performance (Super Admin only)
-- Excludes the non-preference population (absent/unwell/sleeping low-intake
-- reasons, and not-served rows) from consumption/preference stats, per the
-- valid-observation-population rule (docs/13 Decision 032 §42).
create or replace function v_meal_performance_impl()
returns table (
  menu_item_id uuid,
  dish_name text,
  week_number int,
  weekday smallint,
  period app_period,
  total_observations bigint,
  valid_observations bigint,
  avg_consumption_pct numeric,
  refusal_count bigint,
  encouragement_count bigint,
  did_not_like_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    m.id,
    m.dish_name,
    m.week_number,
    m.weekday,
    m.period,
    count(sr.id) as total_observations,
    count(sr.id) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ) as valid_observations,
    round(avg(sr.consumption_pct) filter (
      where sr.served_status = 'served'
        and coalesce(sr.low_intake_reason::text, '') not in ('absent', 'unwell', 'sleeping')
    ), 1) as avg_consumption_pct,
    count(sr.id) filter (where sr.behavior = 'refused') as refusal_count,
    count(sr.id) filter (where sr.behavior = 'needed_encouragement') as encouragement_count,
    count(sr.id) filter (where sr.low_intake_reason = 'did_not_like_it') as did_not_like_count
  from menus m
  join serving_records sr on sr.menu_item_id = m.id
  where exists (select 1 from app_users me where me.user_id = auth.uid() and me.role = 'super_admin')
  group by m.id, m.dish_name, m.week_number, m.weekday, m.period
$$;

create or replace view v_meal_performance
with (security_invoker = true) as
select * from v_meal_performance_impl();

grant select on v_meal_performance to authenticated;

-- ---------------------------------------------------------------- student photo
alter table students add column photo_path text;
comment on column students.photo_path is
  'Object path in the private student-photos storage bucket, not a public URL '
  '(docs/13 Decision 032 §6). Optional — never required to create a Student.';

-- Private bucket: students-photos objects are only reachable via signed URLs
-- issued after the same app_can_see_student() check RLS already enforces on
-- the students table itself.
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict (id) do nothing;

-- Path convention: <student_id>/<filename> — (storage.foldername(name))[1] is the student id.
create policy student_photos_select on storage.objects for select
  using (
    bucket_id = 'student-photos'
    and app_can_see_student((storage.foldername(name))[1]::uuid)
  );
create policy student_photos_write on storage.objects for insert
  with check (
    bucket_id = 'student-photos'
    and app_can_manage_student((storage.foldername(name))[1]::uuid)
  );
create policy student_photos_update on storage.objects for update
  using (
    bucket_id = 'student-photos'
    and app_can_manage_student((storage.foldername(name))[1]::uuid)
  );
create policy student_photos_delete on storage.objects for delete
  using (
    bucket_id = 'student-photos'
    and app_can_manage_student((storage.foldername(name))[1]::uuid)
  );
