# LunchBox Connect — Final Verification (integrity pass)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `a9c9e96` (*Integrity pass — items 1-6*). This report and
the package manifest are committed as a thin packaging layer on top of that
commit; the ZIP archives that layer and is named for `a9c9e96`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0030` applied verbatim; frontend logic ran in
Vitest; the production bundle was built and type-checked.

Reproduce: `./tests/sql/run_verification.sh` then
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here · `NOT_RUN` not attempted.

---

## 1. Decision

The eleven contradictions from the first inspection and the **seven
implementation defects** from the second (this pass) are resolved, each with a
regression test, and the full executable suite passes. One architecture is
described across repository, migrations, UI, backend and tests.

**Live production database: NOT modified in this pass.** The only production
change earlier this session was the approved revert. Migrations `0021`–`0030`
are **not** applied to production; that, and sequencing the frontend deploy
after the migration, remain the Founder's decision (§5).

---

## 2. What was executed and passed

### Database — 11 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | Migrations-only DB builds; auto-creates no rotation/plan/publish | 6/6 |
| `verify_golden_path` | Institution→…→Analytics end to end | 15/15 |
| `verify_rls_cross_portal` | Every portal re-reads one record under its own RLS | 16/16 |
| `verify_menu_cutover` | Legacy menu → rotation engine; seven-week-freeze regression | 10/10 |
| `verify_downstream_wiring` | Kitchen/Parent read published services; classroom write persists the link; §31 one-truth | 9/9 |
| `verify_authorization_matrix` | Roles × every write-sensitive table; resolver-RPC lockdown | **146/146** |
| `verify_special_period` | Multi-week special-period week resolution | 1/1 |
| `verify_class_staff` | Multi-staff-per-class scope | 3/3 |
| `verify_kitchen_demand` | Per-meal production quantities; publication defines service days | 2/2 |
| `verify_correction_order` | Served-needs-service, nursery/school-only, optional student_no, **+ items 3 & 4 negatives** | 10/10 |
| `verify_publish_future` | **Item 1:** override applies forward, closure removes, historical served date immutable | 3/3 |

### Frontend logic — unit suite, 58/58 PASS (6 files)

`calendar` (14), `mealAnalytics` (16, incl. §9 meal-id grouping and the §6
exception exclusion), `rbac` (11), `authorization.consistency` (8), `format`
(6), `status` (3).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS.

---

## 3. Integrity pass — seven defects, resolution + evidence

| # | Defect | Resolution | Evidence |
| - | ------ | ---------- | -------- |
| 1 | Published services frozen forever, so future Overrides/Closures/Menu edits never took effect | `publish_meal_services` locks only services that carry serving records; any other (future) service is re-resolved — Override replaces the revision, Closure removes the service | `verify_publish_future` (3) |
| 2 | Meal-revision distinction lost | `v_meal_revision_performance` keeps stats split per revision (before/after); `v_meal_performance` stays the meal-level default; Reporting shows a "By recipe revision" table | 0030; ReportsPage |
| 3 | RPC trusted the meal_service_id | `record_serving_batch` verifies the service (supplied or resolved) matches institution/date/period/published | `verify_correction_order` item-3 negatives |
| 4 | Class context unchecked | `record_serving_batch` verifies the student belongs to `p_class` | `verify_correction_order` item-4 negative |
| 5 | `authenticate:false` but UI said "usable" | Provisioning passes `authenticate:true` so the temp-password account can sign in; copy is truthful; email self-activation BLOCKED_BY_SPEC | UsersPage; admin-create-user |
| 6 | `0% → Ate Independently → Absent` possible | Absent/Unwell/Asleep are one-tap, behaviour-free, analytics-excluded; low-intake selector drops non-preference reasons; parent never sees "Ate independently · Absent" | §6 unit test; TodayPage; ParentHome |
| 7 | Stale delivery docs | This report + `PACKAGE_MANIFEST.md` regenerated for `a9c9e96`; `CLAUDE_CODE_GOLIVE.md` retired with a pointer to the current runbook | this file; PACKAGE_MANIFEST; CLAUDE_CODE_GOLIVE |

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Authenticated / networked in-browser flows** and **all Playwright E2E
  specs** — the sandbox blocks egress to `*.supabase.co`. The bundle builds and
  serves; the data layer is proven at the database layer; the E2E suite is
  written to the current architecture (incl. the §6 exception path) and runs
  where the sandbox can reach Supabase.

## 5. BLOCKED_BY_SPEC (not invented)

- Production-lock policy beyond the served-records boundary (item 1).
- Email-delivered account self-activation (item 5).
- StudentAllergy / StudentDietaryRestriction taxonomy (§42); Packing/Dispatch/
  Delivery; multi-kitchen routing; retention/deletion.

## 6. Production — unchanged this pass

The approved revert stands. Migrations `0021`–`0030` are not applied to
production. `.github/workflows/deploy.yml` deploys the frontend on push to this
branch when the `CLOUDFLARE_*` secrets are set, and the corrected frontend
expects the `0021`–`0030` schema, so the migration must land before or with the
deploy. See `scripts/PRODUCTION_APPLY.md`.
