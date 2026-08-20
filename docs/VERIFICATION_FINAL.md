# LunchBox Connect — Final Verification (DB-boundary / integrity pass)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `7072529` (*Security/integrity pass — 11 items*). This report
and the package manifest are committed as a thin packaging layer on top of that
commit; the ZIP archives that layer and is named for `7072529`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0031` applied verbatim; frontend logic ran in
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

The prior contradiction passes plus this **database-boundary / integrity pass**
are resolved, each with a regression test, and the full executable suite passes.
The integrity checks now hold on the **raw table paths** under an authenticated
role — not only inside the RPC/UI.

**Live production database: NOT modified in this pass.** Migrations `0021`–`0031`
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
| `verify_authorization_matrix` | roles × write-sensitive tables; resolver lockdown | **146/146** |
| `verify_special_period` | multi-week special-period resolution | 1/1 |
| `verify_class_staff` | multi-staff-per-class scope | 3/3 |
| `verify_kitchen_demand` | per-meal production quantities | 2/2 |
| `verify_correction_order` | served-needs-service, kind, student_no, item 3/4 negatives | 10/10 |
| `verify_publish_future` | future override applies, closure removes, history immutable | 3/3 |
| `verify_db_boundary` | **raw-path** integrity: RPC-only writes, note publish, tenant/eligibility triggers, meal-image storage | 12/12 |

### Frontend logic — unit suite, 65/65 PASS (7 files)

`calendar` (14), `mealAnalytics` (16), `rbac` (11), `format` (10, incl. the
Asia/Dubai midnight-boundary tests), `authorization.consistency` (8), `status`
(3), `kitchen` (3, revision-grouping).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS.

---

## 3. Integrity pass — 11 items, resolution + evidence

| # | Defect | Resolution | Evidence |
| - | ------ | ---------- | -------- |
| 1 | Integrity only inside the RPC; raw writes bypassed it | Direct `serving_records` INSERT/UPDATE/DELETE revoked from `authenticated`; `record_serving_batch` is SECURITY DEFINER with in-function authz and server-stamped `recorded_by` — the single write path | `verify_db_boundary` item-1 |
| 2 | Classroom staff could publish their own notes | RLS split: staff write only unpublished notes and can't set `published_at` or touch a published one; only admin publishes; `created_by` stamped server-side | `verify_db_boundary` item-2 |
| 3 | `operational_status` / tenant editable via generic update | BEFORE-UPDATE triggers: only Super Admin changes eligibility or moves a Student/Class institution | `verify_db_boundary` item-3 |
| 4 | UTC dates disagreed with the nursery after local midnight | One Asia/Dubai operational date in the app (`format.ts`) and DB (`app_operational_date()`) — serving RLS/RPC, dashboard, parent/kitchen/analytics/calendar | `format` boundary unit tests; 0031 |
| 5 | Kitchen merged revisions by name | Group by `meal_revision_id` — same name ≠ same recipe | `kitchen` unit tests |
| 6 | meal-images readable by everyone | Storage RLS follows published-meal visibility; parent can't read an unrelated unpublished image | `verify_db_boundary` item-6 |
| 7 | Dead `/menu` link | → `/menu-builder`; internal routes audited | build |
| 8 | Invented 12-week menu cap | Raised to the DB max of 52 | MenuBuilderPage |
| 9 | One save created two revisions; late thumbnails | Upload image before the single `saveMeal`; thumbnails resolve on first load | MealLibraryPage |
| 10 | Legacy `enrollment_status` shown as truth | Removed from Students / Student Profile / Parent Profile; DB data preserved | build |
| 11 | Canonical docs stale/contradictory | Decision 034 records the APPROVED stack and supersedes Decision 024 + the `NOT_YET_DEFINED` statements; README / BUILD_STATUS / RELEASE_GATE regenerated; PRODUCTION_APPLY covers 0017–0031 | docs |

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Authenticated / networked in-browser flows** and **all Playwright E2E
  specs** — the sandbox blocks egress to `*.supabase.co`. The bundle builds and
  serves; the data layer is proven at the database layer above; the E2E suite is
  written to the current architecture and runs where that egress exists.

## 5. BLOCKED_BY_SPEC (not invented)

Production-lock policy beyond the served-records boundary; email-delivered
account self-activation; per-institution timezones; StudentAllergy /
StudentDietaryRestriction taxonomy; Packing/Dispatch/Delivery; multi-kitchen
routing; retention/deletion.

## 6. Production — unchanged; nothing pushed

The approved revert stands; migrations `0021`–`0031` are not applied.
`.github/workflows/deploy.yml` deploys the frontend on push to this branch when
the `CLOUDFLARE_*` secrets are set, and the corrected frontend expects the
`0021`–`0031` schema, so the migration must land before or with the deploy. See
`scripts/PRODUCTION_APPLY.md`. This release candidate is committed locally and
left frozen for independent review.
