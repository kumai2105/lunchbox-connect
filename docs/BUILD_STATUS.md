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

- Exact serving **outcome values** (provisional demo: full/partial/refused/absent)
- Delivery / dispatch / driver state machines, handover evidence
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

## Open decision — the user must confirm

- **Technical stack.** `docs/00 §26` and the decision log mark the stack
  `NOT_YET_DEFINED`. The build uses the React + Vite + Supabase + Cloudflare
  stack from the earlier README — a sensible, already-implemented default, but
  it is NOT formally approved. Pros in `docs/13` Decision 024 = not approved.
  Confirm (or change) the stack as an active decision before release.

## Verification evidence

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `pnpm test:unit` — RBAC (9 roles) + status domain green
- `pnpm test:e2e` — 9-role logins, status workflow, serving, parent portal,
  kitchen demand: written; BLOCKED_BY_ENVIRONMENT until live Supabase keys.
- Release gate: runbook step 5 (static) + step 9 (live) evidence required
  before claiming completion.
