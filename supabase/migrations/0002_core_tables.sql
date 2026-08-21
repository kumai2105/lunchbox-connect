-- 0002: core tables -----------------------------------------------------------------
-- Institution -> Student -> Eligibility -> Classroom Serving -> Parent Visibility

create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'school' check (kind in ('school', 'nursery', 'other')),
  created_at timestamptz not null default now()
);

create table app_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null,
  institution_id uuid references institutions (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  -- staff roles must be anchored to an institution; super_admin and parents are not.
  -- Written as valid boolean SQL ("A implies B"  ==  "NOT A OR B"). This constraint
  -- is reconciled to the final merged role set in 0038 after the role merge.
  constraint app_users_staff_needs_institution
    check (role not in ('school_admin', 'nurse', 'teacher') or institution_id is not null)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions (id) on delete cascade,
  name text not null,
  grade text,
  teacher_id uuid references app_users (user_id) on delete set null,
  active boolean not null default true,
  unique (institution_id, name)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  student_no text not null unique,                -- e.g. LBS-1023
  institution_id uuid not null references institutions (id) on delete cascade,
  given_name text not null,
  family_name text not null,
  class_id uuid references classes (id) on delete set null,
  grade text,
  enrollment_status enrollment_status not null default 'pending',
  medical_notes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_parents (
  student_id uuid not null references students (id) on delete cascade,
  user_id uuid not null references app_users (user_id) on delete cascade,
  primary key (user_id, student_id)
);

create table eligibility (
  student_id uuid primary key references students (id) on delete cascade,
  status eligibility_status not null default 'n/a',
  documents jsonb not null default '[]',          -- [{name, size, uploaded_at}] metadata only; file storage NOT_YET_DEFINED
  review_status review_status not null default 'pending_review',
  reviewed_by uuid references app_users (user_id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table menus (
  id uuid primary key default gen_random_uuid(),
  week_number int not null,
  weekday smallint not null check (weekday between 0 and 4), -- 0=Mon ... 4=Fri
  period app_period not null,
  dish_name text not null,
  allergens jsonb not null default '[]',
  published boolean not null default false,
  created_by uuid references app_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_number, weekday, period)
);

create table serving_records (
  id uuid primary key default gen_random_uuid(),
  serving_date date not null default current_date,
  class_id uuid references classes (id) on delete set null,
  student_id uuid not null references students (id) on delete cascade,
  period app_period not null,
  outcome meal_outcome not null,
  note text,
  recorded_by uuid not null references app_users (user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, serving_date, period)
);

create table serving_notes (
  id uuid primary key default gen_random_uuid(),
  serving_record_id uuid not null unique references serving_records (id) on delete cascade,
  body text not null,
  published_at timestamptz,                    -- null until published to families
  created_by uuid not null references app_users (user_id),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students (id) on delete set null,
  from_user uuid not null references app_users (user_id),
  to_institution_id uuid not null references institutions (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_students_institution on students (institution_id);
create index idx_students_class on students (class_id);
create index idx_student_parents_student on student_parents (student_id);
create index idx_classes_institution on classes (institution_id);
create index idx_serving_records_day on serving_records (serving_date, class_id, period);
create index idx_serving_records_student on serving_records (student_id, serving_date);
create index idx_eligibility_review on eligibility (review_status);
create index idx_menus_week on menus (week_number);
create index idx_messages_institution on messages (to_institution_id, created_at desc);

-- updated_at maintenance ------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();
create trigger trg_eligibility_updated before update on eligibility
  for each row execute function set_updated_at();
create trigger trg_menus_updated before update on menus
  for each row execute function set_updated_at();
create trigger trg_serving_records_updated before update on serving_records
  for each row execute function set_updated_at();