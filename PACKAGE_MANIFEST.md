# LunchBox Connect — Package Manifest

**Packaged:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `222d32b`
**Package identity:** the ZIP is named `lunchbox-connect-222d32b.zip`, and this
manifest and `docs/VERIFICATION_FINAL.md` both reference `222d32b`. The manifest
and the regenerated report are committed as a thin packaging layer on top of
`222d32b` (that is the commit whose code they describe); the archive contains
that layer so the delivered docs are the current ones.

The identity moved from `0f63ec7` because the release-layer pass changed the
EXECUTABLE tree — the Cloudflare assets binding and the deploy workflow — not
just documentation. A configuration change that decides whether the site serves
at all is a code change, so it gets its own hash.

---

## 1. Build status — actual command output

All gates were run immediately before packaging.

| Gate | Command | Result |
| ---- | ------- | ------ |
| Types | `pnpm typecheck` | **PASS** — app + node + `tests/e2e`, no errors |
| Lint | `pnpm lint` | **PASS** — no errors, no warnings |
| Unit tests | `pnpm test:unit` | **PASS — 116** across 12 files |
| Production build | `pnpm build` | **PASS** |
| Worker config | `wrangler deploy --dry-run` | **PASS** — prints `env.ASSETS  Assets`; no upload, no deploy |
| Database suites | `./tests/sql/run_verification.sh` | **PASS — 18 suites**, 196 named assertions + the 520-check authorization matrix |

