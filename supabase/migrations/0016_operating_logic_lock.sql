-- 0016_operating_logic_lock.sql
-- Decision 033 — Master Operating Logic Lock.
--
-- Establishes the operating chain the flat `menus` table could not express:
--   Meal -> Meal revision -> Rotation -> Calendar -> Service Plan -> Meal Service
--
-- The legacy `menus` table is intentionally LEFT IN PLACE and untouched. It
-- still backs the existing 4-week menu screen and the serving_records.
-- menu_item_id traceability column, and it holds real seeded data. This
-- migration is additive: nothing that already works is destroyed (Part 123).

-- ---------------------------------------------------------------- meal library
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable content snapshots. Editing a Meal appends a revision; it never
-- rewrites one. This is what makes January history stay January truth even
-- after the recipe improves in March (Decision 033).
create table if not exists meal_revisions (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals (id) on delete cascade,
  revision_no int not null,
  name text not null,
  ingredients jsonb not null default '[]',
  allergens jsonb not null default '[]',
  nutrition jsonb not null default '{}',
  portion text,
  image_path text,
  -- Nutrition provenance stays explicit (Decision 023): draft reference data
  -- must never present as clinically approved truth.
  nutrition_status text not null default 'NOT_APPROVED',
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (meal_id, revision_no)
);

alter table meals
  add column if not exists current_revision_id uuid references meal_revisions (id);

create index if not exists meal_revisions_meal_idx on meal_revisions (meal_id, revision_no desc);

-- ---------------------------------------------------------------- rotation
-- week_count is data-driven. Four weeks is the current business reference,
-- never a hard-coded ceiling (Decision 033 / Part 8).
create table if not exists rotations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  week_count int not null default 4 check (week_count between 1 and 52),
  active boolean not null default true,
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- weekday 0..6 (Mon..Sun). Deliberately NOT restricted to 0..4: service
-- weekdays must not be globally assumed (Part 17).
create table if not exists rotation_slots (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null references rotations (id) on delete cascade,
  week_number int not null check (week_number >= 1),
  weekday smallint not null check (weekday between 0 and 6),
  period app_period not null,
  meal_id uuid references meals (id) on delete set null,
  unique (rotation_id, week_number, weekday, period)
);

create index if not exists rotation_slots_lookup_idx
  on rotation_slots (rotation_id, week_number, weekday, period);

-- ------------------------------------------------- institution service plan
-- Which Meal periods an Institution actually receives, effective-dated so a
-- plan change never rewrites historical coverage (Part 26).
create table if not exists institution_service_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  periods app_period[] not null check (array_length(periods, 1) >= 1),
  effective_from date not null,
  effective_to date,
  note text,
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists service_plans_lookup_idx
  on institution_service_plans (institution_id, effective_from desc);

-- --------------------------------------------- institution rotation anchor
-- anchor_week is the rotation week that `effective_from`'s ISO week maps to.
-- Rotation position is therefore derived from the calendar, never from
-- counting how many days actually had service (Part 16/21).
create table if not exists institution_rotation_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  rotation_id uuid not null references rotations (id) on delete restrict,
  effective_from date not null,
  effective_to date,
  anchor_week int not null default 1 check (anchor_week >= 1),
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists rotation_assignments_lookup_idx
  on institution_rotation_assignments (institution_id, effective_from desc);

-- ---------------------------------------------------------- calendar exceptions
do $$ begin
  create type calendar_exception_kind as enum ('closure', 'override', 'special_period');
exception when duplicate_object then null; end $$;

create table if not exists calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  kind calendar_exception_kind not null,
  date_from date not null,
  date_to date not null,
  -- null period = applies to every period on those dates
  period app_period,
  -- override -> the meal to serve instead
  meal_id uuid references meals (id) on delete set null,
  -- special_period -> the rotation that applies for the range
  rotation_id uuid references rotations (id) on delete set null,
  reason text,
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_to >= date_from),
  check (kind <> 'override' or meal_id is not null),
  check (kind <> 'special_period' or rotation_id is not null)
);

