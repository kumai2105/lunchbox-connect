# LunchBox Connect — Final Verification (bounded correction + approved menu view)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `d5645ff` (*Bounded correction pass + approved Institution
published-menu view — 8 items*). This report and the package manifest are
committed as a thin packaging layer on top of that commit; the ZIP archives that
layer and is named for `d5645ff`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0035` applied verbatim; frontend logic ran in
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

Seven corrections against `ec9c969`, plus one Founder-approved read-only
addition. The previously corrected areas were not reopened or redesigned.

The headline finding is item 1, and it is worth stating plainly: the E2E
fixture's `upsertStudent()` returned the PostgREST `{ data, error }` envelope
while every caller read `.id` off it. That is `undefined`, and those undefined
ids flowed into `student_parents`, `serving_records` and `.seeded.json` — so the
guardian link and the entire parent-portal fixture were seeded against nothing.
It survived because **`tests/e2e` was outside every tsconfig**: the green
typecheck this project reported never looked at that file. Adding
`tsconfig.e2e.json` to `pnpm typecheck` flags all seven call sites immediately,
which is the durable half of the fix.

Two further notes recorded rather than smoothed over:

- `verify_golden_path` had itself written `low_intake_reason = 'absent'`
  together with `consumption_pct = 0` — a contradiction (an absence is not
  "ate none"). The new item-3 constraint correctly refuses it, so the **test**
  was wrong and is corrected.
- The item-4 concurrency suite's INSERT case does **not** discriminate: a child
  insert already takes `FOR KEY SHARE` on the parent through the foreign key,
  which alone blocks against the resize. Removing the trigger's lock still
  passes it. The slot-**UPDATE** case (no FK re-check, so no FK lock) does
  discriminate and fails without the lock — that is the one carrying the proof.

**Live production database: NOT modified in this pass.** Migrations `0021`–`0035`
are not applied to production. Nothing was pushed.

---

## 2. What was executed and passed

### Database — 14 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | migrations-only DB builds; infers nothing | 6/6 |
| `verify_golden_path` | Institution→…→Analytics end to end | 15/15 |
| `verify_rls_cross_portal` | every portal re-reads one record under its own RLS, **+ the new Institution schedule boundary** | 17/17 |
| `verify_menu_cutover` | legacy menu → rotation engine; seven-week-freeze | 10/10 |
| `verify_downstream_wiring` | Kitchen/Parent read published services; §31 one-truth | 9/9 |
| `verify_authorization_matrix` | roles × write-sensitive tables, UPDATE/DELETE/read paths | **498/498** |
| `verify_special_period` | multi-week special-period resolution | 1/1 |
| `verify_class_staff` | multi-staff-per-class scope | 3/3 |
| `verify_kitchen_demand` | per-meal production quantities | 2/2 |
| `verify_correction_order` | served/not-served both need a published service | 12/12 |
| `verify_publish_future` | future override applies, closure removes, history immutable | 3/3 |
| `verify_db_boundary` | raw-path integrity, referenced-side and client-boundary attacks | 38/38 |
| `verify_note_privacy_and_states` | Parent free-text boundary end to end, **+ the 6 contradictory-state negatives, the approved-state positives, and the scored denominator** | 33/33 |
| `verify_slot_resize_concurrency` | **NEW** — a real second session (dblink) proves the slot/week_count invariant holds under concurrency | 5/5 |

159 `PASS` assertions in total.

**Mutation evidence.**
- Removing the parent-row lock from `guard_rotation_slot_week()` fails
  `verify_slot_resize_concurrency` c3 (`a slot UPDATE validated its week against
  a week_count another transaction was changing`).
- Restoring the table-wide `GRANT SELECT ON serving_records` (from the previous
  pass) still fails the matrix for all 11 roles.

### Frontend logic — unit suite, 91/91 PASS (8 files)

`mealAnalytics` (22), `format` (15), `calendar` (14), `rbac` (13, incl. the new
read-only `schedule` resource and that no other role gains it),
`parent/shared` (12, incl. the **selection/readiness invariant** — not only the
request-token helper), `authorization.consistency` (9, now covering meals /
menubuilder / kitchens as archive-only), `kitchen` (3), `status` (3).

### Build gates — all PASS

`pnpm typecheck` PASS — **now including `tests/e2e`** · `pnpm lint` PASS
(0 warnings) · `pnpm build` PASS.

---

## 3. This pass — 8 items, resolution + evidence

| # | Item | Resolution | Evidence |
| - | ---- | ---------- | -------- |
| 1 | E2E fixture returned the response envelope, not the row; E2E was unchecked | `upsertStudent()` returns a validated row id; every fixture mutation and dependent query checks its error; account seeding reconciles role/institution/kitchen drift and refuses non-`e2e.*` accounts; `tsconfig.e2e.json` added to `pnpm typecheck` | the new gate flagged all 7 sites before the fix |
| 2 | Child B could paint child A's data on the selection render | Readiness derived from `loadedChildId === selectedChildId`; the async guard retained | `parent/shared.test.ts` — the selection-render case, the rapid A→B→A case, and guard+readiness combined |
| 3 | Contradictory record states still reachable | NOT_SERVED carries nothing; exceptions behaviour-free; preference reasons only at 0%/25%; no mandatory reason or behaviour invented. RPC **and** table constraint | `n1`–`n6` negatives (incl. all four the order named), `p1`/`p2` positives |
| 4 | Slot writes could validate against a stale `week_count` | Trigger takes the parent row lock, matching the resize | `verify_slot_resize_concurrency` c1–c3; c3 mutation-proven |
| 5 | Five consumption bands divided by the wrong denominator | New `scored_observations`; bands divide by it, behaviour/reason metrics keep `valid_observations` | `d1`/`d2` — behaviour-only row excluded, shares total exactly 100% |
| 6 | Classroom told to publish from a screen it cannot open | Neutral role-correct copy naming the administrator | TodayPage |
| 7 | **Founder-approved**: Institution published-menu view | Read-only `/schedule` for School Admin over existing published `meal_services`, own institution only; RBAC resource, route, nav, authz tests, RLS cross-portal test. No second menu model, no duplicated data, no authoring control | `rbac.test.ts`; `verify_rls_cross_portal` schedule block; `schedule.spec.ts` |
| 8 | RBAC advertised deletes the DB refuses; stale comments | meals / menubuilder / kitchens lose `delete`; consistency test extended; `resolveMealServiceId` comment corrected; retired 4-week menu title removed | `authorization.consistency.test.ts`; build |

---

## 4. BLOCKED_BY_ENVIRONMENT

- **Playwright execution.** Specs (now including `schedule.spec.ts` and the
  child-switch case), fixtures and the bundle-build wiring are in place and
  type-checked, but running them needs an **approved non-production Supabase
  project** and egress to it. This sandbox has neither; production is refused by
  the seeder, by `build:e2e` and by CI. No new external environment was created.

## 5. BLOCKED_BY_SPEC (not invented)

Meal-performance classification thresholds; a mandatory low-intake reason at
0%/25%; a mandatory eating behaviour; the structured child Allergy/Dietary model
(§42); retention / deletion / archive policy; the free-text review workflow
beyond the Super Admin override; Nursery/School Admin classroom recording and
menu authoring; Parent association & provisioning; per-institution timezones;
Packing/Dispatch/Delivery; multi-kitchen routing.

## 6. Production — unchanged; nothing pushed

Migrations `0021`–`0035` are not applied. `scripts/PRODUCTION_APPLY.md` requires
reading the production migration ledger first and applying only the versions
missing from it. The frontend deploy runs only on a manual dispatch or a `v*`
tag, after the non-network gate. This release candidate is committed locally and
left frozen for independent review.
