# Final Exhaustive Verification — Release Decision

**Date:** 2026-08-19
**Branch:** `claude/new-session-k5dd5u`
**Decision:** **APPROVED WITH LIMITATIONS** (see §5 — the limitations are
binding, not advisory)

This supersedes the earlier **VETOED** decision. The veto was issued because
§114 (golden path) and §95 (cross-portal propagation) could not be executed at
all — not because they had failed. They have now been executed. §4 states
precisely what the execution does and does not cover.

---

## 1. How this was run

The hosted Supabase project was unreachable from the build sandbox
(`*.supabase.co` is blocked by the egress proxy, and the database connector was
not available to this session). Rather than hand over unexecuted assertions, the
verification was run against a **real PostgreSQL 16 cluster built from nothing**,
with `supabase/migrations/*.sql` applied **verbatim, in order, unmodified**.

Reproduce it yourself:

```bash
./tests/sql/run_verification.sh     # exit 0 only if every assertion passed
```

| File                              | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `tests/sql/run_verification.sh`   | Builds the cluster, applies migrations, runs both suites        |
| `tests/sql/00_supabase_shim.sql`  | The Supabase-managed baseline only (`auth.uid()`, roles, grants) |
| `tests/sql/01_actors.sql`         | Four baseline accounts                                          |
| `tests/sql/verify_golden_path.sql`| The data chain, §114 / §95 / §59 / §112 / §47 / §67 / §28 / §44 |
| `tests/sql/verify_rls_cross_portal.sql` | The same chain re-read through every role's own RLS policies |

The shim contains **no application logic**. It recreates what Supabase manages:
the `auth` schema, `auth.uid()` reading `request.jwt.claims`, the
`anon`/`authenticated`/`service_role` roles, and the blanket table grants that
make **RLS the sole authorization boundary**. That last part matters — see §3.

All migrations applied cleanly from an empty database, which independently
verifies the migration set is replayable.

## 2. Results

### Golden path — `verify_golden_path.sql`

Institution → Class → Student → Meal → Rotation → Calendar → Service Plan →
Meal Service → Production Demand → Observation, then downstream reads.

| Check                                                                   | Result |
| ----------------------------------------------------------------------- | ------ |
| §114/§23 Institution, 2 classes, 2 students; exactly 1 operationally eligible | PASS |
| §29/§30 Rotation persists 60 slots at **week_count = 3** (not hard-coded 4) | PASS |
| §40 Three-meal Service Plan against a four-period rotation: lunch resolves, afternoon snack does **not** | PASS |
| §34/§37 A closure suppresses its own period and nothing else            | PASS |
| §42 A dated Meal Service exists for the target date                     | PASS |
| §44 Production Demand counts the eligible child and excludes the ineligible one | PASS |
| §114-20/21 The observation is recorded exactly once and persists        | PASS |
| §95 One record links Student → Meal Service → Meal revision at 75 percent | PASS |
| §78 The parent-facing band is derived from the stored number, not a second record | PASS |
| §59 Class completion is computed from records, not a stored counter     | PASS |
| §112 Moving the student to another class does **not** rewrite the historical class on the past record | PASS |
| §67 A 75 percent "tried" and a 0 percent "refused" stay distinct        | PASS |
| §47/§85 An `absent` observation is excluded from the preference population | PASS |
| §28 Recipe advanced to revision 2; the historical record still reads revision 1 | PASS |

### Cross-portal visibility — `verify_rls_cross_portal.sql`

Every read below runs under `set local role authenticated` with a forged
`request.jwt.claims`, i.e. the exact execution context PostgREST uses. Three
students exist across two institutions; one published lunch per institution;
one unpublished draft.

| Role            | Check                                                                       | Result |
| --------------- | --------------------------------------------------------------------------- | ------ |
| Parent          | §97 sees 1 of 3 students; probing another child **by direct UUID** returns 0 | PASS   |
| Parent          | §95 reads the same single observation at 75 percent                         | PASS   |
| Parent          | §109/§119 sees 0 drafts and 0 rows from the other institution               | PASS   |
| Classroom staff | §96/§95 sees 2 of 3 students (their class) and the same observation         | PASS   |
| Kitchen         | §93 sees **0** students and **0** individual observations; published services only | PASS |
| Driver          | §94 sees **0** students and **0** observations                              | PASS   |
| School admin    | §119 sees 2 own students, 0 leaked from the other institution               | PASS   |
| Viewer          | §90 `INSERT` on `institutions` refused **by a row-level security policy**   | PASS   |
| Super admin     | control: the same `INSERT` **succeeds**, so §90 is a real refusal           | PASS   |
| Super admin     | §28 `UPDATE` and `DELETE` on `meal_revisions` both affect **0 rows**        | PASS   |
| Super admin     | control: sees all 3 students and the 1 draft — the zeros above are refusals, not an empty table | PASS |