create index if not exists calendar_exceptions_lookup_idx
  on calendar_exceptions (institution_id, date_from, date_to);

-- --------------------------------------------------------------- meal service
-- The resolved dated fact every downstream domain shares. Production, Kitchen,
-- Classroom, Parent and Analytics all read THIS row rather than each
-- re-deriving what was served (Part 30).
create table if not exists meal_services (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  service_date date not null,
  period app_period not null,
  -- Version-locked: republishing or later editing the Meal does not rewrite
  -- an already-resolved service (Part 7).
  meal_revision_id uuid references meal_revisions (id) on delete restrict,
  source calendar_exception_kind,          -- null => resolved from normal rotation
  rotation_id uuid references rotations (id) on delete set null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, service_date, period)
);

create index if not exists meal_services_date_idx
  on meal_services (institution_id, service_date, period);

-- Ties an observation to the exact dated service (and therefore the exact meal
-- revision) rather than to loose text (Part 65). Nullable: existing records
-- predate this and keep their menu_item_id traceability.
alter table serving_records
  add column if not exists meal_service_id uuid references meal_services (id) on delete set null;

create index if not exists serving_records_meal_service_idx
  on serving_records (meal_service_id);

-- ------------------------------------------------------------------ triggers
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists meals_touch on meals;
create trigger meals_touch before update on meals
  for each row execute function touch_updated_at();

drop trigger if exists rotations_touch on rotations;
create trigger rotations_touch before update on rotations
  for each row execute function touch_updated_at();

drop trigger if exists meal_services_touch on meal_services;
create trigger meal_services_touch before update on meal_services
  for each row execute function touch_updated_at();

-- =================================================================== RLS
alter table meals enable row level security;
alter table meal_revisions enable row level security;
alter table rotations enable row level security;
alter table rotation_slots enable row level security;
alter table institution_service_plans enable row level security;
alter table institution_rotation_assignments enable row level security;
alter table calendar_exceptions enable row level security;
alter table meal_services enable row level security;

grant select on meals, meal_revisions, rotations, rotation_slots,
  institution_service_plans, institution_rotation_assignments,
  calendar_exceptions, meal_services to authenticated;
grant insert, update, delete on meals, meal_revisions, rotations, rotation_slots,
  institution_service_plans, institution_rotation_assignments,
  calendar_exceptions, meal_services to authenticated;

-- Meal Library: readable by every authenticated user (a parent must be able to
-- see what their child was served; the kitchen must see what to cook). Only
-- Super Admin may create or change it (Part 72/95/96 — nurseries and kitchens
-- do not maintain their own menu).
drop policy if exists meals_select on meals;
create policy meals_select on meals for select using (true);
drop policy if exists meals_write on meals;
create policy meals_write on meals for all
  using (app_is_super_admin()) with check (app_is_super_admin());

drop policy if exists meal_revisions_select on meal_revisions;
create policy meal_revisions_select on meal_revisions for select using (true);
-- Revisions are append-only: no UPDATE or DELETE policy exists at all, so
-- historical content cannot be rewritten even by a Super Admin (Decision 033).
drop policy if exists meal_revisions_insert on meal_revisions;
create policy meal_revisions_insert on meal_revisions for insert
  with check (app_is_super_admin());

drop policy if exists rotations_select on rotations;
create policy rotations_select on rotations for select using (true);
drop policy if exists rotations_write on rotations;
create policy rotations_write on rotations for all
  using (app_is_super_admin()) with check (app_is_super_admin());

drop policy if exists rotation_slots_select on rotation_slots;
create policy rotation_slots_select on rotation_slots for select using (true);
drop policy if exists rotation_slots_write on rotation_slots;
create policy rotation_slots_write on rotation_slots for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- Service plans / rotation assignments: an institution may READ its own
-- configuration but never change its contracted coverage (Part 29).
drop policy if exists service_plans_select on institution_service_plans;
create policy service_plans_select on institution_service_plans for select
  using (app_can_see_institution(institution_id));
drop policy if exists service_plans_write on institution_service_plans;
create policy service_plans_write on institution_service_plans for all
  using (app_is_super_admin()) with check (app_is_super_admin());

