# LunchBox Connect — Package Manifest

**Packaged:** 2026-08-20
**Branch:** `claude/new-session-k5dd5u`
**Release commit:** `a9c9e96`
**Package identity:** the ZIP is named `lunchbox-connect-a9c9e96.zip`, and this
manifest and `docs/VERIFICATION_FINAL.md` both reference `a9c9e96`. The manifest
and the regenerated report are committed as a thin packaging layer on top of
`a9c9e96` (that is the commit whose code they describe); the archive contains
that layer so the delivered docs are the current ones.

---

## 1. Build status — actual command output

All gates were run immediately before packaging.

| Gate | Command | Result |
| ---- | ------- | ------ |
| Types | `pnpm typecheck` | **PASS** — no errors |
| Lint | `pnpm lint` | **PASS** — no errors, no warnings |
| Unit tests | `pnpm test:unit` | **PASS — 58/58** across 6 files |
| Production build | `pnpm build` | **PASS** — 119 modules |
| Database suites | `./tests/sql/run_verification.sh` | **PASS — 11 suites** (incl. the 146-check authorization matrix) |

Unit files: `calendar.test.ts` (14), `mealAnalytics.test.ts` (16),
`rbac.test.ts` (11), `authorization.consistency.test.ts` (8), `format.test.ts`
(6), `status.test.ts` (3).

**Not run:** `pnpm test:e2e` (Playwright) — the suite needs egress to
`*.supabase.co`, which this sandbox blocks. The specs are included, rewritten to
the current architecture, and runnable in an environment with that egress.

## 2. Database verification

`./tests/sql/run_verification.sh` builds a PostgreSQL 16 cluster from nothing,
applies `supabase/migrations/0001`–`0030` verbatim, and runs 11 suites. Each
suite is mutation-tested (deliberately broken to prove it can fail). Full report
and the release decision: **`docs/VERIFICATION_FINAL.md`**.

## 3. What is in the archive

Everything required to build and run the project, excluding only §5.

- **`src/`** — React/Vite/TypeScript app: `App.tsx`, `components/`, `lib/`
  (api, rbac, roles, auth, mealAnalytics, calendar, types, …), `pages/`
  (admin/nursery/kitchen incl. `StaffPage`, `MealLibraryPage`,
  `MenuBuilderPage`, `InstitutionServiceTab`, `InstitutionCalendarTab`),
  `pages/parent/` (mobile parent portal). The retired legacy `MenuPage` is gone.
- **`supabase/`** — `migrations/0001`–`0030` (schema, RLS, resolution/publish
  engine, meal library RPCs, class_staff, per-meal demand, analytics one-truth,
  and the integrity pass 0029/0030); `functions/admin-create-user/`;
  `config.toml`.
- **`tests/`** — `sql/` (11 `verify_*.sql` suites + shim + actors + runner),
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

Migrations apply in numerical order, `0001` → `0030`. For production, follow
`scripts/PRODUCTION_APPLY.md` (schema first; service plans / rotation
assignments / publishing are Admin-UI actions, never migration side effects).

## 7. Honest status — what is NOT finished (BLOCKED_BY_SPEC)

Production-lock policy beyond the served-records boundary; email-delivered
account self-activation; the structured StudentAllergy/StudentDietaryRestriction
taxonomy (§42); Packing/Dispatch/Delivery state machine; expected-vs-actual
quantities; multi-kitchen routing; retention/deletion. Deliveries, Ops and
Absences remain honest `NOT_YET_DEFINED` shells. None of these were invented.
Nothing has been applied to the production database in this pass.
