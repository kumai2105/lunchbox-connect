-- 0038: role model alignment, STEP 2 of 2 — data merge + constraint ----------
-- Historically this was `0008b_role_merge.sql`, the second half of 0008. It has
-- to be a separate file because Postgres will not let a transaction USE an enum
-- value that the same transaction added, so the merge cannot live inside 0008.
--
-- WHY IT IS NOW NUMBERED 0038
-- ---------------------------
-- The Supabase CLI SILENTLY SKIPPED the old name:
--
--     Skipping migration 0008b_role_merge.sql...
--       (file name must match pattern "<timestamp>_name.sql")
--
-- The version prefix must be digits only; the `b` disqualified the file. So
-- `supabase start` and `supabase db push` built environments from 37 of the 38
-- migrations this repository ships, while `tests/sql/run_verification.sh` —
-- which globs the directory and applies every file verbatim — applied all 38.
-- Every suite therefore verified a schema the project's own deployment tooling
-- would never produce. The skip is a NOTICE, not an error: nothing failed, and
-- nothing said so.
--
-- The obvious repair, `00081_`, is WRONG. Sorting is lexicographic over the
-- whole filename, and a digit sorts before `_` ('1' = 0x31, '_' = 0x5F), so
-- `00081_role_merge.sql` lands BEFORE `0008_role_model_alignment.sql` — running
-- the merge before the enum value it depends on exists. Every `0008N_` name has
-- that defect. Numbering it last sidesteps the trap: 0038 follows 0037 under
-- lexicographic ordering AND under numeric ordering, so it does not matter
-- which one the tool applies.
--
-- Running last is safe because both statements below are no-ops by then:
--   * the UPDATE matches nothing — a fresh database has no app_users rows at
--     migration time, and production merged these roles on 2026-08-18;
--   * the constraint is re-added BYTE-FOR-BYTE IDENTICALLY by
--     0013_kitchen_entity.sql, so the resulting check is the same either way.
-- Both statements are idempotent, so re-application changes nothing.
--
-- Production consequence, stated plainly: production's ledger holds this file
-- under its old identity (version 20260818121633, name `0008b_role_merge`).
-- Under the new name the version is `0038`, which production has not seen, so a
-- push applies it once more. By the reasoning above that re-application is a
-- no-op: one extra ledger row, no data change, no schema change.

-- Merge the two legacy classroom roles into the single approved domain.
update app_users set role = 'classroom_staff' where role in ('teacher', 'nurse');

-- Reconcile the institution-scope constraint to the final role names. Classroom
-- staff are institution-anchored (scoped to assigned classes within their
-- institution — docs/02 §43), so they require institution_id, same as school_admin.
alter table app_users drop constraint if exists app_users_staff_needs_institution;
alter table app_users
  add constraint app_users_staff_needs_institution
  check (role not in ('school_admin', 'classroom_staff') or institution_id is not null);
