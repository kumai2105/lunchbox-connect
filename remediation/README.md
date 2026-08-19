# Production remediation — corrected, separated, review-gated

The earlier `scripts/apply_to_production.sql` has been **withdrawn**
(`scripts/apply_to_production.sql.disabled`). It bundled a required security
fix together with **unapproved business-data decisions** and **auto-committed**.
It was already executed against production, so those decisions are currently
live. This folder corrects that: each concern is a separate script, none
commits on its own, and every one was tested on a clone with before/after
row counts and a rollback proof.

## Current production reality (what the withdrawn script left behind)

| Thing | State | Verdict |
| ----- | ----- | ------- |
| Resolver RPC leak | closed | ✅ keep — this was the one required, approved change |
| `Test %` fixtures | deleted | ⚠️ already gone; `00_diagnose` §5/§6 confirm nothing real was orphaned |
| Meal library + rotation template (from the 20 real menu rows) | created | ✅ legitimate legacy-menu data — keep |
| Institution **service plans** | rebuilt from the menu's periods | ❌ unapproved — a service plan is a contract, not menu-derived |
| **Rotation assignments** | one rotation auto-assigned to every institution | ❌ unapproved |
| ~2056 **published** meal services (−60d … +300d) | published | ❌ unapproved mass publication with no calendar context |

## The domain rule this restores (your point 7)

```
Meal Library → Rotation → Institution Rotation Assignment → Calendar
  → Institution Service Plan → Dated Meal Service → Eligibility
  → Production Demand → Kitchen → Classroom → Parent → Analytics
```

The **master menu does not determine an institution's contracted periods.**
Proven on the clone: an institution given a 3-period plan gets 3 periods
published even though the menu carries 4.

## Transaction safety (your point 6)

Every change script uses `begin;` and **does not** `commit;`. It leaves you in
an open transaction so you can review the notices and then type `commit;` or
`rollback;` yourself.

> ⚠️ The Supabase **web SQL editor auto-commits** each run, so it does **not**
> give you that checkpoint. For a real review-before-save, run the change
> scripts in **psql**. If you only have the web editor, run `00_diagnose.sql`
> (read-only) as your review gate, decide, then run the change script knowing
> it will commit when the run finishes.

## Files, in order

| File | Type | What it does | Commits? |
| ---- | ---- | ------------ | -------- |
| `00_diagnose.sql` | READ-ONLY | Reports authoritative current state; safe anywhere | n/a |
| `01_security_remediation.sql` | change | Revokes the resolver RPCs (already applied; re-run is a no-op) | no |
| `05_revert_unapproved_changes.sql` | change, **destructive** | Removes the unapproved plans, assignments, and speculative services; **preserves** library, template, and all history | no |
| `02_menu_library_migration.sql` | change | Rebuilds only the meal library + rotation template from `menus` (no assignment, no plan, no publish) — for a clean rebuild scenario | no |
| `03_institution_config.TEMPLATE.sql` | change, **template** | You fill in each institution's **real** rotation assignment + service plan; refuses to run until filled | no |
| `04_publish_explicit.TEMPLATE.sql` | change, **template** | Publishes ONE named institution over an explicit ≤90-day window, gated on config; drafts by default | no |

## Recommended path on production

1. **`00_diagnose.sql`** — confirm the state above (especially that the 2056
   services are unreferenced and that no real serving history was orphaned).
2. **`05_revert_unapproved_changes.sql`** — undo the unapproved changes.
   **This has already been applied to production with your approval:**
   plans=0, assignments=0, published=0, while meals=20, rotations=1, slots=20,
   serving_records=4, menus=20 were preserved and the leak stayed closed.
   Institutions are now *unconfigured* — correct until their real agreements
   are entered. Re-running the diagnose confirms this; re-running `05` is a
   no-op. The security fix, meal library, rotation template, legacy menu, and
   all serving records are untouched.
3. For each institution whose agreement you actually know: fill and run
   **`03`**, then **`04`** for an approved window (drafts first).
4. Any institution whose service plan or rotation you cannot source from an
   authoritative record stays **`BLOCKED_BY_SPEC`** — leave it unconfigured
   rather than guess.

`01` (security) is already live; `02` is only needed for a clean rebuild — on
current production the library and template already exist and `05` keeps them.

## Test evidence (clone, PostgreSQL 16)

Mirror of current production (`leak closed, 0 test meals, 2 inferred plans,
2 auto assignments, 2056 published, 4 records`):

- **05 rollback test** — ran the revert, then `rollback;` → DB identical to
  before (2 plans, 2 assignments, 2056 services all back).
- **05 commit test** — ran, then `commit;` → plans=0, assignments=0,
  published=0; **preserved** meals=20, rotations=1, slots=20,
  serving_records=4, menus=20; security `leak_open=false`.
- **01** idempotent no-op on an already-fixed DB.
- **02** idempotent; leaves plans/assignments/services at 0 (no scope creep).
- **03 / 04** refuse to run while placeholders remain.
- **domain proof** — 3-period plan → 3 periods/day published, afternoon_snack
  excluded despite the menu carrying one; **04 blocks** an unconfigured
  institution.

Only the approved revert (`05`, and the already-live security fix `01`) has
been run against production. The remaining templates (`02`/`03`/`04`) have
not — run those yourself, in the order above, reviewing each step.
