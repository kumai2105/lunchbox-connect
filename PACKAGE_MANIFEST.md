# LunchBox Connect — Package Manifest

## SNAPSHOT — OPERATIONAL SPINE, 25 August 2026

**Branch:** `claude/new-session-k5dd5u`

Totals are read from the suites themselves, not carried forward from an earlier
manifest.

| Gate                 | Command                                    | Result                                                                 |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Browser suite        | `e2e-local-supabase.yml` run `32909746502` | **PASS — 108 / 108** · 0 failed · 0 skipped · 0 flaky · migrations `0001`–`0053` replayed from nothing on an ephemeral Supabase stack |
| Database suites      | `./tests/sql/run_verification.sh`          | **PASS — 25 suites**, 319 named assertions, replayed from nothing on PostgreSQL 16 |
| Authorization matrix | `verify_authorization_matrix`              | **PASS — 520 checks**                                                  |
| Unit tests           | `pnpm test:unit`                           | **PASS — 125** across 13 files                                         |
| TypeScript           | `pnpm typecheck`                           | **PASS** — app + node + `tests/e2e`, three projects                    |
| Lint                 | `pnpm lint`                                | **PASS**, 0 warnings                                                   |
| Production build     | `pnpm build`                               | **PASS**                                                               |
| Security advisors    | `prod-advisors.yml`                        | **0 ERRORS** — the release bar. Warnings reported, not gated           |

**Migration ceiling in this tree:** `0053_reconciliation_closure_corrections.sql`
(53 migrations).
**Migration ceiling in production:** **`0053`** — `0048` through `0053` applied
2026-08-25. See "Deployed" below.

Growth since the previous snapshot (`1c72f703`): 100 → 108 browser tests,
23 → 25 SQL suites, 280 → 319 assertions. Unit tests unchanged at 125.

### The browser gate is self-counting

The workflow takes its expected total from `playwright test --list` rather than
a number written down by hand, then asserts `expected == total`,
`unexpected == 0` and `skipped == 0`. A stale hand-counted number could pass
while whole specs silently stopped being collected; this cannot. The step named
"Assert every test executed, 0 failed, 0 skipped" is what makes the 108 above a
measurement rather than a claim.

### Nine runs, and the split is the point

Getting from the first green local build to 108/108 took nine runs of the
browser suite. **Seven failures were mine, in the tests. Two were the product**,
and one more product defect was found while investigating a third.

The two the suite caught in the product:

- **Three screens used the UTC date rather than the operational (Asia/Dubai)
  one.** The activation dialog defaulted *Enforce from* to
  `new Date().toISOString()`, and Delivery Setup carried the same expression
  twice — one of them deciding which delivery configuration counts as
  *current*. Between 20:00 and 24:00 UTC that is the wrong day. The run that
  caught it executed at 01:41 Dubai.
- **The Driver could not see where they were going.** A PostgREST embed of
  `institutions(name)` returns **null**, not an error, for a role that cannot
  read the table — and a Driver correctly cannot. The card read
  "Institution — run 1". Fixed by projecting the name through
  `my_delivery_manifests()` rather than by widening the policy.

And the one found alongside: the Parent portal's **Recent days** history listed
the sittings the *site* published rather than the ones the *child* was entitled
to — correct by construction before Meal Plans existed, wrong the moment they
did. `student_entitled_periods()` closes it in one call per range.

Three of the seven test failures were the fixture being refused by a rule that
was working correctly: `class_staff` rejecting a staff member from another
institution, delivery-receiver eligibility rejecting an Admin of another site,
and a shared Parent fixture whose portal opened on a different child. Each is
now a disposable account this spec creates and removes.

### What this release added to the evidence

- `tests/sql/verify_operational_spine.sql` — 24 assertions on the entitlement
  boundary, including *mixed plans give exactly 120 / 120 / 80 / 80* and
  *77 standard + 3 special = 80 total, never 83*.
- `tests/sql/verify_spine_scenarios.sql` — 15 assertions on a mid-month plan
  change, two-run delivery, a special Meal that never arrives, custody accepted
  with an issue open, a Driver's own manifests carrying a name while reading
  zero institution rows, and each new authorization boundary from the
  Institution Admin, Kitchen, Driver and Parent side.
- `tests/e2e/spine.spec.ts` — one working day end to end, by the people who
  carry it out: Meal Plans → mixed assignment → activation → published service
  → special-meal decision → exact demand → finalise → produce → pack → deliver
  → collect → arrive → hand over → the Classroom records only entitled children
  → the Parent sees the truth.

The nine simulation personas are unchanged: none was deleted, renamed,
reassigned or stripped of a role. Every account the new spec touches is created
by it and removed afterwards.

### DEPLOYED

**Migrations `0048` through `0053` are applied to production**
(`llnofriwvnerntrbpehc`), each in its own transaction and each recorded, and
the three privileged Edge Functions are ACTIVE.

A recovery point — the `public` and `auth` schemas as they stood at `0047` —
was captured before anything changed and retained for 90 days. It is a schema
dump, not a data dump.

Verification asked the database rather than the ledger: `to_regclass` on
`meal_plans`, `student_meal_plans`, `final_demand`, `delivery_manifests` and
`operational_days`, all non-null, before any frontend was allowed to follow.

The order was migrations → Edge Functions → frontend, and it is not
negotiable: the spine's columns and functions do not exist at `0047`, their
absence reads back as `undefined`, which is falsy, and a frontend that arrived
first would tell a site full of correctly-served children that none of them is
entitled to anything.

**Nothing changed for any existing site.** `student_plan_enforced_from` is NULL
everywhere. Demand keeps its exact pre-`0048` meaning until a Super Admin
switches a site over, and `activate_student_meal_plans()` refuses while any
operationally active child there lacks a valid Plan — naming every one of them.
