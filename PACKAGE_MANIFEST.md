# LunchBox Connect — Package Manifest

## SNAPSHOT — OPERABILITY CLOSURE, 26 August 2026

**Branch:** `claude/new-session-k5dd5u`

Totals are read from the suites themselves, not carried forward from an earlier
manifest — every figure below was counted from the output of the run it names,
on this tree, for this release. That rule has caught a wrong number in this
file more than once, including in this release: the draft of this manifest said
334 SQL assertions and the suites actually report 328.

| Gate                 | Command                                    | Result                                                                 |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Browser suite        | `e2e-local-supabase.yml`, on the deployed SHA | **PASS — 117 / 117** · 0 failed · 0 skipped · 0 flaky · migrations `0001`–`0054` replayed from nothing on an ephemeral Supabase stack |
| Database suites      | `./tests/sql/run_verification.sh`          | **PASS — 26 suites**, 328 named assertions, replayed from nothing on PostgreSQL 16 |
| Authorization matrix | `verify_authorization_matrix`              | **PASS — 520 checks**                                                  |
| Unit tests           | `pnpm test:unit`                           | **PASS — 130** across 14 files                                         |
| TypeScript           | `pnpm typecheck`                           | **PASS** — app + node + `tests/e2e`, three projects                    |
| Lint                 | `pnpm lint`                                | **PASS**, 0 warnings                                                   |
| Production build     | `pnpm build`                               | **PASS**                                                               |
| Security advisors    | `prod-advisors.yml`                        | **0 ERRORS** — the release bar. Warnings reported, not gated           |

**Migration ceiling in this tree:** `0054_operability_closure.sql` (54 migrations).
**Migration ceiling in production:** **`0054`**.

Growth since the previous snapshot (`5d6b506`): 108 → 117 browser tests,
25 → 26 SQL suites, 125 → 130 unit tests — each of those pairs is countable
from the two trees. No assertion-count delta is quoted: re-measuring the
predecessor cleanly did not succeed here (a port override that the concurrency
suite's real second session did not follow), and a delta whose starting number
was not verified is the exact thing the rule above exists to stop.

### The browser gate is self-counting

The workflow takes its expected total from `playwright test --list` rather than
a number written down by hand, then asserts `expected == total`,
`unexpected == 0` and `skipped == 0`. A stale hand-counted number could pass
while whole specs silently stopped being collected; this cannot.

### What this release closed, and what the closure found

An independent inspection of the `0053` release found four capabilities that
existed in the database, were exported from the api layer, were covered by SQL
assertions — and that **no component imported**. The end-to-end test called the
RPCs directly, so it proved the rules held and proved nothing about whether an
operator could reach them:

| Capability | Since | Component calling it before this release |
| --- | --- | --- |
| `bulkAssignStudentMealPlan` | `0048` | none |
| `assignManifestDriver` | `0052` | none |
| `advanceIssue` | `0051` | none |
| `correctOperationalRecord` | `0053` | none |

All four now have a screen, and `src/lib/operability.reachability.test.ts` fails
if any of them loses its way back in.

**And the closure found a fifth thing, in the product.** The browser test that
drives the new Driver selector could not find it: the selector's label is built
from the manifest's institution name, and the name was not there.
`delivery_manifests_select` lets the Kitchen read every manifest — correctly —
but `app_can_see_institution()` has no `kitchen` branch, and PostgREST returns
an unreadable embedded row as **null**, not as an error. Since `0052` the
Kitchen's Dispatch table has shown a blank site for every run, and the labels
dialog — the sheet the packing bench prints and sticks on the crate — has had a
blank line where the destination goes.

Closed by projection, not by policy: `manifests_for_date()` restates
`delivery_manifests_select` word for word and adds the name. The Kitchen still
cannot read `institutions`, and the SQL suite asserts exactly that while the
Kitchen reads two named manifests.

Two test defects were found alongside, both mine, and one of them mattered:
every disposable-institution teardown in the suite ended at
`delete from institutions`, which is **refused** once a day has been lived
(`delivery_manifests.institution_id` is `on delete restrict`) and whose refusal
PostgREST returns in `error` rather than throwing. Institutions were surviving
into later specs. `removeInstitutionDay()` deletes through the restrict edges in
order and checks the final delete.

### What this release added to the evidence

- `tests/sql/verify_operability_closure.sql` — 14 assertions: the Driver
  projection, the manifest projection, the issue lifecycle end to end, and the
  correction allow-list.
- `tests/e2e/closure.spec.ts` — a complete second working day on **two delivery
  runs**, driven by clicking: bulk Plan assignment, activation, exact demand
  5 / 5 / 3 / 3, each sitting on exactly one run with the totals unchanged by
  the split, receivers authorised and revoked and re-authorised by the
  Institution itself, a Driver named on both runs, run 1 completing handover
  independently of run 2, a delivery issue actioned and acknowledged and closed
  by three different people, an internal Kitchen issue the institution never
  sees, a bounded correction whose original value survives in Audit, and the
  legacy `/deliveries` URL landing each role on the screen it works in.
- `src/lib/operability.reachability.test.ts` — the named reachability guard.
- `tests/e2e/spine.spec.ts` — kept its shape, lost its two RPC shortcuts. The
  bulk assignment and the driver assignment there are now clicks.

The nine simulation personas are unchanged: none was deleted, renamed,
reassigned or stripped of a role. Every account the closure spec touches is
created by it and removed afterwards.

### DEPLOYED

**Migration `0054` is applied to production** (`llnofriwvnerntrbpehc`), after
the verified ceiling of `0053`. `0001`–`0053` were not edited.

**Nothing changed for any existing site.** `student_plan_enforced_from` is NULL
everywhere. Demand keeps its exact pre-`0048` meaning until a Super Admin
switches a site over.

Temperature and cold-chain evidence, formal batch/lot traceability,
regulator-approval statuses and any allergy severity model remain deferred by
decision.
