# LunchBox Connect — Final Verification (note-privacy / state-validity pass)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `ec9c969` (*Note privacy, record-state validity, atomicity
and honest analytics — 15 items*). This report and the package manifest are
committed as a thin packaging layer on top of that commit; the ZIP archives that
layer and is named for `ec9c969`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0034` applied verbatim; frontend logic ran in
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

This pass closes a **Parent privacy bypass** and the surrounding class of
data-integrity defects.

The headline finding is item 1: `serving_records.note` — a legacy free-text
column — was still covered by `serving_records_select`, which grants a Parent
access through `app_can_see_student`. Any internal text ever written there was
retrievable through raw PostgREST, with no publication boundary in front of it.
It is now archived and closed to every client.

Two of the fixes needed a second attempt, and the suite caught both — recorded
here rather than smoothed over:

- The state-validity CHECK first read `low_intake_reason in ('absent', …)`.
  Against a NULL reason that expression is NULL, and **a CHECK constraint passes
  on NULL** — so the exact row it existed to forbid slipped through the raw
  path. Fixed with `coalesce(...)`; `s2e` proves it.
- The note lockdown first used `REVOKE SELECT (note)`. A column-level revoke does
  **not** override a table-level `GRANT SELECT`, so every column stayed readable
  and the Parent could still read the text. Fixed by dropping the table-level
  grant and granting an explicit column list; `s15b`/`s15c` prove it.

**Live production database: NOT modified in this pass.** Migrations `0021`–`0034`
are not applied to production; that, and sequencing the frontend deploy after the
migration, remain the Founder's decision. Nothing was pushed.

---

## 2. What was executed and passed

### Database — 13 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | migrations-only DB builds; infers nothing | 6/6 |
| `verify_golden_path` | Institution→…→Analytics end to end | 15/15 |
| `verify_rls_cross_portal` | every portal re-reads one record under its own RLS | 16/16 |
| `verify_menu_cutover` | legacy menu → rotation engine; seven-week-freeze | 10/10 |
| `verify_downstream_wiring` | Kitchen/Parent read published services; §31 one-truth | 9/9 |
| `verify_authorization_matrix` | roles × write-sensitive tables, UPDATE/DELETE/read paths, and this pass's closed paths | **498/498** |
| `verify_special_period` | multi-week special-period resolution | 1/1 |
| `verify_class_staff` | multi-staff-per-class scope | 3/3 |
| `verify_kitchen_demand` | per-meal production quantities | 2/2 |
| `verify_correction_order` | served/not-served both need a published service | 12/12 |
| `verify_publish_future` | future override applies, closure removes, history immutable | 3/3 |
| `verify_db_boundary` | raw-path integrity, referenced-side and client-boundary attacks | 38/38 |
| `verify_note_privacy_and_states` | **NEW** — Parent free-text boundary end to end, record states, concern flag, atomic resize, archive-only lifecycle | 23/23 |

**Mutation evidence.** Restoring the table-wide `GRANT SELECT ON serving_records`
(re-opening the leak) fails the matrix for **every one of the 11 roles** on
`serving_records.* wildcard SELECT`. The check is not vacuous.

### Frontend logic — unit suite, 83/83 PASS (8 files)

`calendar` (14), `mealAnalytics` (22, incl. the unscored-is-not-0% rule and the
NOT_YET_DEFINED classification), `rbac` (11), `format` (15, incl. the Asia/Dubai
boundary and presentation), `authorization.consistency` (9), `parent/shared`
(6, **new** — the child-switch race guard and meal tone), `kitchen` (3),
`status` (3).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS.

---

## 3. Correction pass — 15 items, resolution + evidence

| # | Defect | Resolution | Evidence |
| - | ------ | ---------- | -------- |
| 1 | **Parent could read legacy `serving_records.note` via raw PostgREST** | Historical text COPIED to `serving_record_note_archive` (no API role may read it), column cleared, table-level SELECT replaced by an explicit column grant omitting `note`; the RPC no longer accepts or writes it | `s15b`, `s15c`, `s1d`, `s1g`; matrix × 11 roles |
| 2 | A SERVED record could exist with no consumption AND no behaviour | CHECK (NOT VALID, history grandfathered) + RPC refusal; ABSENT/UNWELL/SLEEPING exception form preserved; NOT_SERVED still not 0%; saving a note no longer fabricates an outcome | `s2a`–`s2e`; `meanConsumption` unit tests |
| 2b | Analytics turned unscored observations into 0% via `consumption_pct ?? 0` | `measuredObservations` / `meanConsumption`: only scored rows are averaged, everywhere including the Parent tone helper | `mealAnalytics` + `parent/shared` unit tests |
| 3 | Toggling "Flag a concern" while saving a note did not persist | `set_concern_observed()` — narrow, authorized, touches no other field | `s3` (persists; result unchanged; Parent refused) |
| 4 | Menu shrink deleted slots BEFORE the rejected `week_count` update | `set_rotation_week_count()` validates → removes → resizes in one transaction; triggers hold the invariant from both sides | `s4` — a rejected shrink leaves **every** slot and the week count unchanged |
| 5 | Kitchen E2E account had no Kitchen entity; convenience institution scoping | Kitchen entity created and `kitchen_id` set; only `school_admin`/`classroom_staff` receive `institution_id`; fixture steps fail loudly via `must()`/`mustOk()` | global-setup |
| 6 | Browser bundle was never pointed at the seeded project | `build:e2e` maps E2E → VITE vars and refuses a production URL or a service_role-claiming "anon" key; readiness check, CI and `.env.example` updated | build-e2e.mjs; ci.yml |
| 7 | Invented classification thresholds | 70/40/55% consumption, 10/15/30% refusal and the minimum-observation rule removed; classification is explicitly `NOT_YET_DEFINED` | `classifyMealPerformance` unit test |
| 8 | Approved factual metric set incomplete | Distribution (counts + shares), refusal/encouragement/DID_NOT_LIKE_IT shares, reason breakdown, exception counts, 30-day trend — exceptions still excluded, revision distinction preserved | `v_meal_performance`; ReportsPage |
| 9 | Parent Insights missing approved measures | Refusal information plus **both** higher- and lower-accepted meals, from that child's valid records only | ParentInsights |
| 10 | Child B rendered child A's data while loading | Stale state cleared on switch; `createRequestGuard()` discards out-of-order responses; screens suspended during the switch | `parent/shared` unit tests |
| 11 | Wording implied the child profile held an authoritative allergy record | Allergens are authoritative **for the meal**; the child model stays BLOCKED_BY_SPEC and the copy says so | ParentMenu / ParentProfile |
| 12 | Device timezone used for operational Today / greeting / service time | `operationalHour`, `formatOperationalDate`, `formatOperationalTime` in the one operational timezone; no per-institution timezones | `format` unit tests |
| 13 | Stale `0021`–`0032` range; Decision Log froze future services | Ranges corrected to `0034` with a 0034 archive warning; Decision Log reconciled — publication alone does not freeze a service, being **served** does | PRODUCTION_APPLY; 13_DECISION_LOG |
| 14 | Hard DELETE still available for archivable entities | meals, meal_revisions, rotations, kitchens lose client DELETE; archive/deactivate still works; real config deletes untouched | `s14`; matrix |
| 15 | The Parent free-text boundary was never proven end to end on raw paths | Internal note → Parent refused via `serving_notes` AND every legacy field → Super Admin publishes → Parent reads exactly the approved text | `s15a`–`s15f` |

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Playwright execution.** The specs, fixtures and the bundle-build wiring are
  in place and correct, but running them needs an **approved non-production
  Supabase project** and egress to it. This sandbox has neither (`*.supabase.co`
  is blocked), and production is refused outright by the seeder, by `build:e2e`
  and by CI. No new external environment was created.

## 5. BLOCKED_BY_SPEC (not invented)

Meal-performance classification thresholds; the structured child Allergy /
Dietary model (§42); retention / deletion / archive policy; the free-text
review workflow beyond the Super Admin override; Nursery/School Admin classroom
recording; Parent association & provisioning; per-institution timezones;
Packing/Dispatch/Delivery; multi-kitchen routing.

## 6. Production — unchanged; nothing pushed

Migrations `0021`–`0034` are not applied. `scripts/PRODUCTION_APPLY.md` requires
reading the production migration ledger first and applying only the versions
missing from it — never replaying an applied version because the file still
exists. The frontend deploy runs only on a manual dispatch or a `v*` tag, after
the non-network gate. This release candidate is committed locally and left
frozen for independent review.
