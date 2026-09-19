-- =====================================================================
-- Local / CI stack ONLY — never runs against a hosted project.
--
-- `supabase start` and `supabase db reset` execute this file after the
-- migrations. `supabase db push` does NOT. So nothing here can reach
-- production, by construction.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The migrations never GRANT anything to `service_role`. They express the
-- CLIENT boundary explicitly — narrow grants to `authenticated`, targeted
-- revokes from `anon` — and rely on the platform's default privileges in
-- `public` for the trusted server-side role. Hosted Supabase installs those
-- defaults, so production works. `tests/sql/00_supabase_shim.sql` replicates
-- them, so the local PostgreSQL harness works. The CLI's local stack does not,
-- so every service-role write failed there:
--
--     [e2e] fixture step failed — create E2E Nursery:
--       permission denied for table institutions
--
-- Reproduced locally by rebuilding the schema with the shim's
-- `alter default privileges` block removed, which is exactly the CLI stack's
-- situation. The result on public.institutions:
--
--     authenticated | SELECT          <- only what 0007 explicitly grants
--     postgres      | ALL
--     service_role  | (absent entirely)
--
-- WHY ONLY service_role
-- ---------------------
-- `service_role` is the trusted server-side identity: it is never exposed to a
-- browser, and hosted Supabase already grants it everything. Restoring that one
-- role restores parity with production.
--
-- `anon` and `authenticated` are deliberately NOT touched. Their privileges are
-- what the migrations say they are, and that is the boundary the E2E suite
-- exists to test. Granting broadly here would run AFTER the migrations' own
-- REVOKEs and silently undo them — turning rls.spec.ts green against a database
-- that is more permissive than production. A test that passes because the
-- boundary was widened underneath it is worse than no test.
--
-- Verified before this file was written: with these grants applied, a
-- service-role INSERT into `institutions` succeeds, and `authenticated` still
-- holds SELECT and nothing more on that table.
-- =====================================================================

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Anything created after this file runs (none today, but keep the stack
-- self-consistent if that changes) inherits the same server-side access.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