drop policy if exists rotation_assign_select on institution_rotation_assignments;
create policy rotation_assign_select on institution_rotation_assignments for select
  using (app_can_see_institution(institution_id));
drop policy if exists rotation_assign_write on institution_rotation_assignments;
create policy rotation_assign_write on institution_rotation_assignments for all
  using (app_is_super_admin()) with check (app_is_super_admin());

drop policy if exists calendar_exceptions_select on calendar_exceptions;
create policy calendar_exceptions_select on calendar_exceptions for select
  using (app_can_see_institution(institution_id));
drop policy if exists calendar_exceptions_write on calendar_exceptions;
create policy calendar_exceptions_write on calendar_exceptions for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- Meal services: Super Admin sees everything including drafts. Everyone else
-- sees only PUBLISHED services for an institution they are entitled to, which
-- is what keeps an unfinished draft menu away from parents, kitchen, nursery
-- and classroom (Part 31/70).
drop policy if exists meal_services_select on meal_services;
create policy meal_services_select on meal_services for select
  using (
    app_is_super_admin()
    or (
      published
      and (
        app_can_see_institution(institution_id)
        or app_is_kitchen()
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = meal_services.institution_id
            and sp.user_id = auth.uid()
        )
      )
    )
  );
drop policy if exists meal_services_write on meal_services;
create policy meal_services_write on meal_services for all
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ====================================================== calendar resolution
-- Returns which rotation week applies to a real date for an institution, or
-- NULL when no assignment covers it. Position is computed from whole ISO weeks
-- elapsed since the assignment's effective_from, so a closure never shifts the
-- rotation (Part 16/21).
create or replace function resolve_rotation_week(p_inst uuid, p_date date)
returns table (rotation_id uuid, week_number int)
language sql stable security definer set search_path = public as $$
  with a as (
    select ira.rotation_id, ira.effective_from, ira.anchor_week, r.week_count
    from institution_rotation_assignments ira
    join rotations r on r.id = ira.rotation_id
    where ira.institution_id = p_inst
      and ira.effective_from <= p_date
      and (ira.effective_to is null or ira.effective_to >= p_date)
    order by ira.effective_from desc
    limit 1
  )
  select a.rotation_id,
         (((a.anchor_week - 1)
           + (floor(
               extract(epoch from (date_trunc('week', p_date::timestamp)
                                   - date_trunc('week', a.effective_from::timestamp)))
               / 604800
             ))::int
          ) % a.week_count) + 1
  from a;
$$;

-- Does this institution receive this period on this date?
create or replace function service_plan_includes(p_inst uuid, p_date date, p_period app_period)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p_period = any (sp.periods)
     from institution_service_plans sp
     where sp.institution_id = p_inst
       and sp.effective_from <= p_date
       and (sp.effective_to is null or sp.effective_to >= p_date)
     order by sp.effective_from desc
     limit 1),
    false  -- no plan on file => the institution receives nothing. Never assume coverage.
  );
$$;

