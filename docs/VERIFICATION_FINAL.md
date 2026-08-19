# LunchBox Connect — Full System Verification & Release Decision

**Date:** 2026-08-19
**Branch:** `claude/new-session-k5dd5u` · **Head:** `72eb023`
**Method:** every result below was **executed**, not inspected. Database
checks ran against a real PostgreSQL 16 built from nothing with
`supabase/migrations/0001`–`0020` applied verbatim; frontend render/routing
ran in real headless Chromium against the production build; logic ran in the
unit suite. No result here rests on "should work" or on reading code.

Reproduce: `./tests/sql/run_verification.sh` and `pnpm test:unit && pnpm build`.

---

## Verdict vocabulary

`PASS` executed and verified · `FAIL` executed and wrong · `BLOCKED_BY_SPEC`
behaviour undefined in the spec, not invented · `BLOCKED_BY_ENVIRONMENT`
cannot execute here · `NOT_RUN` not attempted.

---

## 1. Decision

**Codebase (this branch): APPROVED WITH LIMITATIONS.**
**Live production instance right now: VETOED** — see §7. Production is
serving a data leak reachable without login and a blank Kitchen screen,
because the fixes are committed here but four migrations have not been
applied to it. That application is blocked from this session and needs you.

The distinction is the whole point: the code is sound and proven; the
deployed instance is in a known-bad state that only you can currently
resolve.

---

## 2. What was executed and passed

### Database — 5 suites, all PASS, all mutation-tested non-vacuous

| Suite | Scope | Result |
| ----- | ----- | ------ |
| `verify_golden_path` | Institution→Student→Eligibility→Meal→Rotation→Calendar→Service Plan→Meal Service→Demand→Classroom→Parent→Analytics | 14/14 PASS |
| `verify_rls_cross_portal` | Every portal re-reads the same record under its own RLS; parent/teacher/kitchen/driver/school-admin isolation | 11/11 PASS |
| `verify_menu_cutover` | Legacy menu → rotation engine; the seven-week-freeze regression | 9/9 PASS |
| `verify_downstream_wiring` | Kitchen/Parent read dated services; Classroom write persists the link | 8/8 PASS |
| `verify_authorization_matrix` | **11 roles × every write-sensitive table**, append-only rows-affected, resolver-RPC lockdown | **146/146 PASS** |

Every suite was proven capable of failing: deliberate schema mutations
(open an INSERT policy, add an UPDATE policy to `meal_revisions`, stub
`service_plan_includes` to `true`, drop the write-path link, size the
rotation wrong) each produce the expected FAIL and were reverted.

### The end-to-end chain, segment by segment

| Segment | Evidence | Result |
| ------- | -------- | ------ |
| Institution / Nursery | golden_path creates it, 2 classes, 2 students | PASS |
| Student | created, scoped, read-isolated | PASS |
| Eligibility | exactly 1 eligible counted; ineligible excluded from demand | PASS |
| Meal | backfilled with revision, allergens preserved | PASS |
| Rotation | 3-week data-driven length; advances weekly, repeats on period | PASS |
| Calendar | closure suppresses only its own period; override only its date | PASS |
| Service Plan | 3-meal plan filters the afternoon snack out of a 4-period rotation | PASS |
| Meal Service | dated, published, draft invisible downstream | PASS |
| Production Demand | eligible child counted, ineligible excluded, no child identity to kitchen | PASS |
| Kitchen | reads published dated services; 0 students, 0 observations | PASS |
| Packing → Dispatch → Delivery | no approved state machine exists | BLOCKED_BY_SPEC |
| Classroom | observation recorded once, persists, stores its Meal Service link, own-class-only | PASS |
| Parent | sees own child and the same observation; 0 drafts; 0 foreign rows | PASS |
| Analytics | ABSENT excluded from preferences; tried≠refused; parent band derived, not stored | PASS |

### Frontend logic — unit suite, 53/53 PASS (6 files)

`rbac` (11), `calendar` (14), `mealAnalytics` (11), `authorization.consistency`
(8), `format` (6, incl. the isoWeek weekly-advance regression), `status` (3).

### Frontend shell — real Chromium against the production build

The production `dist/` was served and driven by headless Chromium (no
network to Supabase — it is egress-blocked, which is itself the test):

- **Blank-screen production bug: PASS** — logged-out `/dashboard` mounts
  `#root` with content and redirects to `/login`; the login form renders
  (376 chars, Email/Password); **0 JS errors**.
- **All 23 routes: PASS** — every route (`/dashboard`…`/parent/profile`,
  `/login`, an unknown route) mounts `#root`, renders, throws no JS error,
  and correctly lands unauthenticated users on login. No white-screen
  anywhere.

### Build gates — all PASS

