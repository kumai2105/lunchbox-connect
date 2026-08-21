# Release gate (docs/14) — independent verification

This build does not self-certify. Before the platform is used with real
institutions, an independent verifier must confirm the evidence below. All
items must be reproduced against a **live Supabase project**, not trusted from
this repository alone.

## Required evidence

1. **Static checks**
   - `pnpm typecheck` — clean
   - `pnpm lint` — clean (0 warnings)
   - `pnpm test:unit` — 110 tests pass (RBAC incl. the read-only Institution
     schedule, calendar, meal analytics, kitchen revision grouping, operational
     date and Asia/Dubai presentation, the parent child-switch readiness
     invariant, the four factual dashboard completion states, exhaustive
     analytics pagination, and the nav-link/route reachability check that
     catches a sidebar link pointing at a route the router never declares)
   - `pnpm typecheck` covers the app, node configs AND `tests/e2e`
   - `pnpm build` — production build succeeds

2. **Schema / RLS / RPC / trigger suite (no network required)**
   - `./tests/sql/run_verification.sh` — all **16** `verify_*.sql` suites pass
     on a throwaway PostgreSQL 16 built from `supabase/migrations/0001`–`0040`,
     including the **520-check authorization matrix** and the **DB-boundary**
     suite: raw `serving_records` writes are denied (RPC is the only path);
     classroom staff cannot publish notes and School Admin cannot publish a note
     at all; only Super Admin changes `operational_status`, moves a Student/Class
     institution, or records/publishes outside the classroom-staff path; a
     Student's class must share the Student's institution; a `student_parents`
     guardian must be a `parent`; a `class_staff` member must be
     `classroom_staff` in the class's institution; a Parent cannot read an
     unrelated unpublished meal image; a meal image referenced by a Meal
     Revision cannot be deleted or overwritten even by a Super Admin, while an
     unreferenced upload stays removable; and an audit entry cannot be forged,
     rewritten or deleted from any client session.

3. **Live boundary tests (where Supabase egress is available)**
   - `pnpm test:e2e` with seeded accounts — **7 specs, 33 tests**, all of which
     must pass: `login.roles` (10), `serving` (4), `parent-portal` (3), `rls` (4),
     `schedule` (3), `status` (3). This list previously omitted `schedule`
     entirely, so a verifier reading it would have signed off on five of the six
     specs and never noticed the read-only published-menu surface was untested.
   - The count was recorded as **19** in every release document until the suite
     was actually executed. It was never 19: `login.roles` is a parameterised
     test that runs once per role, so it contributes 10 tests, not 2. Take the
     number from `pnpm exec playwright test --list`, never from prose — the CI
     gate now does exactly that rather than asserting a hand-written constant.
   - The executor is `.github/workflows/e2e-local-supabase.yml`, which starts a
     throwaway Supabase stack on the runner itself. It never touches a hosted
     project: the target is `127.0.0.1`, and the seeder refuses the production
     ref outright.
     Seeding the production project is refused by the seeder, by `build:e2e`
     and by CI.

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
