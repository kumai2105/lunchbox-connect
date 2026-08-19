# LunchBox Connect — Final Correction-Order Verification

**Date:** 2026-08-19
**Branch:** `claude/new-session-k5dd5u`
**Verified at:** `f6406eb` (*Stage 9 — remove vestigial architecture*). This
document is committed on top of that commit; every result below was produced
against that tree.
**Method:** every result is **executed**, not inspected. Database checks ran
against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0028` applied verbatim through the Supabase shim;
frontend logic ran in the Vitest unit suite; the production bundle was built
and type-checked. No result here rests on "should work."

Reproduce: `./tests/sql/run_verification.sh` then
`pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here · `NOT_RUN` not attempted.

---

## 1. Decision

**Codebase (this branch): APPROVED.** The repository, migrations, UI, backend
and tests now describe **one** architecture: reusable Meals + Menus on a
data-sized rotation, per-institution service configuration and calendar
exceptions set through the Admin UI, multi-staff-per-class authorization, and
a single meal-identity source of truth for Kitchen, Parent and management
analytics. The legacy per-weekday `menus`/publish path is retired, not merely
unused.

**Live production database: NOT modified in this pass.** The only production
change made in this session was the **revert you approved** — it removed the
unapproved service-plans, rotation assignments and mass-published services
and confirmed the resolver leak was closed. The corrected planning migrations
**`0021`–`0028` are NOT applied to production**; that application is
deliberately deferred to you, per your standing "no production changes yet"
instruction. See §6.

---

## 2. What was executed and passed

### Database — 9 suites, all PASS, mutation-tested non-vacuous

| Suite | Scope | Checks |
| ----- | ----- | ------ |
| `verify_fresh_deploy` | A migrations-only database with no legacy `menus` builds cleanly and auto-creates no rotation/plan/publish | 6/6 PASS |
| `verify_golden_path` | Institution→Student→Eligibility→Meal→Rotation→Calendar→Service Plan→Meal Service→Demand→Classroom→Parent→Analytics | 15/15 PASS |
| `verify_rls_cross_portal` | Every portal re-reads the same record under its own RLS; parent/teacher/kitchen/driver/school-admin isolation | 16/16 PASS |
| `verify_menu_cutover` | Legacy menu → rotation engine; the seven-week-freeze regression; idempotent backfill | 10/10 PASS |
| `verify_downstream_wiring` | Kitchen/Parent read dated published services; Classroom write persists the Meal Service link; **§31 one-truth: a service-based observation reaches `v_meal_performance`** | 9/9 PASS |
| `verify_authorization_matrix` | Roles × every write-sensitive table, append-only rows-affected, resolver-RPC lockdown | **146/146 PASS** |
| `verify_special_period` | Multi-week special-period rotation resolves its week from period alignment (§37) | 1/1 PASS |
| `verify_class_staff` | Multi-staff-per-class scope (§16): both assigned staff see the child; unassigned sees zero; recording follows membership | 3/3 PASS |
| `verify_kitchen_demand` | Per-meal production quantities (§34); service days come from publication, not a weekend rule (§35) | 2/2 PASS |

Every suite is proven capable of failing: deliberate mutations (open an INSERT
policy, add an UPDATE policy to append-only `meal_revisions`, stub a resolver
to `true`, drop the write-path link, size the rotation wrong, join analytics
on the retired column) each produce the expected FAIL and were reverted.

### Frontend logic — unit suite, 55/55 PASS (6 files)

`calendar` (14), `mealAnalytics` (13, incl. §30/§31 group-by-meal preference),
`rbac` (11), `authorization.consistency` (8), `format` (6, incl. the isoWeek
weekly-advance regression), `status` (3).

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS
(118 modules, clean bundle).

---

## 3. Correction-order coverage (this session)