## 3. Two checks that initially passed for the wrong reason

Recorded because the contract requires it, and because both would have made the
report misleading.

1. **The viewer refusal was not an RLS refusal.** The first harness omitted
   Supabase's default table grants, so the viewer's `INSERT` was rejected with
   `insufficient_privilege` — a **missing GRANT**, not a policy. RLS was never
   consulted. A missing grant and a policy refusal share SQLSTATE `42501`, so
   the test could not tell them apart. Fixed by granting as Supabase does, and
   the assertion now insists the error text contains `row-level security`.
   A positive control was added: the same statement must succeed as super admin.

2. **§112 asserted the wrong thing.** It checked the historical class was "not
   Class B", which `NULL` or any third value would also satisfy. It now asserts
   the class equals the original Class A, and separately that the class change
   itself took effect.

Also corrected: the refused observation was being recorded against an
*ineligible* student, contradicting the §44 result proved two checks earlier. It
now uses a third, eligible child.

## 4. Proof the suites are not vacuous

A passing test suite means nothing until it is shown to fail. Three invariants
were deliberately broken in the schema and both suites re-run:

| Mutation                                                    | Expected | Observed                                                  |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------- |
| Add an `UPDATE` policy to `meal_revisions`                  | §28 fails | `FAIL §28 super admin rewrote 1 meal_revisions rows`       |
| Replace `service_plan_includes()` with `select true`        | §40 fails | `FAIL §40: afternoon snack resolved despite a three-meal service plan` |
| Add `for select using (true)` to `students`                 | §97 fails | `FAIL §97 parent sees 3 students, expected exactly 1`      |

Each mutation was reverted and the suites returned to green. The runner's exit
code was verified independently: **1** with a mutant present, **0** clean.

## 5. Limitations — what this decision does NOT cover

The approval is conditional on these being understood.

1. **No browser-level end-to-end run.** Playwright needs `*.supabase.co`, which
   the sandbox blocks. Everything above is verified at the database layer. That
   the React screens actually call these paths is verified by unit tests and code
   review, **not** by a driven browser. `tests/e2e/` is included and runnable in
   an environment with network access.
2. **Verified against a rebuilt schema, not live production data.** The
   migrations are byte-identical, and eight scenarios plus role isolation were
   separately confirmed against the hosted project earlier (see
   `VERIFICATION_DECISION_033.md`). What is not re-confirmed here is the hosted
   project's current drift from `supabase/migrations/`, if any. **Run
   `run_verification.sh` against the hosted database before go-live.**
3. **The new operating-logic model has no admin UI.** Meal Library, Rotation
   Builder and Calendar screens do not exist. The engine beneath them is built
   and now verified; the screens are not.
4. **Downstream portals still read the legacy `menus` table.** Kitchen,
   Classroom and Parent have not been rewired to `meal_services`. Both models
   coexist deliberately so nothing that worked was broken. The verified chain is
   therefore **not yet the chain the running app uses** — this is the single most
   important limitation on this page.
5. **`BLOCKED_BY_SPEC`, deliberately not invented:** production lock policy and
   cutoff, permanent production/delivery state enums, pre-production absence
   workflow, expected-vs-actual quantity stages (§48/§57/§118), multi-kitchen
   routing, retention and deletion rules, parent invitation/activation, bulk
   import formats.

## 6. Front-end gates

| Gate             | Command          | Result                          |
| ---------------- | ---------------- | ------------------------------- |
| Types            | `pnpm typecheck` | PASS                            |
| Lint             | `pnpm lint`      | PASS — no errors, no warnings   |
| Unit tests       | `pnpm test:unit` | **PASS — 47/47** across 5 files |
| Production build | `pnpm build`     | PASS — built in 2.64s           |

## 7. Decision

**APPROVED WITH LIMITATIONS.**

The data chain and the authorization boundary are proven, by executed
assertions that are themselves proven capable of failing. No unfixed defect is
outstanding from this pass; every defect found during it was fixed in place and
is listed in §3.

It is **not** approved as a claim that the running application exercises the
verified chain end to end. Limitations 3 and 4 are the gap between "the engine
is correct" and "the product uses the engine", and limitation 1 is the gap
between "the database is correct" and "the screens are correct". Closing 4 —
rewiring Kitchen, Classroom and Parent to `meal_services` — is the next
release-blocking item.
