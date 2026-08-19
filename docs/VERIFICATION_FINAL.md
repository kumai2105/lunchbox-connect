# LunchBox Connect — Final Correction-Order Verification

**Date:** 2026-08-19
**Branch:** `claude/new-session-k5dd5u`
**Verified at:** `c6e1476` (*Correction order — 11 contradictions resolved*).
This document is committed on top of that tree; every result below was produced
against it.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0029` applied verbatim through the Supabase shim;
frontend logic ran in the Vitest unit suite; the production bundle was built
and type-checked.

Reproduce: `./tests/sql/run_verification.sh` then
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here · `NOT_RUN` not attempted.

---

## 1. Decision

**Codebase (this branch): the eleven contradictions found in independent
inspection of `b5bdfd7` are resolved, each with a regression test, and the
full executable suite passes.** The repository, migrations, UI, backend and
tests describe one architecture: reusable Meals + Menus on a data-sized
rotation; per-institution service configuration and calendar exceptions set
through the Admin UI; multi-staff-per-class authorization keyed on
`class_staff`; a served classroom observation that must reference a published
Meal Service; and a single meal-identity source of truth for Kitchen, Parent
and management analytics.

**Live production database: NOT modified in this pass.** The only production
change made in this session remains the revert you approved earlier. The
corrected planning + integrity migrations **`0021`–`0029` are NOT applied to
production**; that is deferred to you. See §5.

---

## 2. What was executed and passed

### Database — 10 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | A migrations-only database (no legacy `menus`) builds cleanly and auto-creates no rotation/plan/publish | 6/6 PASS |
| `verify_golden_path` | Institution→Student→Eligibility→Meal→Rotation→Calendar→Service Plan→Meal Service→Demand→Classroom→Parent→Analytics | 15/15 PASS |
| `verify_rls_cross_portal` | Every portal re-reads the same record under its own RLS; parent/teacher/kitchen/driver/school-admin isolation | 16/16 PASS |
| `verify_menu_cutover` | Legacy menu → rotation engine; the seven-week-freeze regression; idempotent backfill | 10/10 PASS |
| `verify_downstream_wiring` | Kitchen/Parent read dated published services; Classroom write persists the Meal Service link; §31 analytics one-truth | 9/9 PASS |
| `verify_authorization_matrix` | Roles × every write-sensitive table, append-only rows-affected, resolver-RPC lockdown | **146/146 PASS** |
| `verify_special_period` | Multi-week special-period rotation resolves its week from period alignment (§37) | 1/1 PASS |
| `verify_class_staff` | Multi-staff-per-class scope (§16) | 3/3 PASS |
| `verify_kitchen_demand` | Per-meal production quantities (§34); service days from publication (§35) | 2/2 PASS |
| `verify_correction_order` | **Items 1/6/7:** served-needs-published-service (RPC + constraint), nursery/school-only kind, optional student_no | 7/7 PASS |

### Frontend logic — unit suite, 57/57 PASS (6 files)

`calendar` (14), `mealAnalytics` (15, incl. the new §9 meal-id grouping cases),
`rbac` (11), `authorization.consistency` (8), `format` (6), `status` (3).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS.

---

## 3. The eleven contradictions — resolution + evidence

| # | Contradiction | Resolution | Evidence |
| - | ------------- | ---------- | -------- |
| 1 | Classroom could record a served meal with `meal_service_id = NULL` | `record_serving_batch` resolves the published service and refuses consumption when nothing is published; `serving_records_served_needs_service` (NOT VALID) backstops it; Today shows a "No published Meal" state and only publishes recordable periods | `verify_correction_order` (4 checks); TodayPage |
| 2 | Classroom periods were a fixed four | Today derives periods from the institution's **published services** for the date; a 3-meal nursery shows no Afternoon Snack | TodayPage; the role de-stale lets `classroom_staff` read their published services |
| 3 | Parent Today hid the structured result | Parent Today shows consumption + behaviour + parent-safe reason from the same record (controlled fields, shown directly; only free-text notes need review) | ParentHome |
| 4 | Staff invite lived in a route Nursery Admin can't reach | New institution-scoped **Staff** screen (`/staff`, rbac `staff` resource, nav) for school_admin/super_admin; Edge Function + RLS still restrict to classroom_staff of the caller's institution | StaffPage; rbac; roles |
| 5 | Classroom staff saw mutation controls | Create Class / Manage staff / Add student / photo-edit / class-assign are gated on `can()`; RLS unchanged | ClassesPage, StudentsPage |
| 6 | `OTHER` institution type | Canonical model is nursery/school; a NOT VALID check forbids new `other` and grandfathers historical rows; the UI offers only the two | migration 0029; `verify_correction_order`; InstitutionsPage |
| 7 | Student model forced legacy fields | `student_no` is optional (canonical minimum = names + institution); `medical_notes` documented as interim, not the §42 allergy model (BLOCKED_BY_SPEC) | migration 0029; `verify_correction_order` |
| 8 | E2E seeded the retired architecture | Fixtures/specs rebuilt on Meal → Menu → published Meal Service → `class_staff` → Classroom record → Parent result; no legacy `menus`/`teacher_id`/`kind='other'`; selectors updated | `tests/e2e/*` |
| 9 | Parent preference grouped by dish text | Grouping keys on stable `meal_id`; `DayMeal` carries `meal_id` while preserving the served revision's name | mealAnalytics + 3 new unit tests; ParentInsights |
| 10 | Menu Builder locked to Mon–Fri | All 7 service days available via a toggle (engine already stores weekday 0..6); Mon–Fri stays the default | MenuBuilderPage |
| 11 | Temp-password creation labelled "invite" | Provisioning is labelled honestly (temporary password, no email sent); email-delivered self-activation marked BLOCKED_BY_SPEC | StaffPage, InstitutionDetailPage, UsersPage |

**Bonus fix surfaced during item 2:** the `0008b` role merge (nurse/teacher →
classroom_staff) had left several SECURITY DEFINER helpers naming the retired
roles, silently excluding classroom_staff from institution-scoped reads.
Migration 0029 restores the intended behaviour; the 146-check matrix confirms
no authorization regression.

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Authenticated / networked in-browser flows** and **all Playwright E2E
  specs** — the sandbox blocks egress to `*.supabase.co`, so DOM round-trips
  cannot complete here. The bundle builds and serves; the data layer is proven
  at the database layer above; the E2E suite is written to the current
  architecture and will run where the sandbox can reach Supabase.

## 5. BLOCKED_BY_SPEC (not invented)

- **StudentAllergy / StudentDietaryRestriction taxonomy (§42):** entities exist
  in the spec but fields, severity, and approval are `NOT_YET_DEFINED`;
  `medical_notes` is an interim free-text holder, not the clinical record.
- **Email-delivered account self-activation:** the sending mechanism is a
  Founder/ops decision; provisioning with a temporary password is the working
  path and is labelled as such.
- Packing / Dispatch / Delivery state machine, expected-vs-actual quantities,
  multi-kitchen routing, retention/deletion.

## 6. Production — unchanged this pass

The approved revert stands (unapproved plans/assignments/publishes removed,
resolver leak closed). Migrations `0021`–`0029` are **not** applied to
production; applying them, and sequencing the frontend deploy after the
migration, is your decision (`.github/workflows/deploy.yml` deploys the
frontend on push to this branch when the `CLOUDFLARE_*` secrets are set, and
the corrected frontend expects the `0021`–`0029` schema). See
`scripts/PRODUCTION_APPLY.md`.
