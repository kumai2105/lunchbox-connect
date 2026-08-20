# LunchBox Connect — Final Verification (security / spec correction pass)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `631ae6b` (*Security/spec correction pass — 12 items*). This
report and the package manifest are committed as a thin packaging layer on top
of that commit; the ZIP archives that layer and is named for `631ae6b`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0032` applied verbatim; frontend logic ran in
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

This **security / spec correction pass** removes authorities that earlier passes
had invented where the canonical spec says `NOT_YET_DEFINED`, and hardens the
tenant/role boundaries so they hold on the **raw table paths** — not only inside
the RPC/UI. Each correction carries a regression test, and the full executable
suite passes.

Two classes of correction:

- **Integrity at the boundary** — a Student's Class must share the Student's
  institution; a guardian link must reference a `parent`; a `class_staff` member
  must be `classroom_staff` in the class's institution. All enforced by
  BEFORE INSERT/UPDATE triggers that fire on every path.
- **Un-inventing undefined permissions** — Nursery/School Admin classroom
  recording and free-text note publication are `NOT_YET_DEFINED`; both are
  removed from the frontend RBAC **and** the database. Classroom Staff record in
  assigned classes and keep internal notes; the Super Admin keeps only its
  existing system-wide override; the reviewer workflow stays `BLOCKED_BY_SPEC`.

**Live production database: NOT modified in this pass.** Migrations `0021`–`0032`
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
| `verify_db_boundary` | **raw-path** integrity: RPC-only writes, note publish, tenant/eligibility triggers, meal-image storage, **+ this pass's tenant/role triggers** | 24/24 |

The new raw-path negatives live in `verify_db_boundary` (labelled `c1`/`c2`/`c3`/`c12`):

- **c1** — a Student cannot be assigned to a Class in another institution; a
  same-institution assignment is allowed.
- **c2** — a `classroom_staff` and a `school_admin` account are both refused as
  guardians; the genuine `parent` link succeeds; the visibility helper's
  guardian branch resolves a non-parent as non-parent (defense in depth).
- **c3** — a School Admin can neither `app_can_record_in_class` nor
  `app_can_record_for_student`; assigned Classroom Staff still can; Super Admin
  retains the approved override.
- **c12** — a `school_admin` (wrong role) and a `classroom_staff` from another
  institution are both refused as `class_staff`; a same-institution
  classroom-staff membership is allowed.
- **item 4 (flipped)** — a School Admin can no longer publish a note (0 rows);
  only the Super Admin system-wide override can.

### Frontend logic — unit suite, 65/65 PASS (7 files)

`calendar` (14), `mealAnalytics` (16), `rbac` (11, incl. School Admin
guardians view-only and no record/publish), `format` (10, incl. the Asia/Dubai
midnight-boundary tests), `authorization.consistency` (8), `status` (3),
`kitchen` (3, revision-grouping over the renamed `safety_note_flagged`).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS (120 modules).

---

## 3. Correction pass — 12 items, resolution + evidence

| # | Defect (invented / unsafe) | Resolution | Evidence |
| - | -------------------------- | ---------- | -------- |
| 1 | Student could be placed in a Class of another institution | BEFORE INSERT/UPDATE trigger `students_guard_class_tenant`; class_id NULL allowed | `verify_db_boundary` c1 |
| 2 | A non-parent could be linked as a guardian; helper guardian branch ungated | Trigger `student_parents_guard_role` requires role='parent'; visibility helpers' guardian branch parent-gated | `verify_db_boundary` c2 |
| 3 | Invented Nursery/School Admin classroom RECORDING | Removed from `app_can_record_in_class` / `app_can_record_for_student` and frontend RBAC/nav; classroom_staff + Super Admin override only | `verify_db_boundary` c3; `verify_class_staff` |
| 4 | Invented School Admin free-text note PUBLICATION | Publish authority is Super Admin system-wide override only; reviewer workflow BLOCKED_BY_SPEC | `verify_db_boundary` item-4 (flipped) |
| 5 | Invented Nursery guardian create/link/delete; broken `+ Link guardian` | Guardians view-only for School Admin (RBAC + GuardiansPage gate + BLOCKED_BY_SPEC banner); link is Super Admin only | `rbac` unit; GuardiansPage |
| 6 | `medical_notes` presented as authoritative allergy data | Relabelled honestly as interim "Safety notes" across Kitchen / Student Profile / Parent Profile+Home / Institution detail; Kitchen count renamed `safety_note_flagged` | `kitchen` unit; build |
| 7 | E2E fixture dates used raw UTC | Asia/Dubai operational date in `global-setup.ts` + deterministic today/tomorrow boundary assertion | global-setup |
| 8 | E2E could seed production | Hard runtime guard refuses `llnofriwvnerntrbpehc` by URL; CI pre-flight guard fails the job if `E2E_SUPABASE_URL` targets production | global-setup; ci.yml |
| 9 | Go-live sequence omitted the Edge Function | PRODUCTION_APPLY adds `admin-create-user` deploy + secrets + 401/403 verification, sequenced with the migration | PRODUCTION_APPLY |
| 10 | Deploy fired on any branch push | deploy.yml release-safe: manual dispatch or `v*` tag only, gated behind typecheck/lint/unit/build; no production E2E in the gate | deploy.yml |
| 11 | Stale "11 suites"; stale weekday comment | README / BUILD_STATUS / 14-RELEASE_GATE → 12; `RotationSlotRow.weekday` comment → all 7 days (since 0016) | docs; api.ts |
| 12 | `class_staff` accepted any role / any institution | Trigger `class_staff_guard_membership` requires classroom_staff in the class's institution | `verify_db_boundary` c12 |

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Authenticated / networked in-browser flows** and **all Playwright E2E
  specs** — the sandbox blocks egress to `*.supabase.co`. The bundle builds and
  serves; the data layer is proven at the database layer above; the E2E suite is
  written to the current architecture (now with the production-seed guard and the
  Asia/Dubai fixture dates) and runs where an **approved non-production** target
  and that egress exist. No new external environment was created.

## 5. BLOCKED_BY_SPEC (not invented)

Nursery/School Admin classroom recording; free-text note review/publication
workflow (who / process / conditions); Parent association & provisioning /
email-delivered self-activation; the structured StudentAllergy /
StudentDietaryRestriction taxonomy (§42); production-lock policy beyond the
served-records boundary; per-institution timezones; Packing/Dispatch/Delivery;
multi-kitchen routing; retention/deletion.

## 6. Production — unchanged; nothing pushed

The approved revert stands; migrations `0021`–`0032` are not applied.
`.github/workflows/deploy.yml` now deploys the frontend **only** on a manual
dispatch or a `v*` tag and only after the non-network build gate passes; branch
pushes no longer deploy. The corrected frontend expects the `0021`–`0032` schema
and the deployed `admin-create-user` function, so the migration and function must
land before or with the deploy. See `scripts/PRODUCTION_APPLY.md`. This release
candidate is committed locally and left frozen for independent review.
