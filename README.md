# LunchBox Connect

[![CI](https://github.com/Kumai2105/lunchbox-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/Kumai2105/lunchbox-connect/actions)

**Live:** https://www.lunchboxconnect.com — against production schema `0053`.
The operational spine of 2026-08-25 (migrations `0048`–`0053`: Student Meal
Plan entitlement, exact demand, dietary decisions, production, delivery custody
and day closure) is **applied**; see
`docs/RELEASE_2026-08-25_OPERATIONAL_SPINE.md` for the executed gate and
`docs/FOUNDER_OPERATIONS_SPEC.md` for the operating model it implements.
It changes nothing for any existing site until that site is switched over
deliberately: `student_plan_enforced_from` is NULL everywhere, and until it is
set, demand keeps its exact previous meaning. The closure of 2026-08-23
(`0043`–`0047`) is recorded in
`docs/RELEASE_2026-08-23_LIFECYCLE_CLOSURE.md`. The release order is always **migrations → Edge Functions →
frontend**, and it is not optional: a frontend that arrives before its columns
reads their absence as `undefined`, which is falsy, and shows every account as
deactivated. The Worker also answers on its origin
`https://lunchbox-connect.koumai-2105.workers.dev`, kept as a rollback path. **Before real meals can flow, each
Institution has to be configured in the app — its service plan, its menu
assignment and its calendar, all as Super Admin, all by clicking. See
`docs/SUPER_ADMIN_OPERATING_GUIDE.md`.** The full release record, with the
executed evidence and the open items, is `docs/RELEASE_2026-08-21.md`.

Institutional child-nutrition operations platform. One authoritative system
across the chain: **Institution → Student → Eligibility → Kitchen Production →
Classroom Serving → Parent Visibility → Analytics**. Menus are reusable Meals
arranged on an admin-configurable rotation (Menu Builder); four weeks is the
current company configuration, not a fixed limit.

Built to the approved specification pack (decisions A1–A3; technical stack
recorded in Decision 034). Undefined business rules are **isolated, never
invented** — see `docs/BUILD_STATUS.md`. The operational calendar date is
Asia/Dubai (GST) for the MVP.

## Stack

TypeScript · React 18 + Vite (SPA, React Router) · PostgreSQL + Auth via
Supabase · Row Level Security + app-level authorization · Supabase Edge
Functions · Supabase CLI migrations · Cloudflare Workers (frontend deploy) ·
pnpm · Vitest · Playwright · ESLint · Prettier

## Quickstart (full runbook in the attached spec pack)

```bash
pnpm install
cp .env.example .env          # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
supabase link --project-ref <your-ref>
supabase db push              # migrations 0001–0053
pnpm functions:deploy         # admin-create-user, admin-set-password, admin-set-active
pnpm dev                      # http://localhost:5173
```

Privileged steps that need your accounts (the tool cannot supply them):

1. **Create the Supabase project** at supabase.com → note Project URL, anon key.
2. **Deploy the Edge Function** and set its secrets:
   ```bash
   supabase functions deploy admin-create-user
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```
3. **Seed the first SUPER_ADMIN** (once) in the SQL editor:
   ```sql
   insert into app_users (user_id, role, full_name, email)
   values ('<auth-user-uuid>', 'super_admin', 'Kal Dash', 'admin@example.com');
   ```
   Then every other account is created in-app via **Users & roles**.
4. Demo data: `scripts/seed.sql` (manual).

## Verification

```bash
pnpm typecheck   # full-project TypeScript
pnpm lint
pnpm test:unit   # RBAC, calendar, meal analytics, kitchen, operational date, effective-dated configuration (125 tests)
pnpm test:e2e    # live-boundary Playwright suite — needs the env below
./tests/sql/run_verification.sh   # 23 SQL suites, 280 assertions, on a throwaway PostgreSQL 16
```

`run_verification.sh` builds a PostgreSQL 16 cluster from nothing, applies
`supabase/migrations/*.sql` verbatim, and runs every `tests/sql/verify_*.sql`
suite (golden path, cross-portal RLS, the 520-check authorization matrix, menu
cutover, downstream wiring, special period, class staff, kitchen demand,
correction order, publish-future, note privacy and record states, slot-resize
and publish/record concurrency via real second sessions, analytics volume past
the retired 5,000-row cap, and the raw-path DB-boundary suite).

**CI (GitHub Actions, `.github/workflows/ci.yml`)**: every PR runs the gate
(typecheck, lint, unit). The E2E job runs automatically on same-repo PRs when
the `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` / `E2E_SUPABASE_ANON_KEY`
repository secrets are set (Playwright browsers cached per commit); fork PRs and
PRs without those secrets skip it, matching the suite's BLOCKED_BY_ENVIRONMENT
rule. A secret pointing at the production project fails the job.

### End-to-end (Playwright)

The E2E suite is BLOCKED_BY_ENVIRONMENT: it seeds and runs only against an
**approved non-production (disposable) Supabase project**, and SKIPS cleanly
without credentials. Seeding production is refused outright — by the seeder, by
`build:e2e`, and by CI before either runs.

```bash
pnpm dev                 # or: pnpm build && pnpm preview
# .env (E2E_* keys):
#   E2E_BASE_URL, E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY,
#   E2E_SUPABASE_ANON_KEY   <- the browser bundle is built from this one
pnpm build:e2e           # builds against the SAME non-production project
pnpm test:e2e
```

The global setup seeds its own namespaced users/data idempotently (never your
real data) on the current architecture — Meal → Menu → published Meal Service →
class_staff → Classroom record → Parent result — and writes
`tests/e2e/.seeded.json` (gitignored). 14 specs, **100 tests** — `login.roles`
is parameterised over the nine role domains, so it contributes 10 of them. Take
the number from `pnpm exec playwright test --list` rather than from any
document; the CI gate does exactly that and fails on a silent skip as well as
on a failure.

No Supabase project of your own is required: `.github/workflows/e2e-local-supabase.yml`
starts a throwaway local stack on a GitHub runner and runs the whole suite
against it. Specs:

- `login.roles.spec.ts` — the nine approved role domains sign in and land on
  their scoped first page; the account-creation role list is verified.
- `serving.spec.ts` — a teacher records an outcome that persists across reload;
  the low-intake reason selector; and the one-tap Absent/Unwell/Asleep path.
- `parent-portal.spec.ts` — a parent sees their child's structured result,
  published notes only, and the published menu with meal detail.
- `rls.spec.ts` — role isolation; a Nursery Admin reaches the Staff screen.
- `status.spec.ts` — Super Admin sets eligibility (audited); per-meal kitchen
  demand; classroom staff cannot reach the Status screen.

## Structure

```
src/
  lib/      supabase client, auth, roles, rbac matrix, mealAnalytics, calendar,
            kitchen, format (operational date), api layer
  pages/    login, dashboard, institutions (+service/calendar tabs), students,
            classes, staff, meals (library), menu-builder, today, kitchen,
            analytics, reports, review, status, users, audit, parent/*
  components/  layout + shared UI (design ported from the approved mockup)
supabase/
  migrations/ 0001–0053 (schema, RLS, resolution/publish engine, meal library,
              class_staff, per-meal demand, analytics, DB-boundary integrity,
              historical immutability of referenced meal images, Meal Period
              tags, and the account/institution/class lifecycle)
  functions/  admin-create-user, admin-set-password, admin-set-active — the
              three privileged actions. The service-role key lives only here.
  functions/admin-create-user/  privileged account creation (super/nursery admin)
tests/
  e2e/        Playwright specs on the current architecture (+ global-setup)
  sql/        run_verification.sh + 16 verify_*.sql suites (schema/RLS/RPC/triggers)
              — 182 named assertions + the 520-check authorization matrix
docs/         BUILD_STATUS.md · 14-RELEASE_GATE.md · VERIFICATION_FINAL.md · spec-pack/
scripts/      PRODUCTION_APPLY.md (authoritative apply order) · seed.sql
remediation/  separated, review-gated production scripts
worker/       Cloudflare Worker (wrangler.jsonc assets + SPA fallback)
```

## Roles

Nine approved role domains (docs/02): `super_admin`, `school_admin`,
`operations_manager`, `finance_owner`, `viewer`, `parent`, `classroom_staff`,
`kitchen`, `driver`. Scope follows the approved matrix; exact Operations/Viewer
scopes stay NOT_YET_DEFINED until the spec names them.

## Deploy

```bash
pnpm build
wrangler deploy   # Cloudflare Workers, serves dist/ from the assets binding
```

## Supabase MCP server

`.mcp.json` is committed, so the server is configured for everyone. It is
**not** authenticated by the repo — authentication is per-developer OAuth and
the token is stored outside the project.

```bash
claude              # approve the project-scoped server when prompted
/mcp                # select "supabase" -> Authenticate
```

Agent Skills (`.agents/skills/`, symlinked into `.claude/skills/`) are pinned
by `skills-lock.json`. Reinstall or update with:

```bash
npx skills add supabase/agent-skills
```

### If the MCP server cannot connect

Check whether the host is reachable at all before debugging credentials:

```bash
curl -so /dev/null -w "%{http_code}" https://mcp.supabase.com/mcp
```

`401` means the server is up and simply wants a token — authenticate. `403`
from a corporate or sandbox egress proxy means the request never reached
Supabase, and no amount of re-authenticating will help; the host has to be
allowed by the network policy. That is the case inside the Claude Code web
sandbox, which is why `tests/sql/run_verification.sh` exists — it verifies the
schema against a local PostgreSQL with no network at all.
