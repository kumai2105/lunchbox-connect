# LunchBox Connect — Final Verification (consolidated boundary closure)

**Date:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `222d32b` (*Release-layer cleanup — assets binding,
fail-closed deploy, stale doc lines*), which sits on `0f63ec7` (*Closure sweep*)
and `54a03a2` (*Consolidated boundary closure — 20 items*). This report and the
package manifest are committed as a thin packaging layer on top of `222d32b`;
the ZIP archives that layer and is named for `222d32b`.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0037` applied verbatim; frontend logic ran in
Vitest; the production bundle was built and type-checked.

Reproduce: `./tests/sql/run_verification.sh` then
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here.

**FAIL count: 0.** Browser E2E execution is `BLOCKED_BY_ENVIRONMENT` and is not
reported as PASS anywhere in this document.

---

## 1. Decision

Twenty corrections against the frozen `d5645ff` candidate, plus a closure sweep
that found and closed two further proven defects (section 4).
Previously corrected areas were not reopened or redesigned.

The common thread across items 1, 7, 8 and 9 is one mistake repeated: a
permission the canonical spec leaves `NOT_YET_DEFINED` had been *granted*
because a helper already existed that happened to include the role.
`app_can_manage_institution()` pulled the School Admin into raw planning;
`app_is_staff()` pulled it into unpublished Classroom free text; "any row in
`app_users`" pulled every signed-in account into the Kitchen master table. An
undefined permission is now denied in each case.

Two findings worth stating plainly, because both were mine to catch and the
tests caught them:

- **The first version of the publish/record race test was a false pass.** The
  remote session had no JWT, so `record_serving_batch` refused it on
  authorization — and a `when others` handler read that refusal as "it blocked".
  It now sets real claims and accepts *only* a statement timeout (57014) as
  evidence of waiting.
- **Half the concurrency evidence does not discriminate, and the report says
  so.** In `verify_publish_record_race`, cases r2 and r3 are satisfied by the
  foreign key alone (a child insert takes `FOR KEY SHARE`, and a parent DELETE
  conflicts with it). Only **r4** isolates the publisher's own lock, because
  changing `meal_revision_id` needs just `FOR NO KEY UPDATE`, which the FK does
  not block. r4 fails when the lock is removed; r2/r3 do not. The same applies
  to `verify_slot_resize_concurrency`: c2 is FK-satisfied, c3 is the proof.

**Live production database: NOT modified.** Migrations `0021`–`0037` are not
applied to production. Nothing was pushed.

---

## 2. Executed results

### Database — 16 suites, 182 PASS assertions

| Suite | Assertions |
| ----- | ---------- |
| `verify_fresh_deploy` | 6 |
| `verify_golden_path` | 14 |
| `verify_rls_cross_portal` | 18 |
| `verify_menu_cutover` | 9 |
| `verify_downstream_wiring` | 8 |
| `verify_authorization_matrix` | **520 checks** (reported as one aggregate) |
| `verify_special_period` | 1 |
| `verify_class_staff` | 3 |
| `verify_kitchen_demand` | 2 |
| `verify_correction_order` | 12 |
| `verify_publish_future` | 3 |
| `verify_db_boundary` | 51 |
| `verify_note_privacy_and_states` | 40 |
| `verify_slot_resize_concurrency` | 5 |
| `verify_publish_record_race` | **NEW** — 7 |
| `verify_analytics_volume` | **NEW** — 3 |

**Authorization matrix: 520 checks, all PASS** (was 498; coverage grew, the
number was not a target).

**Mutation evidence — each newly added security/integrity assertion was broken
deliberately to prove it can fail:**

| Mutation | Result |
| -------- | ------ |
| Remove `FOR UPDATE` from `publish_meal_services`'s history check | `verify_publish_record_race` **r4 FAILS** |
| Remove the parent-row lock from `guard_rotation_slot_week()` | `verify_slot_resize_concurrency` **c3 FAILS** |
| Restore the table-wide `GRANT SELECT ON serving_records` | matrix **FAILS for all 11 roles** |
| Restore 0024's blanket `for all` meal-images policy | `verify_db_boundary` **item0037 FAILS** — "a Super Admin DELETED a meal image still referenced by a meal revision (1 rows)" |
| Add a permissive `for all` policy to `audit_log` | `verify_db_boundary` **audit FAILS** — "a client session REWROTE an audit entry (1 rows)" |
| Drop the `path: 'menu-builder'` override from the nav entry | `authorization.consistency.test.ts` **FAILS** — "super_admin -> /menubuilder" |

### Frontend logic — 110/110 unit tests (11 files)

`mealAnalytics` (22), `format` (15), `calendar` (14), `rbac` (13),
`parent/shared` (12), `authorization.consistency` (11 — archive-only entities
plus the new nav-link/route reachability check), `completion` (**new**, 9
— the four factual states and scored-weighting), `pagination` (**new**, 5 — past
the retired 5,000-row cap), `kitchen` (3), `status` (3).

### Build gates

`pnpm typecheck` PASS — app **+ node + `tests/e2e`** · `pnpm lint` PASS
(0 warnings) · `pnpm build` PASS · `wrangler deploy --dry-run` PASS (config
validation only — no upload, no deploy).

### E2E — 19 tests across 6 specs: 0 executed, 19 BLOCKED_BY_ENVIRONMENT

`login.roles` (2), `serving` (4), `parent-portal` (3), `rls` (4), `schedule` (3),
`status` (3). None executed: there is no approved non-production Supabase
project, and this sandbox blocks `*.supabase.co`. **No spec skips for any other
reason** — the two that previously would have (child-switch needing a second
child; the no-published-meal test that only checked the page loaded) are fixed
in items 16 and 17.

---

## 3. The twenty items

| # | Correction | Evidence |
| - | ---------- | -------- |
| 1 | Raw planning tables (service plans, rotation assignments, calendar exceptions) are Super-Admin-only | matrix planning counts flipped to Super-only; `verify_rls_cross_portal` now **seeds real planning rows first**, so every zero is a refusal |
| 2 | Weekly schedule columns derive from that institution's published services; `/schedule` added to the page-title map | InstitutionSchedulePage; a three-meal institution shows three columns |
| 3 | Four factual completion states; closures excluded from attention; 60/80% bands removed; unauthorized demand call dropped | `completion.test.ts` — closure, not started, partial, complete |
| 4 | Combined average weighted by `scored_observations` | `completion.test.ts` — behaviour-only rows no longer skew it |
| 5 | Guardian UNLINK removed for every client; LINK retained | matrix `student_parents.DELETE` DENIED × 11; `verify_db_boundary` b3 |
| 6 | School Admin sees a linked Parent's identity — not an unlinked one, not another institution's, not a directory | `verify_note_privacy_and_states` i6a–i6e |
| 7 | Kitchen master data closed to every role but Super Admin and the owning Kitchen | matrix `kitchens.SELECT count` × 11 |
| 8 | Production Demand limited to Super Admin + Kitchen | matrix `meal_production_demand() rows` × 11 |
| 9 | Unpublished Classroom free text closed to School Admin | i9a–i9c, with a **real unpublished note** |
| 10 | A low-intake reason is optional again — "Save · no reason" completes 0/25% | TodayPage |
| 11 | Role-correct navigation and copy across the confirmed inconsistencies | RBAC-gated links; `rbac.test.ts` |
| 12 | Interim `medical_notes` terminology retired from active UI and code | build; grep-clean |
| 13 | Publish↔record serialization | r1–r4, **r4 mutation-proven** |
| 14 | Silent 5,000-row analytics cap replaced by exhaustive pagination | `pagination.test.ts`; `verify_analytics_volume` proves 6,000 rows average to exactly 83.3% where a capped read said 100% |
| 15 | Exceptions are never preference evidence, including grandfathered rows | i15 — a pre-constraint ABSENT+REFUSED row, reproduced by dropping the NOT VALID constraint, counts as an exception and not a refusal, at meal AND revision level |
| 16 | Two authorized children seeded with opposite outcomes; child-switch spec no longer skips | `parent-portal.spec.ts` |
| 17 | No-published-meal spec exercises the real negative condition | `serving.spec.ts` |
| 18 | README / BUILD_STATUS / RELEASE_GATE / PRODUCTION_APPLY regenerated (now 0037, 107 tests, 16 suites) | docs |
| 19 | Decision Log: `menu_item_id` marked SUPERSEDED for new operations (historical data kept); future-republish rule and the approved Institution schedule recorded | 13_DECISION_LOG |
| 20 | Deploy requires a backend-readiness attestation naming the applied migration | deploy.yml |

---

## 4. The closure sweep — verify first, change only on proof

The order was to re-examine the whole system and change something only where a
real defect could be demonstrated. Fourteen areas were swept. **Two produced a
reproducible defect; both are fixed and mutation-proven. Twelve did not, and
were deliberately left alone** — the temptation in a sweep like this is to
"improve" working code, which is how a frozen candidate acquires unreviewed
risk.

### Defects proven and closed

**A. A meal image referenced by a historical Meal Revision could be destroyed.**
Migration 0024 granted the Super Admin `for all` on the `meal-images` bucket
with no reference guard. Reproduced before any fix was written: the DELETE
removed the object while the revision kept pointing at it, so every past
published Meal Service using that meal — and every Parent looking at what their
child was actually served last term — resolved to nothing. The UPDATE half is
quieter and worse: `upload(path, { upsert: true })` over an existing path leaves
the reference intact while the picture behind it becomes a different meal, so
nothing looks broken.

Migration **0037** makes a referenced object immutable, matching the rule Meal
Revisions already follow. An **unreferenced** upload stays disposable, and a
control assertion proves that — otherwise these tests would also pass if the
bucket were simply frozen, which is not the rule being tested.

Honest limit: the guard resolves the reference through a SECURITY DEFINER
helper, because storage policies run as the caller and `meal_revisions` is
RLS-protected. With only the Super Admin holding write authority in this bucket
today, that detail is defence in depth — the suite does not currently
discriminate it, and this report does not claim it does.

**B. The Menu Builder sidebar link pointed at a route that does not exist.**
`NavItem.page` carried two meanings at once — the RBAC resource id *and* the URL
segment. They diverge for exactly one entry: resource `menubuilder`, route
`/menu-builder`. The sidebar rendered `to="/menubuilder"`, no `<Route>` matched,
and the catch-all bounced the Super Admin to the dashboard. The only sidebar
entry point to the Menu Builder did nothing at all; the topbar also showed
"Dashboard" on `/menu-builder`, and the sidebar item never highlighted.

`NavItem` now carries an optional `path` distinct from the resource id. The
existing consistency suite could never have caught this — it compares resource
ids to resource ids — so the new test reads `App.tsx` and asserts every sidebar
link for every role resolves to a route the router actually declares.

### Swept, verified, and deliberately not changed

| Area | Finding |
| ---- | ------- |
| Auth / identity | No self-escalation path; role and institution locked at the DB boundary (0033). Unchanged. |
| Tenant isolation | Cross-institution reads and writes refused from the referenced side as well as the referencing side (0032/0033). Unchanged. |
| Database privileges | `serving_records` column-list grant holds; the raw path is closed; matrix covers all 11 roles × resources × actions. Unchanged. |
| Historical truth — records | No hard delete of Students, Classes, Institutions, Meals, Menus, Kitchens or serving history; legacy notes archived, never destroyed (0034). Unchanged. |
| Historical truth — images | **Defect A above.** Fixed in 0037. |
| Auditability | `audit_log` is already unforgeable and untamperable from every client session, including the Super Admin. Nothing was broken — but it was **unasserted**, so three assertions were added. No behaviour change. |
| Configuration determinism | Effective-dated planning saves are deterministic; 0033 refuses to apply against ambiguous duplicate rows rather than guessing. Unchanged. |
| Classroom states | The complete approved state semantics hold on both the RPC and raw paths (0035); grandfathered rows are excluded from preference evidence, not rewritten. Unchanged. |
| Parent | Child-switch readiness invariant holds in the render path; published notes only; no free text leaks. Unchanged. |
| Nursery / School Admin | Planning, Kitchen master data, Production Demand and unpublished free text all closed this pass (items 1, 7, 8, 9). Unchanged since. |
| Kitchen | Aggregates by `meal_revision_id`; demand limited to Super Admin + Kitchen. Unchanged. |
| Analytics | One-truth views; exceptions never counted as preference; scored-observation denominator; exhaustive pagination proven at 6,000 rows. Unchanged. |
| Dormant / legacy surfaces | Legacy `menus` read-only; `MenuPage` removed; `serving_records.note` closed; `enrollment_status` out of the active UI. No new dormant surface found. Unchanged. |
| Test quality | Every concurrency case is labelled by whether it discriminates; the non-discriminating ones (r2, r3, c2) are named as such rather than counted as coverage. Unchanged. |
| Documentation | Regenerated to `0037` / 107 tests / 16 suites / 182 assertions. |

---

## 4b. Release-layer cleanup (pass on top of the closure sweep)

Three narrow items, all confirmed before being changed. No application logic,
no migration, no spec rule touched.

**1. The Cloudflare assets binding was missing — CONFIRMED.**
`worker/worker.ts` calls `env.ASSETS.fetch(request)` for every path outside
`/api/`, i.e. the whole site, but `wrangler.jsonc` declared the assets
*directory* without the `binding` that actually exposes the asset server to the
Worker. Proven twice offline before the fix: `wrangler types` generated an `Env`
with no `ASSETS` member, and `wrangler deploy --dry-run` printed no bindings
section at all. After the fix the same dry run prints `env.ASSETS  Assets`.
Routing is untouched — `directory` and `not_found_handling:
single-page-application` are unchanged, so direct asset delivery and SPA
deep-link fallback behave exactly as before.

Why the existing gate missed it: `worker.ts` declares its own local
`interface Env { ASSETS: Fetcher }`, which **asserts** the binding rather than
deriving it from the config. TypeScript believed the assertion; the runtime
would not have. `src/lib/worker.config.test.ts` now cross-checks the two files.

**2. An explicit production deploy could report success having shipped nothing
— CONFIRMED.** Missing Cloudflare credentials emitted a `::warning::` and
skipped the deploy step through an `if:` guard. A skipped step does not fail a
job, so the release run finished green. Now a missing token or account id is a
hard failure, the deploy step carries no `if:` guard so a wrangler failure fails
the job, and a final `always()` step asserts the deploy actually reported
success. Triggers are unchanged: an ordinary branch push still deploys nothing.

**3. Two stale documentation lines — CONFIRMED.** `PACKAGE_MANIFEST` still
instructed applying `0001 → 0036`; the stack is `0001`–`0037`. `14-RELEASE_GATE`
listed five E2E specs and omitted `schedule` entirely, so a verifier could have
signed off without ever noticing the read-only published-menu surface was
untested. Historical passages naming `0036` as a specific migration are accurate
and were deliberately left alone.

| Mutation | Result |
| -------- | ------ |
| Delete `"binding": "ASSETS"` from `wrangler.jsonc` | `worker.config.test.ts` **FAILS** — `expected [ 'ASSETS' ] to deeply equal []` |

Item 2 is a CI-workflow change and is not unit-testable here; it was validated
by parsing the workflow and confirming the deploy step carries no `if:` guard,
no `continue-on-error`, and that the triggers remain `workflow_dispatch` + `v*`.

---

## 5. BLOCKED_BY_ENVIRONMENT

- **All 19 Playwright tests** — 6 specs: `login.roles` (2), `serving` (4),
  `parent-portal` (3), `rls` (4), `schedule` (3), `status` (3). **0 executed,
  19 blocked, 0 skipped for any other reason.** Specs, fixtures and the bundle-build wiring are
  in place and type-checked, but execution needs an approved non-production
  Supabase project and egress to it. This sandbox has neither, and production is
  refused by the seeder, by `build:e2e` and by CI. No external environment was
  created. This is not reported as PASS.

## 6. BLOCKED_BY_SPEC (not invented)

Institution access to Kitchen Production; the normal reviewer/internal-note
visibility beyond the Super Admin override; guardian UNLINK/removal semantics;
Meal-performance classification thresholds; a mandatory low-intake reason at
0%/25%; a mandatory eating behaviour; the structured child Allergy/Dietary model
(§42); retention / deletion / archive policy; Parent association & provisioning;
account editing/deactivation; cross-institution Student/Class transfer;
per-institution timezones; production lock before serving;
Packing/Dispatch/Delivery; multi-kitchen routing.

## 7. Production — unchanged; nothing pushed

Migrations `0021`–`0037` are not applied. `scripts/PRODUCTION_APPLY.md` remains
ledger-first: inspect the production migration ledger, then apply only the
versions missing from it — never replay an applied version because the file
still exists. The frontend deploy now additionally refuses to run without a
backend-readiness attestation. This candidate is committed locally and frozen
for independent review.