-- Resolves what SHOULD be served, applying the Decision 033 precedence in
-- order: closure > date override > special period > normal rotation > nothing.
-- Returns zero rows when nothing applies — it never fabricates a meal.
create or replace function resolve_meal(p_inst uuid, p_date date, p_period app_period)
returns table (meal_id uuid, source calendar_exception_kind, rotation_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_closed boolean;
  v_override_meal uuid;
  v_special_rotation uuid;
  v_rot record;
  v_weekday smallint;
begin
  -- 0. The institution must actually receive this period at all.
  if not service_plan_includes(p_inst, p_date, p_period) then
    return;
  end if;

  -- 1. Explicit closure wins over everything.
  select true into v_closed from calendar_exceptions ce
   where ce.institution_id = p_inst and ce.kind = 'closure'
     and p_date between ce.date_from and ce.date_to
     and (ce.period is null or ce.period = p_period)
   limit 1;
  if v_closed then return; end if;

  -- 2. Explicit date-specific override.
  select ce.meal_id into v_override_meal from calendar_exceptions ce
   where ce.institution_id = p_inst and ce.kind = 'override'
     and p_date between ce.date_from and ce.date_to
     and (ce.period is null or ce.period = p_period)
   order by ce.created_at desc limit 1;
  if v_override_meal is not null then
    return query select v_override_meal, 'override'::calendar_exception_kind, null::uuid;
    return;
  end if;

  v_weekday := (extract(isodow from p_date)::int - 1)::smallint;  -- 0=Mon..6=Sun

  -- 3. Special period / camp rotation for the range.
  select ce.rotation_id into v_special_rotation from calendar_exceptions ce
   where ce.institution_id = p_inst and ce.kind = 'special_period'
     and p_date between ce.date_from and ce.date_to
   order by ce.created_at desc limit 1;
  if v_special_rotation is not null then
    return query
      select rs.meal_id, 'special_period'::calendar_exception_kind, rs.rotation_id
      from rotation_slots rs
      where rs.rotation_id = v_special_rotation
        and rs.weekday = v_weekday
        and rs.period = p_period
        and rs.meal_id is not null
      limit 1;
    return;
  end if;

  -- 4. Normal active rotation assignment.
  select * into v_rot from resolve_rotation_week(p_inst, p_date);
  if v_rot.rotation_id is null then return; end if;

  return query
    select rs.meal_id, null::calendar_exception_kind, rs.rotation_id
    from rotation_slots rs
    where rs.rotation_id = v_rot.rotation_id
      and rs.week_number = v_rot.week_number
      and rs.weekday = v_weekday
      and rs.period = p_period
      and rs.meal_id is not null
    limit 1;

  -- 5. Nothing applicable -> zero rows. No meal is fabricated.
end $$;

-- Materializes resolved services for a date range and marks them operational.
-- Already-published rows are left untouched so republishing can never rewrite
-- history or swap the meal revision under a service that already happened
-- (Part 7/33).
create or replace function publish_meal_services(p_inst uuid, p_from date, p_to date)
returns int
language plpgsql security definer set search_path = public as $$
declare
  d date;
  p app_period;
  r record;
  v_rev uuid;
  n int := 0;
begin
  if not app_is_super_admin() then
    raise exception 'Only a Super Admin may publish a schedule';
  end if;

  d := p_from;
  while d <= p_to loop
    foreach p in array array['breakfast','snack','lunch','afternoon_snack']::app_period[] loop
      select * into r from resolve_meal(p_inst, d, p);
      if r.meal_id is not null then
        select m.current_revision_id into v_rev from meals m where m.id = r.meal_id;
        if v_rev is not null then
          insert into meal_services (
            institution_id, service_date, period, meal_revision_id,
            source, rotation_id, published, published_at
          )
          values (p_inst, d, p, v_rev, r.source, r.rotation_id, true, now())
          on conflict (institution_id, service_date, period) do update
            set meal_revision_id = case
                  when meal_services.published then meal_services.meal_revision_id
                  else excluded.meal_revision_id end,
                source = case
                  when meal_services.published then meal_services.source
                  else excluded.source end,
                rotation_id = case
                  when meal_services.published then meal_services.rotation_id
                  else excluded.rotation_id end,
                published = true,
                published_at = coalesce(meal_services.published_at, now());
          n := n + 1;
        end if;
      end if;
    end loop;
    d := d + 1;
  end loop;
  return n;
end $$;

grant execute on function resolve_rotation_week(uuid, date) to authenticated;
grant execute on function service_plan_includes(uuid, date, app_period) to authenticated;
grant execute on function resolve_meal(uuid, date, app_period) to authenticated;
grant execute on function publish_meal_services(uuid, date, date) to authenticated;

comment on table meals is 'Meal Library — reusable food items (Decision 033).';
comment on table meal_revisions is 'Immutable Meal content snapshots. Append-only: no update/delete policy exists.';
comment on table rotations is 'Reusable Meal arrangement; week_count is data-driven, never fixed at 4.';
comment on table meal_services is 'Resolved dated service: the shared anchor for production, classroom, parent and analytics.';