Unit files: `mealAnalytics.test.ts` (22), `api.errors.test.ts` (6, the
PostgrestError shape and the "[object Object]" regression), `format.test.ts` (15, Asia/Dubai
boundary and presentation), `calendar.test.ts` (14), `rbac.test.ts` (13, incl.
the read-only `schedule` resource), `pages/parent/shared.test.ts` (12, the
child-switch selection/readiness invariant and the request guard),
`authorization.consistency.test.ts` (11 — archive-only entities, and the
nav-link/route reachability check that catches a sidebar link pointing at a
route the router never declares),
`completion.test.ts` (9, the four factual dashboard states + the
scored-observation-weighted average), `pagination.test.ts` (5, exhaustive
analytics paging past 5,000 rows), `kitchen.test.ts` (3), `status.test.ts` (3), `worker.config.test.ts` (3 — the
Worker's runtime bindings must be DECLARED in `wrangler.jsonc`, not merely
asserted by the Worker's own local `interface Env`).

**Not run in this sandbox:** `pnpm test:e2e` (Playwright, 6 specs / **27**
tests — the figure was recorded as 19 until the suite was executed; `login.roles`
parameterises over the nine roles). This sandbox blocks `*.supabase.co` and the
container registries, so the suite runs on GitHub Actions instead
(`.github/workflows/e2e-local-supabase.yml`), against an ephemeral Supabase
stack started on the runner. That target is `127.0.0.1`; the production project
is refused outright by the seeder, by `build:e2e` and by the workflow's own
guard.

## 2. Database verification

`./tests/sql/run_verification.sh` builds a PostgreSQL 16 cluster from nothing,
applies `supabase/migrations/0001`–`0041` verbatim, and runs 18 suites. Each
suite is mutation-tested (deliberately broken to prove it can fail).

Per-suite named assertions: `db_boundary` 51 · `note_privacy_and_states` 40 ·
`rls_cross_portal` 18 · `golden_path` 14 · `correction_order` 12 ·
`menu_cutover` 9 · `downstream_wiring` 8 · `publish_record_race` 7 ·
`insert_returning` 7 ·
`fresh_deploy` 6 · `slot_resize_concurrency` 5 · `class_staff` 3 ·
`publish_future` 3 · `analytics_volume` 3 · `kitchen_demand` 2 ·
`special_period` 1 · `super_admin_onboarding` 7 — **196 total**, plus `authorization_matrix`, which reports a
single aggregate line covering **520 role×resource×action checks**.

New in this release: `verify_publish_record_race` (a REAL second session via
dblink proving publishing and classroom recording serialize against each other,
and that a served Meal Service can no longer have its revision swapped
underneath an in-flight observation) and `verify_analytics_volume` (6,000
observations proving the retired 5,000-row cap is gone — the average reads
exactly 83.3% where a capped read would say 100%).

The closure sweep on top of that release added `verify_db_boundary`
assertions for the two areas it examined most closely: a meal image referenced
by any Meal Revision can no longer be deleted or overwritten (an unreferenced
upload still can — a control assertion proves the bucket is reference-guarded,
not frozen), and an `audit_log` entry cannot be forged, rewritten or deleted
from any client session.

Mutation evidence and the honest limits of each concurrency case — including
which cases do **not** discriminate because a foreign key's own lock already
blocks there — are in **`docs/VERIFICATION_FINAL.md`**, whose section 4 also
records the twelve areas that were swept, verified and deliberately left
unchanged.

## 3. What is in the archive

Everything required to build and run the project, excluding only §5.

- **`src/`** — React/Vite/TypeScript app: `App.tsx`, `components/`, `lib/`
  (api incl. exhaustive pagination, rbac, roles, auth, mealAnalytics,
  completion, calendar, types, …), `pages/` (admin/nursery/kitchen incl.
  `StaffPage`, `MealLibraryPage`, `MenuBuilderPage`, `InstitutionServiceTab`,
  `InstitutionCalendarTab`), `pages/parent/` (mobile parent portal), and
  `InstitutionSchedulePage` — the Founder-approved READ-ONLY published-menu
  view for a Nursery/School Admin. The retired legacy `MenuPage` is gone.
- **`supabase/`** — `migrations/0001`–`0041` (schema, RLS, resolution/publish
  engine, meal library RPCs, class_staff, per-meal demand, analytics one-truth,
  the integrity pass 0029/0030/0031, the tenant-integrity + permission
  correction 0032, the client-boundary lockdown 0033, the note-privacy /
  state-validity / atomicity pass 0034, the record-state-semantics +
  slot/resize locking pass 0035, the boundary-closure +
  publish/record-serialization pass 0036, the historical immutability of
  referenced meal images 0037, the role merge 0038, and the restoration of
  `security_invoker` on the dashboard/analytics views 0039);
  `functions/admin-create-user/`; `config.toml`.
- **`tests/`** — `sql/` (16 `verify_*.sql` suites + shim + actors + runner),
  `e2e/` (6 Playwright specs + fixtures + global-setup, on the current chain,
  type-checked by `tsconfig.e2e.json`).
- **`docs/`** — the spec pack, `VERIFICATION_FINAL.md`, `VERIFICATION_DECISION_033.md`.
- **`remediation/`** — separated, review-gated production scripts + README.
- **Config / deploy** — `package.json`, `pnpm-lock.yaml`, `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`,
  `eslint.config.js`, `.prettierrc`, `wrangler.jsonc`, `worker/`,
  `.github/workflows/` (ci + deploy, incl. the backend-readiness gate),
  `index.html`, `README.md`, `scripts/PRODUCTION_APPLY.md`,
  `scripts/build-e2e.mjs`, `.env.example`.
- **`CLAUDE_CODE_GOLIVE.md`** — **retired stub** pointing to
  `scripts/PRODUCTION_APPLY.md`; do not follow the old runbook (it is gone).

## 4. Assets

No binary image assets. Icons are inline SVG (`src/components/icons.tsx`), the
logo is CSS-rendered, Inter loads from Google Fonts. Student and meal photos are
uploaded at runtime into private Supabase Storage buckets, not shipped files.

## 5. Deliberately excluded

| Excluded | Why |
| -------- | --- |
| **`.env`** | Holds `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. Never packaged. Copy `.env.example`. |
| `node_modules/` | Reinstall with `pnpm install` (`pnpm-lock.yaml` pins versions). |
| `dist/` | Build output; regenerate with `pnpm build`. |
| `.git/` | History is on the branch above. |

The only key present anywhere in the tree is the **public anon key** (in
`.env.example` and the deploy workflow), which is public by design — RLS, not
secrecy, is the boundary.

## 6. Running it

```bash
pnpm install
cp .env.example .env      # fill in your Supabase URL + anon key
pnpm dev                  # http://localhost:5173
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build
./tests/sql/run_verification.sh
```

Migrations apply in numerical order, `0001` → `0041`. For production, follow
`scripts/PRODUCTION_APPLY.md` (schema first, then deploy + verify the
`admin-create-user` Edge Function; service plans / rotation assignments /
publishing are Admin-UI actions, never migration side effects). The frontend
deploy workflow now **refuses to run** until `BACKEND_READY_MIGRATION` attests
that production holds at least the newest migration in this repository.

## 7. Honest status — what is NOT finished (BLOCKED_BY_SPEC)

Account editing / deactivation and self-profile mutation of security identity;
Nursery/School Admin classroom recording; the free-text note review/publication
workflow (who / process / conditions); Parent association & provisioning /
email-delivered self-activation; guardian UNLINK (removed this pass — no spec
defines it); cross-institution Student/Class transfer; retention / archive /
deletion semantics; the structured StudentAllergy/StudentDietaryRestriction
taxonomy (§42); production-lock policy beyond the served-records boundary;
Packing/Dispatch/Delivery state machine; expected-vs-actual quantities;
multi-kitchen routing; per-institution timezones. Deliveries, Ops and Absences
remain honest `NOT_YET_DEFINED` shells. This pass **removed** authorities that
existed without a defining spec rather than inventing more. Nothing has been
applied to the production database in this pass.

> ⚠️ **Applying to production:** read the production migration ledger first and
> apply only the versions missing from it. Migration `0033` deliberately
> **stops** if production already holds two service-plan or rotation-assignment
> rows for the same institution and effective date — it names them rather than
> guessing which one wins. Migration `0034` **archives** every historical
> `serving_records.note` value into `serving_record_note_archive` before
> clearing the column: nothing is destroyed, and the archive is the record of
> what was written. Migrations `0035` and `0036` add their record-state and
> boundary constraints as `NOT VALID`, so pre-existing history is grandfathered
> and never rewritten.