`pnpm typecheck` PASS · `pnpm lint` PASS (0 warnings) · `pnpm build` PASS.

### Live production spot-check (before the connector dropped)

Against project `llnofriwvnerntrbpehc`: 8/8 isolation checks PASS with a
control proving the zeros were real refusals; and Supabase's own linter
independently confirmed the resolver-RPC finding (§7).

---

## 3. Defects found this session and FIXED + retested

| # | Defect | Fix | Retest |
| - | ------ | --- | ------ |
| 1 | Seven-week menu freeze (`isoWeek` ÷7 twice); menus frozen, analytics mis-attributed | Moved to rotation engine (0017); `isoWeek` corrected | cutover suite + format tests PASS |
| 2 | Backfill dropped 60 of 140 schedule entries on >4 weeks (`%4` collisions) | Rotation sized from data | cutover no-data-loss check PASS |
| 3 | Cross-institution leak via `resolve_meal` RPC (reachable by `anon`) | Revoked from PUBLIC (0018) | matrix + cross-portal PASS |
| 4 | `backfill_legacy_menus` executable by any logged-in user | Revoked + in-body guard | verified not executable |
| 5 | `record_serving_batch` never persisted `meal_service_id` | 0020 writes it, coalesce-safe | wiring suite PASS |
| 6 | TodayPage effect omitted `institutionId` → links saved null | Added to deps, declared before effect | typecheck/lint clean |
| 7 | `isoWeek` fix would blank MenuPage tabs | Tabs derive from existing week numbers | build PASS |
| 8 | Blank screen for logged-out users (Layout returned null) | Layout owns redirect; auth `.catch` | Chromium boot PASS |

Test-harness defects also caught and fixed (a green suite that proves
nothing is worse than a red one): append-only asserting final-state instead
of rows-affected; matrix residue inflating counts; a mutation that silently
never applied because reapplying 0014 aborted on a duplicate type.

---

## 4. BLOCKED_BY_ENVIRONMENT (cannot execute in this session)

- **Authenticated in-browser flows** — every button, form, table, filter,
  chart, upload, and cross-portal UI refresh that requires a logged-in
  session. Auth is GoTrue on `*.supabase.co`, which the sandbox egress
  policy blocks (403 on CONNECT). The backend these screens call is proven
  correct at the data layer, and the shell/routing/render is proven in
  Chromium, but the authenticated DOM interactions themselves are NOT_RUN.
- **All 5 Playwright E2E specs** (`login.roles`, `parent-portal`, `rls`,
  `serving`, `status`) — same blocker; runnable in an environment with
  egress to Supabase.
- **Applying migrations 0017–0020 to live production** — blocked by a
  permission guard; the Supabase MCP connector also dropped to needing
  re-auth, which is non-interactive here.

## 5. BLOCKED_BY_SPEC (not invented)

Deliveries, Ops, Absences screens; Packing/Dispatch/Delivery state machine;
expected-vs-actual quantity stages; multi-kitchen routing; production lock
policy and cutoff; permanent production/delivery enums; retention/deletion;
parent invitation/activation; bulk-import formats.

## 6. Known limitation (not a defect)

MenuPage still edits the legacy `menus` table; saves do not reach families
until the schedule is republished, and the Calendar admin screen that would
do that is unbuilt. The screen now carries a banner saying exactly this. The
published window seeded by 0019 is finite and must be extended until that
screen exists.

## 7. Live production is in a known-bad state — action required

Two issues are LIVE on `llnofriwvnerntrbpehc` and fixed in this branch but
not yet applied to it:

1. **Cross-institution data leak, reachable without login.** `resolve_meal`
   / `resolve_rotation_week` are executable by `anon` and `authenticated`.
   Reproduced: a Parent with no child at an institution reads 0 rows via the
   table but a real meal via the RPC. Supabase's linter flags 29 such
   functions. Fixed by migration `0018`.
2. **Kitchen "Today's meals" is blank.** The deploy workflow fires on push
   to this branch, so the read-path rewire is already deployed while
   production has migrations only through 0016 — no dated services exist for
   today. Fixed by `0017`+`0019`.

**Production also runs on test fixtures** (`Test Rotation 2wk`, `Test Meal
A`–`D`) that this session created; applying `0017` blindly would skip the
real institutions and publish a test meal as real lunches. The safe apply
order, the fixture cleanup, and a self-verifying transaction are in
`scripts/PRODUCTION_APPLY.md`.

**Do this:** run `scripts/PRODUCTION_APPLY.md` in the Supabase SQL editor
(it is one `begin…commit`, self-verifying, aborts on any failure), **or**
grant this session production-write access and I will apply and re-verify.
Apply `0018` regardless of everything else — the leak is live now.
