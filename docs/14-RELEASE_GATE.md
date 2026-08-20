# Release gate (docs/14) — independent verification

This build does not self-certify. Before the platform is used with real
institutions, an independent verifier must confirm the evidence below. All
items must be reproduced against a **live Supabase project**, not trusted from
this repository alone.

## Required evidence

1. **Static checks**
   - `pnpm typecheck` — clean
   - `pnpm lint` — clean (0 warnings)
   - `pnpm test:unit` — 83 tests pass (RBAC, calendar, meal analytics incl. the
     unscored-is-not-0% rule, kitchen revision grouping, operational date and
     Asia/Dubai presentation, parent child-switch race guard)
   - `pnpm build` — production build succeeds

2. **Schema / RLS / RPC / trigger suite (no network required)**
   - `./tests/sql/run_verification.sh` — all **13** `verify_*.sql` suites pass
     on a throwaway PostgreSQL 16 built from `supabase/migrations/0001`–`0034`,
     including the **498-check authorization matrix** and the **DB-boundary**
     suite: raw `serving_records` writes are denied (RPC is the only path);
     classroom staff cannot publish notes and School Admin cannot publish a note
     at all; only Super Admin changes `operational_status`, moves a Student/Class
     institution, or records/publishes outside the classroom-staff path; a
     Student's class must share the Student's institution; a `student_parents`
     guardian must be a `parent`; a `class_staff` member must be
     `classroom_staff` in the class's institution; a Parent cannot read an
     unrelated unpublished meal image.

3. **Live boundary tests (where Supabase egress is available)**
   - `pnpm test:e2e` with seeded accounts — the current specs pass:
     `login.roles`, `rls`, `serving`, `parent-portal`, `status`.

## Declared out of scope (spec gaps, NOT_YET_DEFINED)

Production-lock policy beyond the served-records boundary, email-delivered
account self-activation, per-institution timezones, dispatch/delivery state
machines, report KPIs, the structured StudentAllergy/StudentDietaryRestriction
taxonomy, and multi-kitchen routing remain NOT_YET_DEFINED in the spec pack and
are delivered as isolated shells — not verified because not specified.
(Operational eligibility is defined: `operational_status =
ACTIVE_BILLABLE_TO_NURSERY` is the authoritative gate.)

## Sign-off

| Verifier        | Date | Result | Evidence ref |
| --------------- | ---- | ------ | ------------ |
| _(independent)_ |      |        |              |
