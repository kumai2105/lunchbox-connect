# BUILD STATUS — LunchBox Connect

The authoritative specification pack shipped with this repo in `docs/spec-pack/`
(CLAUDE.md + 00–14 + reference data). This file records the implemented status
of each approved area and every honest shell.

Legend: ✅ built · ⬜ honest shell (BLOCKED_BY_SPEC) · ⬣ claimed-with-caution

## Reconciliation notes (why things changed)

The earlier build (this session's first pass) was written from a summarizing
README only. The full spec pack introduced corrections:

- **Roles are NINE**, not five. Teacher and Nurse are one domain
  (`TEACHER_NURSE_CLASSROOM`); Operations Manager, Finance/Owner, Viewer,
  Kitchen and Driver were added. (migration 0008)
- **Eligibility is institutional billing status**, not a family-means test. The
  free/reduced/paid concept was removed; only `ACTIVE_BILLABLE_TO_NURSERY` is an
  approved value and it gates serving. (migration 0009)
- **Classroom scope is assigned-class**, not institution-wide. (migrations 0010/0011)
- **Parent→school note messaging removed** (no comms platform; live chat banned).
- **Meal periods are four** (breakfast, snack, lunch, afternoon snack) (0010).
- **Audit log added** for important administrative writes (0009).

## Implemented and connected

| Surface                                     | Status           | Notes                                                                                                                                            |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Super Admin command center                  | ✅               | Real dashboard; summary from authoritative views                                                                                                 |
| Institutions CRUD                           | ✅               | Super Admin only                                                                                                                                 |
| Users & nine roles                          | ✅               | account creation gates all nine domains                                                                                                          |
| Students + operational status               | ✅               | status column, one approved value (0009)                                                                                                         |
| Parents / guardians                         | ✅               | guardian list via student_parents                                                                                                                |
| Classes + classroom staff assignment        | ✅               | assignment drives the scope gate (AT-032)                                                                                                        |
| Operational status (eligibility) manager    | ✅               | Super Admin; audit-logged                                                                                                                        |
| Menu management + publish                   | ✅               | meal detail: portion, ingredients, allergens, nutrition (0010)                                                                                   |
| Serving (Today) — 4 periods                 | ✅               | eligible students only; assigned class only                                                                                                      |
| Parent portal                               | ✅               | own child, published notes, published menu w/ ingredient detail                                                                                  |
| Audit                                       | ✅               | super-admin view; students/menus/users writes captured                                                                                           |
| Kitchen production demand                   | ✅ (counts only) | derived eligible counts; formula BLOCKED_BY_SPEC                                                                                                 |
| Kitchen entity (decoupled from Institution) | ✅               | `kitchens` table; Jazeel Restaurant seeded as current active Kitchen; Super-Admin-only provisioning enforced in SQL (0013, docs/13 Decision 031) |
| Class-scope isolation (AT-032/081)          | ✅               | enforced in SQL                                                                                                                                  |

## Honest shells — BLOCKED_BY_SPEC (never invented)

- **Structured serving outcome (APPROVED — Decision 032/033, no longer
  provisional):** consumption_pct ∈ {0,25,50,75,100}, behaviour ∈
  {ate_independently, needed_encouragement, refused}, low-intake reason, and a
  one-tap Absent/Unwell/Asleep exception excluded from intake analytics.
- Delivery / dispatch / driver state machines, handover evidence
- Production-lock policy beyond the served-records boundary; email-delivered
  account self-activation; per-institution timezones
- Meal-package assignment and exact production formula
- Institutional billing workflow (institution pays LunchBox — confirmed scope only)
- Reporting KPIs / finance and viewer data scopes
- Ops log & issue lifecycle (Operations Manager view-only shell)
- Absences workflow (recording, cut-off, production effect)
- Branches, allergies taxonomy/severity, special-meal handling, packing/labels
- Unknown roles beyond the nine (forbidden)

## Confirmed commercial rules (enforced/guaranteed no-op)

- Parent does NOT pay LunchBox Connect; institution is the customer. No parent
  checkout/payment/invoice/refund anywhere. (AT-020/021)
- No live chat, loyalty, referrals, social, gamification, AI features. (AT-130+)

## Technical stack — APPROVED (no longer an open decision)

The stack is **approved** (A1–A3) and recorded in `docs/13` **Decision 034**:
TypeScript · React 18 + Vite (SPA) · Supabase (PostgreSQL, Auth, Storage, Edge
Functions) · Row Level Security as the boundary · Supabase CLI migrations
(`0001`–`0039`) · Cloudflare Workers deploy · pnpm · Vitest · Playwright.
Operational timezone (MVP): Asia/Dubai. Decision 024 and the old
`TECHNICAL_STACK = NOT_YET_DEFINED` statements are SUPERSEDED.

## Verification evidence (release candidate)

- `pnpm typecheck` — clean · `pnpm lint` — clean (0 warnings)
- `pnpm test:unit` — **110 tests** (RBAC incl. the read-only Institution
  schedule, calendar, meal analytics incl. the unscored-is-not-0% rule, kitchen
  revision grouping, operational date + Asia/Dubai presentation, the parent
  child-switch selection/readiness invariant, the four factual dashboard
  completion states, exhaustive analytics pagination past 5,000 rows, and the
  nav-link/route reachability check)
- `./tests/sql/run_verification.sh` — **16 SQL suites** (182 assertions) on a throwaway
  PostgreSQL 16, incl. the 520-check authorization matrix and the raw-path
  DB-boundary suite (RPC-only writes, note-publish authority, tenant/eligibility
  triggers, meal-image storage visibility, meal-image historical immutability,
  and audit-log tamper resistance)
- `pnpm test:e2e` — 6 specs / **27** tests (not 19: `login.roles` runs once per
  role). Executed by `.github/workflows/e2e-local-supabase.yml` against an
  ephemeral Supabase stack started on the GitHub runner, because this sandbox
  blocks `*.supabase.co`. The target is `127.0.0.1`; production is refused
  outright by the seeder, by `build:e2e` and by the workflow guard
- Full report: `docs/VERIFICATION_FINAL.md`
  before claiming completion.
