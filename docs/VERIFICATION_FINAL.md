# LunchBox Connect — Final Verification (client-boundary lockdown pass)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `41a2000` (*Client-boundary lockdown — 13 items*). This
report and the package manifest are committed as a thin packaging layer on top
of that commit; the ZIP archives that layer and is named for `41a2000`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0033` applied verbatim; frontend logic ran in
Vitest; the production bundle was built and type-checked.

Reproduce: `./tests/sql/run_verification.sh` then
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here.

---

## 1. Decision

This pass closes a **privilege-escalation vulnerability** and the surrounding
class of client-boundary defects. The headline finding is item 1: the
`app_users` UPDATE policy allowed `user_id = auth.uid()`, and the Supabase
baseline grants `authenticated` table privileges and relies on RLS — so **any**
account (Parent, Classroom Staff, Kitchen, Viewer, School Admin) could rewrite
its own `role`, `institution_id` or `kitchen_id`, including promoting itself to
`super_admin`. That is now closed at the database boundary, and the
authorization matrix attacks it from every role so it cannot silently return.

The other twelve items follow the same principle: **the database, not the UI, is
the boundary** — and an authority the spec has not defined must not exist on the
raw path either.

**The previous 146-check matrix was not exhaustive** — it tested INSERT paths
thoroughly but skipped most UPDATE/DELETE and read paths, which is exactly how
item 1 escaped. It is now **401 checks**, and coverage (not the number) was the
target.

**Live production database: NOT modified in this pass.** Migrations `0021`–`0033`
are not applied to production; that, and sequencing the frontend deploy after the
migration, remain the Founder's decision (§5). Nothing was pushed.

---

## 2. What was executed and passed

### Database — 12 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | migrations-only DB builds; infers nothing | 6/6 |
| `verify_golden_path` | Institution→…→Analytics end to end | 15/15 |
| `verify_rls_cross_portal` | every portal re-reads one record under its own RLS | 16/16 |
| `verify_menu_cutover` | legacy menu → rotation engine; seven-week-freeze | 10/10 |
| `verify_downstream_wiring` | Kitchen/Parent read published services; §31 one-truth | 9/9 |
| `verify_authorization_matrix` | roles × write-sensitive tables + UPDATE/DELETE/read paths | **401/401** |
| `verify_special_period` | multi-week special-period resolution | 1/1 |
| `verify_class_staff` | multi-staff-per-class scope | 3/3 |
| `verify_kitchen_demand` | per-meal production quantities | 2/2 |
| `verify_correction_order` | served/not-served both need a published service; tenant negatives | 12/12 |
| `verify_publish_future` | future override applies, closure removes, history immutable | 3/3 |
| `verify_db_boundary` | **raw-path** integrity, incl. this pass's referenced-side and client-boundary attacks | 38/38 |

### Frontend logic — unit suite, 66/66 PASS (7 files)

`calendar` (14), `mealAnalytics` (16), `rbac` (11), `format` (10, incl. the
Asia/Dubai midnight-boundary tests), `authorization.consistency` (9, incl. the
new "no role advertises hard delete of a core historical entity"), `status` (3),
`kitchen` (3).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS (120 modules).

---

## 3. Correction pass — 13 items, resolution + evidence

| # | Defect | Resolution | Evidence |
| - | ------ | ---------- | -------- |
| 1 | **CRITICAL** — `app_users` self role/scope escalation to `super_admin` | UPDATE policy is Super-Admin-only, **and** a trigger closes `role`/`institution_id`/`kitchen_id` to every API client — including a Super Admin, since account editing is itself NOT_YET_DEFINED. Ordinary profile fields stay editable; `admin-create-user` (service_role) remains the provisioning path | matrix `app_users.SELF role change` × 11 roles; `verify_db_boundary` b1/b1b |
| 2 | School Admin could create an ALREADY-ELIGIBLE Student (INSERT unprotected) | BEFORE-INSERT trigger: `operational_status` is Super-Admin-only on INSERT as on UPDATE. School Admin creates with NULL status | matrix `students.insert(ALREADY ELIGIBLE)`; `verify_db_boundary` b2 |
| 3 | School Admin could still link/unlink guardians on the raw path | `student_parents` INSERT/DELETE now `app_is_super_admin()`; backend agrees with the read-only UI. No invitation/self-claim/unlink semantics invented | matrix `student_parents.insert`/`DELETE`; `verify_db_boundary` b3 |
| 4 | Tenant invariants broke when the REFERENCED row changed | Class moves blocked while Students/staff are attached; account role/institution changes blocked while `class_staff`/guardian rows would be invalidated; Student/Class cross-institution transfer removed as an ordinary client edit (BLOCKED_BY_SPEC); helpers require current institution consistency | `verify_db_boundary` r1–r6 |
| 5 | Generic hard DELETE of core historical entities | Denied for students, classes, institutions, app_users, serving_records/notes (policy dropped **and** grant revoked). Genuine config deletes (class_staff, rotation slots, calendar exceptions) untouched; RBAC no longer advertises it | matrix `*.DELETE rows` × 11 roles; `verify_db_boundary` b4; `authorization.consistency` unit |
| 6 | Parent/Classroom could read raw draft planning data | Service plans, rotation assignments and calendar exceptions moved from `app_can_see_institution` to `app_can_manage_institution`. No new Nursery Admin privilege | matrix planning `SELECT count` × 11; `verify_db_boundary` b5 |
| 7 | Legacy surfaces still client-exposed | `menus` is genuinely read-only (no client writes, Super-Admin-only read). **`eligibility` and `messages` were already dropped by 0009** — the quoted 0004 policies are dead text on this schema; handled defensively for any DB still carrying them | matrix `menus.insert`/`UPDATE`/`SELECT`; `verify_db_boundary` b7 |
| 8 | `NOT_SERVED` could be recorded for a never-published period | `record_serving_batch` resolves and requires a published Meal Service for **every** new record; an unpublished period is not applicable and cannot be recorded. Historical NULL-linked rows grandfathered. `v_dashboard_institutions` counts only eligible + anchored records, so completion cannot exceed 100% | `verify_correction_order` (flipped) |
| 9 | Duplicate service-plan / rotation rows for one effective date | Unique `(institution_id, effective_from)` on both tables; API upserts on it; existing ambiguity is **reported by name and the migration stops** rather than guessing. `anchor_week` bounded by the Menu's `week_count` from both sides | `verify_db_boundary` b8 |
| 10 | School Admin dashboard linked to denied routes | `/institutions`, `/status` and analytics destinations gated by the same `can()` matrix the routes enforce; no replacement destination invented | DashboardPage; build |
| 11 | `meal_services` generic Super Admin table writes | Direct client INSERT/UPDATE/DELETE revoked; publication only via `publish_meal_services()`. Downstream stays read-only/published-only | matrix `meal_services.*(direct table write)`; `verify_db_boundary` b6 |
| 12 | Runbook told the operator to replay applied migrations | PRODUCTION_APPLY now: read `supabase_migrations.schema_migrations` first, apply only versions absent from the ledger, never replay history; expected pending set must agree with verified state. E2E documented as an approved NON-PRODUCTION project; stale allergy/weekday terminology corrected | PRODUCTION_APPLY; global-setup; format.ts |
| 13 | 146-check matrix was not exhaustive | Expanded to **401 checks** covering `app_users` self-UPDATE, status on INSERT, student/class tenant UPDATE, deletes, guardian writes, planning reads, direct Meal Service writes and referenced-side invariants | `verify_authorization_matrix` |

### Two tests that were codifying bugs

Both are corrected, and are worth calling out because a green suite was
asserting the wrong behaviour:

- `verify_authorization_matrix` **expected** the School Admin's
  already-eligible Student INSERT to be ALLOWED (item 2).
- `verify_correction_order` **asserted** that not-served could be recorded with
  nothing published — the "honest escape valve" that item 8 removes.

---

## 4. A note on the trigger mechanism

Several rules are triggers, which — unlike RLS — also fire for the table owner
and `service_role`. They must constrain ordinary API clients without breaking
the paths that are trusted by design (migrations, owner maintenance, the
`admin-create-user` Edge Function, disposable E2E seeding). PostgREST executes
every request as `SET LOCAL ROLE authenticated|anon`, so the `role` GUC names
the caller even inside a SECURITY DEFINER function; `app_is_api_client()` reads
it. This is **defense in depth only** — the authorization decisions themselves
are RLS plus the explicit role checks, never that helper alone.

## 5. BLOCKED_BY_ENVIRONMENT

- **Authenticated / networked in-browser flows** and **all Playwright E2E
  specs** — the sandbox blocks egress to `*.supabase.co`. The bundle builds and
  serves; the data layer is proven at the database layer above. The suite is
  written to the current architecture, refuses the production project outright,
  and runs where an **approved non-production** target and that egress exist. No
  new external environment was created.

## 6. BLOCKED_BY_SPEC (not invented)

Account editing / deactivation and self-profile mutation of security identity;
Nursery/School Admin classroom recording; the free-text note review/publication
workflow; Parent association & provisioning / email-delivered self-activation;
cross-institution Student/Class transfer; retention / archive / deletion
semantics; the structured StudentAllergy / StudentDietaryRestriction taxonomy
(§42); production-lock policy beyond the served-records boundary;
per-institution timezones; Packing/Dispatch/Delivery; multi-kitchen routing.

## 7. Production — unchanged; nothing pushed

The approved revert stands; migrations `0021`–`0033` are not applied. Before
applying anything, read the production migration ledger and apply **only** the
versions missing from it — see `scripts/PRODUCTION_APPLY.md`. Note that **0033
deliberately stops** if production already holds two service-plan or
rotation-assignment rows for the same institution and effective date: it names
them and refuses, because choosing which row wins is a human decision.

`.github/workflows/deploy.yml` deploys the frontend only on a manual dispatch or
a `v*` tag, and only after the non-network build gate passes. This release
candidate is committed locally and left frozen for independent review.
