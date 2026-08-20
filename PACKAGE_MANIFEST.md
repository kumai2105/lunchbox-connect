# LunchBox Connect — Package Manifest

**Packaged:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `41a2000`
**Package identity:** the ZIP is named `lunchbox-connect-41a2000.zip`, and this
manifest and `docs/VERIFICATION_FINAL.md` both reference `41a2000`. The manifest
and the regenerated report are committed as a thin packaging layer on top of
`41a2000` (that is the commit whose code they describe); the archive contains
that layer so the delivered docs are the current ones.

---

## 1. Build status — actual command output

All gates were run immediately before packaging.

| Gate | Command | Result |
| ---- | ------- | ------ |
| Types | `pnpm typecheck` | **PASS** — no errors |
| Lint | `pnpm lint` | **PASS** — no errors, no warnings |
| Unit tests | `pnpm test:unit` | **PASS — 66/66** across 7 files |
| Production build | `pnpm build` | **PASS** — 120 modules |
| Database suites | `./tests/sql/run_verification.sh` | **PASS — 12 suites** (incl. the 401-check authorization matrix) |

Unit files: `calendar.test.ts` (14), `mealAnalytics.test.ts` (16),
`rbac.test.ts` (11), `format.test.ts` (10, incl. Asia/Dubai boundary),
`authorization.consistency.test.ts` (9), `kitchen.test.ts` (3, revision
grouping), `status.test.ts` (3).

**Not run:** `pnpm test:e2e` (Playwright) — the suite needs egress to
`*.supabase.co`, which this sandbox blocks, and an approved NON-PRODUCTION
Supabase project (it refuses the production project outright). The specs are
included, written to the current architecture, and runnable where both exist.

## 2. Database verification

`./tests/sql/run_verification.sh` builds a PostgreSQL 16 cluster from nothing,
applies `supabase/migrations/0001`–`0033` verbatim, and runs 12 suites. Each
suite is mutation-tested (deliberately broken to prove it can fail). This pass
expands the authorization matrix from 146 to **401** checks (the UPDATE/DELETE
and read paths it previously skipped) and adds referenced-side + client-boundary
negatives to `verify_db_boundary`. Full report and the release decision:
**`docs/VERIFICATION_FINAL.md`**.

## 3. What is in the archive

Everything required to build and run the project, excluding only §5.

- **`src/`** — React/Vite/TypeScript app: `App.tsx`, `components/`, `lib/`
  (api, rbac, roles, auth, mealAnalytics, calendar, types, …), `pages/`
  (admin/nursery/kitchen incl. `StaffPage`, `MealLibraryPage`,
  `MenuBuilderPage`, `InstitutionServiceTab`, `InstitutionCalendarTab`),
  `pages/parent/` (mobile parent portal). The retired legacy `MenuPage` is gone.
- **`supabase/`** — `migrations/0001`–`0033` (schema, RLS, resolution/publish
  engine, meal library RPCs, class_staff, per-meal demand, analytics one-truth,
  the integrity pass 0029/0030/0031, the tenant-integrity + permission
  correction 0032, and the client-boundary lockdown 0033);
  `functions/admin-create-user/`; `config.toml`.
- **`tests/`** — `sql/` (12 `verify_*.sql` suites + shim + actors + runner),
  `e2e/` (5 Playwright specs + fixtures + global-setup, on the current chain).
- **`docs/`** — the spec pack, `VERIFICATION_FINAL.md`, `VERIFICATION_DECISION_033.md`.
- **`remediation/`** — separated, review-gated production scripts + README.
- **Config / deploy** — `package.json`, `pnpm-lock.yaml`, `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`,
  `eslint.config.js`, `.prettierrc`, `wrangler.jsonc`, `worker/`,
  `.github/workflows/` (ci + deploy), `index.html`, `README.md`,
  `scripts/PRODUCTION_APPLY.md`, `.env.example`.
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

Migrations apply in numerical order, `0001` → `0033`. For production, follow
`scripts/PRODUCTION_APPLY.md` (schema first, then deploy + verify the
`admin-create-user` Edge Function; service plans / rotation assignments /
publishing are Admin-UI actions, never migration side effects).

## 7. Honest status — what is NOT finished (BLOCKED_BY_SPEC)

Account editing / deactivation and self-profile mutation of security identity;
Nursery/School Admin classroom recording; the free-text note review/publication
workflow (who / process / conditions); Parent association & provisioning /
email-delivered self-activation; cross-institution Student/Class transfer;
retention / archive / deletion semantics; the structured
StudentAllergy/StudentDietaryRestriction taxonomy (§42); production-lock policy
beyond the served-records boundary; Packing/Dispatch/Delivery state machine;
expected-vs-actual quantities; multi-kitchen routing; per-institution timezones.
Deliveries, Ops and Absences remain honest `NOT_YET_DEFINED` shells. This pass
**removed** authorities that existed on the raw path without a defining spec
rather than inventing more. Nothing has been applied to the production database
in this pass.

> ⚠️ **Applying to production:** read the production migration ledger first and
> apply only the versions missing from it. Migration `0033` deliberately
> **stops** if production already holds two service-plan or rotation-assignment
> rows for the same institution and effective date — it names them rather than
> guessing which one wins.