| Area | Change | Evidence |
| ---- | ------ | -------- |
| §16/§17 Multi-staff per class | `class_staff` join + RLS; 5 auth helpers rewired to membership; Admin invite + assignment UI; `teacher_id` no longer read by the app | `verify_class_staff`, `verify_authorization_matrix`, typecheck |
| §1/§52 Configure through the app | Meal Library, Menu Builder, per-institution Service and Calendar tabs; rotation/plan/publish set via UI RPCs, not migrations | build, `verify_fresh_deploy` (migrations infer nothing) |
| Calendar exceptions | closure/override/special_period add/list/delete; special-period multi-week resolution | `verify_special_period`, `verify_golden_path` |
| Legacy menu retirement | `MenuPage`/`publishMenuWeek`/`publish_menu_week` removed; `menus` marked historical; dead `MenuItem` type deleted | grep-clean, build |
| §33/§34/§35 Kitchen | per-meal demand RPC; date picker; no weekend hardcode | `verify_kitchen_demand`, `verify_downstream_wiring` |
| §26/§28/§29 Parent | applicable-period denominator; tap-to-detail meal modal; recent-days history | unit (`mealAnalytics`), build |
| §23/§39/§41 Nursery scoping / UI-permission match | eligibility gate on `operational_status`; `Institution.kind` nursery/school; create buttons gated on `can()` | `verify_golden_path`, `rbac`, build |
| §31 Analytics one truth | `v_meal_performance` aggregates by Meal via `meal_service_id`; retired week/weekday columns dropped | `verify_downstream_wiring` §31 assertion |
| §24/§25 Classroom | internal notes (no forced family publish); OTHER reason without forced concern | build |
| Closure requirement | obsolete architecture removed, not left unused; this report + `scripts/PRODUCTION_APPLY.md` regenerated from the final tree | this document |

---

## 4. BLOCKED_BY_ENVIRONMENT (cannot execute in this session)

- **Authenticated / networked in-browser flows.** The app authenticates
  against GoTrue on `*.supabase.co`, which the sandbox egress policy blocks
  (TLS CONNECT refused). The production bundle builds and serves (HTTP 200
  locally), but any screen that loads or writes data cannot complete its
  round-trip here, so DOM-level interaction is **NOT_RUN**. The data layer
  those screens call is proven at the database layer above.
- **All 5 Playwright E2E specs** (`login.roles`, `parent-portal`, `rls`,
  `serving`, `status`) — same egress blocker; runnable where the sandbox can
  reach Supabase.
- **Re-reading live production this pass** — the Supabase MCP connector needs
  an OAuth step that is non-interactive in this session.

## 5. BLOCKED_BY_SPEC (not invented)

- **StudentAllergy / StudentDietaryRestriction taxonomy (§42):** the entities
  exist in the spec but fields, severity scale, and approval workflow are
  `NOT_YET_DEFINED`. Clinical data is not invented; the app surfaces the
  authoritative record and directs allergy changes to the nursery.
- **Packing / Dispatch / Delivery state machine**, expected-vs-actual quantity
  stages, **multi-kitchen routing** (no institution→kitchen mapping in spec),
  production lock/cutoff, retention/deletion policy. Deliveries / Ops /
  Absences remain declared placeholders that state this on screen.

## 6. Production — status and the one coupling to sequence

**Applied to production this session (with your approval):** the revert. It
removed the unapproved service plans, rotation assignments, and
mass-published services, and left the resolver leak closed. No business data
was invented or published.

**NOT applied to production:** migrations `0021`–`0028` (planning-RLS
tightening, special-period fix, dashboard KPI, meal-library RPCs, class_staff,
legacy-publish retirement, per-meal demand, analytics one-truth). Applying
them is your decision and has not been done from here.

**Deploy coupling to be aware of before go-live:** `.github/workflows/deploy.yml`
builds and deploys the **frontend** to Cloudflare on every push to this branch
(when the `CLOUDFLARE_*` repo secrets are set). The corrected frontend expects
the `0021`–`0028` schema. **Sequence the database migration before — or
together with — the frontend deploy**, or the live app will call RPCs/tables
that production does not yet have. Nothing here has been pushed to trigger a
deploy without that sequencing being your call.
