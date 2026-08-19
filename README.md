# LunchBox Connect

[![CI](https://github.com/Kumai2105/lunchbox-connect/actions/workflows/ci.yml/badge.svg)](https://github.com/Kumai2105/lunchbox-connect/actions)

Institutional child-nutrition operations platform. One authoritative system
across the chain: **Institution → Student → Eligibility → Classroom Serving →
Parent Visibility**, with a central admin-managed 4-week menu.

Built to the approved specification pack (decisions A1–A3). Undefined business
rules are **isolated, never invented** — see `docs/BUILD_STATUS.md`.

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
supabase db push              # migrations 0001–0007
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
pnpm test:unit   # RBAC matrix + eligibility transitions (12 tests)
pnpm test:e2e    # live-boundary Playwright suite — needs the env below
```

**CI (GitHub Actions, `.github/workflows/ci.yml`)**: every PR runs the gate
(typecheck, lint, unit). The E2E job runs automatically on same-repo PRs when
the `E2E_SUPABASE_URL` / `E2E_SUPABASE_SERVICE_ROLE_KEY` repository secrets are
set (Playwright browsers cached per commit); fork PRs and PRs without those
secrets skip it, matching the suite's BLOCKED_BY_ENVIRONMENT rule.

### End-to-end (Playwright)

The E2E suite is BLOCKED_BY_ENVIRONMENT: it seeds and runs only against your
live Supabase project, then SKIPS cleanly without credentials.

```bash
pnpm dev                 # or: pnpm build && pnpm preview
# .env (E2E_* keys):
#   E2E_BASE_URL, E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY
pnpm test:e2e
```

The global setup seeds its own namespaced users/data idempotently (never your
real data) and writes `tests/e2e/.seeded.json` (gitignored). Specs:

- `login.roles.spec.ts` — the five approved roles sign in and land on their
  scoped first page; the four spec-unnamed roles are boundary-tested (creating
  one is impossible until the spec names it).
- `eligibility.spec.ts` — school admin sets a determination + approves, and
  routes a pending record to need-docs.
- `serving.spec.ts` — teacher records an outcome; it persists across reload.
- `parent-portal.spec.ts` — parent sees own child, today's outcomes, published
  notes only, and the published menu; sending a note lands in the inbox store.

## Structure

```
src/
  lib/      supabase client, auth, roles, rbac matrix, eligibility rules, api layer
  pages/    login, dashboard, institutions, students, classes, eligibility, menu, today, users, parent
  components/  layout + shared UI (design ported from the approved mockup)
supabase/
  migrations/ 0001–0007 (domains, tables, helpers, RLS, RPCs, views, audit)
  functions/admin-create-user/  privileged account creation (super admin only)
tests/
  e2e/        RLS isolation acceptance specs (AT-030/031)
  sql/        notes_safety.sql — parent-visibility acceptance test
docs/         BUILD_STATUS.md (honest status per surface) · 14-RELEASE_GATE.md
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
