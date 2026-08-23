# Release gate (docs/14) — independent verification

This build does not self-certify. Before the platform is used with real
institutions, an independent verifier must confirm the evidence below. All
items must be reproduced against a **live Supabase project**, not trusted from
this repository alone.

## Required evidence

1. **Static checks**
   - `pnpm typecheck` — clean
   - `pnpm lint` — clean (0 warnings)
   - `pnpm test:unit` — **125** tests pass (RBAC incl. the read-only
     Institution schedule and the `account` resource every role holds over its
     own sign-in details, calendar, meal analytics, kitchen revision grouping,
     operational date and Asia/Dubai presentation, the parent child-switch
     readiness invariant, the four factual dashboard completion states,
     exhaustive analytics pagination, the nav-link/route reachability check
     that catches a sidebar link pointing at a route the router never declares,
     and the derivation that withholds a role from the account-creation picker
     while every screen in its navigation is a shell)
   - `pnpm typecheck` covers the app, node configs AND `tests/e2e`
   - `pnpm build` — production build succeeds

2. **Schema / RLS / RPC / trigger suite (no network required)**
   - `./tests/sql/run_verification.sh` — all **23** `verify_*.sql` suites pass
     with **278 named assertions**, on a throwaway PostgreSQL 16 built from
     `supabase/migrations/0001`–`0045`, including the **520-check
     authorization matrix**, the **DB-boundary** suite and the **lifecycle
     security** suite.
   - The DB-boundary suite: raw `serving_records` writes are denied (RPC is the
     only path); classroom staff cannot publish notes and School Admin cannot
     publish a note at all; only Super Admin changes `operational_status`,
     moves a Student/Class institution, or records/publishes outside the
     classroom-staff path; a Student's class must share the Student's
     institution; a `student_parents` guardian must be a `parent`; a
     `class_staff` member must be `classroom_staff` in the class's institution;
     a Parent cannot read an unrelated unpublished meal image; a meal image
     referenced by a Meal Revision cannot be deleted or overwritten even by a
     Super Admin, while an unreferenced upload stays removable; and an audit
     entry cannot be forged, rewritten or deleted from any client session.
   - The lifecycle security suite (`verify_lifecycle_security.sql`, added
     2026-08-23) proves that **deactivation holds against a live token**: an
     inactive account reads nothing and writes nothing, cannot see its own
     `app_users` row, and cannot even correct its own name. It further proves
     that reactivation restores role scope but **not** class assignments; that
     the last active Super Admin cannot be deactivated and nobody may
     deactivate themselves; that an Institution Admin's account authority is
     exactly their own classroom staff; that a Class is refused archival while
     it holds students or staff and thereafter takes none; that an Institution
     is refused archival over meal service published for today or later and
     thereafter gains no activity while preserving every record it owns; that
     guardian revocation is Super-Admin-only, reason-required, immediate and
     narrow; and that **no audit row anywhere carries password material**.

3. **Live browser tests (a real Chromium against a real Supabase stack)**
   - `pnpm test:e2e` — **98 tests across 14 spec files**, all of which must
     pass: **0 failed, 0 skipped, 0 flaky**. Take the number from
     `pnpm exec playwright test --list`, never from prose — the CI gate does
     exactly that rather than asserting a hand-written constant, and it fails
     on a silent skip as well as on a failure.
   - The executor is `.github/workflows/e2e-local-supabase.yml`, which starts a
     throwaway Supabase stack on the runner itself. It never touches a hosted
     project: the target is `127.0.0.1`, and the seeder refuses the production
     ref outright. Seeding the production project is refused by the seeder, by
     `build:e2e` and by CI.
   - `lifecycle.spec.ts` (added 2026-08-23) drives the lifecycle actions as a
     person: a disposable account is created, corrected, deactivated — and
     proven locked out **from a fresh browser context**, not merely hidden —
     reactivated, issued a replacement password with the old one proven dead
     and the audit row proven to carry neither value, and then changes its own
     password from its own profile. Every fixture it touches, it creates and
     removes.

4. **Production, when the backend is ready**
   - `prod-smoke` and `prod-browser-auth`, both dispatched against the **exact
     SHA that this gate ran on**. `prod-browser-auth` drives a real browser
     through sign-in, refresh, sign-out, refusal of a protected route, and
     sign-in again, against the live origin.
   - The frontend deploy workflow refuses to run until
     `BACKEND_READY_MIGRATION` attests the highest migration applied to
     production. **Do not defeat this gate.** The frontend reads columns and
     calls functions a lagging backend does not have, and the failure is silent
     rather than loud: a missing `active` column reads back as `undefined`,
     which is falsy, so every account would render as "Deactivated" and every
     institution as "Archived" on a live site. Order is always **migrations →
     Edge Functions → frontend**.
   - Three Edge Functions must be deployed together (`pnpm functions:deploy`):
     `admin-create-user`, `admin-set-password`, `admin-set-active`. Each needs
     `SUPABASE_SERVICE_ROLE_KEY` as a function secret; that key must exist only
     in the Deno environment and never in a frontend build.

## Declared out of scope (spec gaps, NOT_YET_DEFINED)

Retention and purge policy (archive is not retention), email-delivered account
self-activation and self-service password reset, changing an email address or a
role in place, nursery-side guardian revocation, per-institution timezones,
dispatch/delivery state machines, report KPIs, the structured
StudentAllergy/StudentDietaryRestriction taxonomy, and multi-kitchen routing
remain NOT_YET_DEFINED in the spec pack and are delivered as isolated shells or
not at all — not verified because not specified.

Operational eligibility IS defined: `operational_status =
ACTIVE_BILLABLE_TO_NURSERY` is the authoritative gate. The stored value is
unchanged; what a person reads is "Active — in the meal service", because an
institution here may be a school and the previous wording told its
administrator something untrue about their own pupil.

**Permanent deletion of a core record is not a gap.** Accounts, Institutions
and Classes are deactivated or archived and never destroyed, because each is
referenced by the record of meals actually served to children (Decision 037).

## Sign-off

| Verifier        | Date | Result | Evidence ref |
| --------------- | ---- | ------ | ------------ |
| _(independent)_ |      |        |              |
