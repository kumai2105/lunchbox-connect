-- Local emulation of the Supabase-managed baseline that migrations 0001-0016
-- assume already exists. Nothing here is application logic; it exists only so
-- the real migrations can be applied verbatim against a stock PostgreSQL 16.
create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin; end if;
end $$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_app_meta_data jsonb default '{}',
  raw_user_meta_data jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text, provider_id text, identity_data jsonb default '{}'
);

-- Mirrors Supabase's auth.uid(): reads the sub claim off the request JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', current_user);
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant all on all tables in schema auth, storage to authenticated, anon, service_role;

-- Supabase grants blanket table privileges to anon/authenticated/service_role
-- and relies on RLS as the ONLY authorization boundary. Without this, a local
-- rebuild refuses writes with insufficient_privilege (a GRANT refusal) instead
-- of the row-level policy refusal production actually produces — which would
-- make every negative test here pass for the wrong reason.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
