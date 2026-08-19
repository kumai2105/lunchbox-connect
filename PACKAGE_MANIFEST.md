# LunchBox Connect — Package Manifest

**Packaged:** 2026-08-19
**Branch:** `claude/new-session-k5dd5u`
**Commit:** `a5c3047`
**Working tree:** clean — everything below is committed and pushed to GitHub
(`kumai2105/lunchbox-connect`).

---

## 1. Build status — actual command output

All four gates were run immediately before packaging.

| Gate | Command | Result |
| --- | --- | --- |
| Types | `pnpm typecheck` | **PASS** — no errors |
| Lint | `pnpm lint` | **PASS** — no errors, no warnings |
| Unit tests | `pnpm test:unit` | **PASS — 39/39** across 4 files |
| Production build | `pnpm build` | **PASS** — 115 modules, built in ~2.5s |

Test files: `rbac.test.ts` (11), `calendar.test.ts` (14),
`mealAnalytics.test.ts` (11), `status.test.ts` (3).

The build prints one advisory notice that the JS chunk exceeds 500 kB. That is a
bundle-size suggestion, not an error, and the build succeeds.

**Not run:** `pnpm test:e2e` (Playwright). The E2E suite needs network access to
`*.supabase.co`, which this sandbox blocks. The spec files are included in the
package and are runnable in your own environment.

## 2. Live database verification

Executed against the real Supabase project `llnofriwvnerntrbpehc`. Full evidence
with query output is in **`docs/VERIFICATION_DECISION_033.md`**.

| Scenario | Result |
| --- | --- |
| 104 Rotation → calendar, repeats 1,2,1,2,1 | PASS |
| 105 Closure does not shift the rotation | PASS |
| 106 Date override changes only that date | PASS |
| 107 Service Plan filters applicable periods | PASS |
| 108 Plan effective dates preserve history | PASS |
| 109 Drafts invisible to Parent and Kitchen | PASS |
| 111 Historical meal revision survives republish | PASS |
| 119 Cross-institution isolation, shared rotation | PASS |

Role isolation was separately verified live: Parent sees 2 of 10 students and 0
rows when querying another child directly by ID; Teacher sees 5; Kitchen and
Driver see 0; a Viewer and a Nursery Admin creating an Institution are both
rejected by Postgres with `new row violates row-level security policy`; and a
Super Admin `UPDATE` against `meal_revisions` rewrites **0 rows**.

---

## 3. What is in the archive

Everything required to run the project, excluding only the items in §5.

### Frontend — `src/`

| Path | Notes |
| --- | --- |
| `App.tsx`, `main.tsx`, `styles.css` | Routing, entry, full design system |
| `components/Layout.tsx` | App shell; parent role gets its own mobile chrome |
| `components/ui.tsx` | Card, StatCard, Pill, Modal, Banner, Avatar, etc. |
| `components/icons.tsx` | **New** — inline SVG icon set replacing all emoji |
| `components/charts.tsx` | **New** — BarChart / TrendChart, no chart library |
| `lib/api.ts` | All Supabase access |
| `lib/calendar.ts` + `.test.ts` | **New** — calendar resolution + 14 tests |
| `lib/mealAnalytics.ts` + `.test.ts` | Analytics validity rules + 11 tests |
| `lib/rbac.ts` + `.test.ts` | Permission matrix mirroring RLS + 11 tests |
| `lib/roles.ts`, `auth.tsx`, `types.ts`, `format.ts`, `status.ts`, `supabase.ts` | Core libs |
| `pages/` (20 files) | Admin/nursery/kitchen pages |
| `pages/parent/` (7 files) | **New** — four-screen mobile parent portal |

Pages added this session: `InstitutionDetailPage`, `StudentProfilePage`,
`MealAnalyticsPage`, `ReviewPage`, and the whole `parent/` directory.

### Backend — `supabase/`

| Path | Notes |
| --- | --- |
| `migrations/0001`–`0015` | Pre-existing schema, RLS, RPCs, views |
| `migrations/0016_operating_logic_lock.sql` | **New** — Decision 033. Meals, revisions, rotations, service plans, calendar exceptions, meal services, RLS, and the resolution/publish functions |
| `functions/admin-create-user/index.ts` | Edge function for account provisioning |
| `config.toml` | Supabase config |

### Governance — `docs/`

| Path | Change |
| --- | --- |
| `spec-pack/docs/13_DECISION_LOG.md` | **Decision 033 added** (supersedes a clause of 032) |
| `spec-pack/docs/04_DATA_MODEL.md` | **Part VII added** — §26–34, the new entities |
| `VERIFICATION_DECISION_033.md` | **New** — live test evidence |
| `spec-pack/` (remaining 17 docs) | Unchanged canonical specification |
| `BUILD_STATUS.md`, `14-RELEASE_GATE.md` | Unchanged |

### Tests, config, deployment

`tests/e2e/` (5 Playwright specs + fixtures), `tests/sql/notes_safety.sql`,
`scripts/seed.sql`, `worker/worker.ts`, `.github/workflows/` (ci + deploy),
`package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `vitest.config.ts`,
`playwright.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`,
`wrangler.jsonc`, `index.html`, `README.md`, `CLAUDE_CODE_GOLIVE.md`,
`.env.example`.

---

## 4. Assets

There are **no binary image assets** in this project. Every icon is inline SVG
(`src/components/icons.tsx`), the logo is CSS-rendered, and Inter is loaded from
Google Fonts. Student and meal photos are user-uploaded at runtime into private
Supabase Storage buckets, not shipped files. Nothing is missing from the archive.

---

## 5. Deliberately excluded

| Excluded | Why |
| --- | --- |
| **`.env`** | Contains `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. Never package a service-role key. Copy `.env.example` and fill it in. |
| `node_modules/` | Reinstall with `pnpm install` (`pnpm-lock.yaml` is included, so versions are exact). |
| `dist/` | Build output. Regenerate with `pnpm build`. |
| `.git/` | History is on GitHub at the branch/commit above. |
| `supabase/.temp/` | CLI scratch file. |

---

## 6. Running it

```bash
pnpm install
cp .env.example .env      # fill in your Supabase URL + keys
pnpm dev                  # http://localhost:5173
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build
```

Migrations apply in numerical order, `0001` → `0016`.

---

## 7. Honest status — what is NOT finished

The Master Software Build Contract and the Master Operating Logic Lock are
**not fully implemented**. Specifically:

1. **No admin UI for the new model.** Meal Library, Rotation Builder and
   Calendar screens do not exist. The schema, RLS and resolution engine behind
   them are built and verified; the screens are not.
2. **Downstream still reads the legacy `menus` table.** Kitchen, Classroom and
   Parent have not been rewired to `meal_services`. Both models currently
   coexist — deliberately, so nothing that worked was broken.
3. **Scenarios 112 and 117** (class-change history, kitchen change) have no live
   run yet.
4. **`BLOCKED_BY_SPEC`** — production lock policy and cutoff, permanent
   production/delivery state enums, pre-production absence workflow, expected-vs-
   actual quantity stages (scenario 118), multi-kitchen routing, retention and
   deletion rules, parent invitation/activation, bulk import formats. None of
   these were invented.
5. **Deliveries, Ops and Absences** remain honest `NOT_YET_DEFINED` shells.
6. **E2E suite not executed here** — sandbox network restriction, see §1.

Test fixtures named `Test Meal A–D` and `Test Rotation 2wk` exist in the live
database from the verification run. They are prefixed `Test ` so they are
distinguishable, and can be deleted safely.
