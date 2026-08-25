# Operational spine and Student Meal Plan entitlement — 25 August 2026

Before this release the platform could plan a menu, publish it, and record what
each child ate. It could not say **what that child is entitled to receive**, and
so it could not say what the kitchen must cook. Everything downstream of that —
production, packing, delivery, handover, reconciliation, closure — either did
not exist or existed as a screen that said the module was not built.

This release supplies the spine: entitlement, exact demand, dietary decisions,
production, delivery custody and day closure, in that order, with each step
refusing to proceed while the one before it is unresolved.

`docs/FOUNDER_OPERATIONS_SPEC.md` is the canonical statement of the operating
model. This document is the record of the release that implemented it.

## Release identity

|                                  |                                                |
| -------------------------------- | ---------------------------------------------- |
| Branch                           | `claude/new-session-k5dd5u`                    |
| Migration ceiling in repo BEFORE | `0047_new_helpers_are_not_anon_reachable.sql`  |
| Migration ceiling in repo AFTER  | `0053_reconciliation_closure_corrections.sql`  |
| Migration ceiling in production  | see **Production apply**, below                 |
| Production Supabase              | `llnofriwvnerntrbpehc`                         |

Production stood at `0047` when this work began — confirmed against the live
migration ledger, not inferred from the repository — so the new migrations
start at `0048`. No applied migration was edited.

## What the six migrations establish

| Migration | Establishes |
| --- | --- |
| `0048` | Meal Plans, per-site availability, effective-dated student assignment, and the single entitlement boundary `app_student_counts_for()` |
| `0049` | Dietary requirements with a submit → review → resolve flow, and special-meal resolutions that name a real Meal Revision |
| `0050` | Exact demand, the finalisation snapshot, drift detection and superseding adjustments |
| `0051` | Production runs, packing, labels and operational issues |
| `0052` | Delivery configuration, manifests, dispatch and handover custody |
| `0053` | Reconciliation, classroom completion, day closure and bounded corrections |

### The three invariants that are structural, not procedural

- **One effective Meal Plan per child per date** — a GiST exclusion constraint
  over `daterange(effective_from, effective_until + 1, '[)')`. Every downstream
  calculation is entitled to assume it, so it is enforced where it cannot be
  bypassed rather than in whichever code path happens to run.
- **A special Meal replaces the standard Meal** — `standard_required` is
  computed as entitled *minus* those holding an alternative, and `final_demand`
  carries `check (total_quantity = standard_quantity + special_quantity)`.
  80 entitled children with 3 alternatives is 77 + 3 = 80. The arithmetic
  cannot inflate to 83.
- **One delivery run per serviced period** — `delivery_config_run_periods` is
  keyed `(config_id, period)`. A period cannot be loaded onto two vehicles
  because there is nowhere to write that it was.

## The non-destructive rollout

Production already serves children who hold no Meal Plan, because the concept
did not exist until `0048`. Nothing infers one for them.

`institutions.student_plan_enforced_from` is **NULL** for every existing site,
and while it is NULL production demand keeps its exact pre-`0048` meaning.
`app_plan_enforced()` is the only place that boundary is decided, so the
cutover cannot mean one thing to the Kitchen and another to the Classroom.

`activate_student_meal_plans()` refuses to switch a site over while any
operationally active child would be served without a valid Plan, and names
every one of them. A site cannot silently drop a child out of production by
adopting the new model.

No historical Student Plan was inferred, no free-text medical note was parsed,
and no delivery configuration was written on any site's behalf.

## What this release deliberately does not do

Stated, so that nobody reads capability into silence:

- No temperature or cold-chain rules. The applicable official requirements are
  not confirmed for this software state, and inventing them would be
  manufacturing regulatory compliance.
- No formal batch/lot traceability. Production Run and Manifest IDs are
  internal reconciliation identifiers and are not modelled or presented as
  regulated lot traceability.
- No regulator-approval statuses.
- No severity scale, diagnosis field, "safe meal" flag or automatic conflict
  engine on dietary requirements. Free text cannot carry a child-safety
  guarantee, and a screen that said "safe" on the strength of a string match
  would be trusted.

## Security shape

Every function added by `0048`–`0053` — forty-seven of them — is
`SECURITY DEFINER` with an explicit `set search_path = public`, and every one
carries an explicit `revoke all … from public, anon` followed by a
`grant execute … to authenticated`. That is the pairing whose absence produced
finding 14 in the previous release, where eight functions inherited
PostgreSQL's default `EXECUTE` to `PUBLIC` and became `anon`-callable.

No existing RLS policy was weakened. `service_role` remains server-side; no
secret is introduced into the browser bundle.

## Verification

### Database — replayed from nothing

`tests/sql/run_verification.sh` builds a throwaway PostgreSQL 16 cluster,
applies `supabase/migrations/*.sql` verbatim from an empty database, and runs
every suite. **25 suites, 318 assertions, exit 0.** Two of those suites are new:

- `verify_operational_spine.sql` — 24 assertions, including
  *mixed plans give exactly 120 / 120 / 80 / 80* and
  *77 standard + 3 special = 80 total, never 83*.
- `verify_spine_scenarios.sql` — 14 assertions covering a mid-month plan
  change, two-run delivery, a special Meal that never arrives, custody
  accepted with an issue open, and each new authorization boundary from the
  Institution Admin, Kitchen, Driver and Parent side.

### Product — driven through the browser


`tests/e2e/spine.spec.ts` drives one working day end to end, in the order a
real day happens and by the people who are supposed to carry it out:

> Meal Plans → mixed assignment → activation → published service → special-meal
> decision → exact demand → finalise → produce → pack → deliver → collect →
> arrive → hand over → the Classroom records only entitled children → the
> Parent sees the truth.

Every institution, class, child, plan and account it touches is created by that
file and removed afterwards. The shared fixture the other specs depend on is
never modified.

## What each portal gained

| Portal | Gained |
| --- | --- |
| Super Admin | Meal Plans, per-site availability, student assignment, dietary review, special-meal resolution, operations, delivery setup |
| Institution Admin | Read-only sight of each child's Plan, and a submission route for a dietary requirement about their own child |
| Kitchen | Exact demand split standard/special, finalisation, production, packing, labels, issues |
| Driver | *My deliveries* — assigned runs, what is on board, collection and arrival. No child data, no route optimisation, no handover |
| Institution receiver | Handover confirmation, including accepting custody with an issue open |
| Classroom | Only entitled children appear for a sitting; a child not on that Plan reads *Not included in this meal plan*, never 0% or missing |
| Parent | The day their child was actually entitled to, and no logistics |

## Decisions recorded

`docs/spec-pack/docs/13_DECISION_LOG.md` gains Decisions **043–051**: service
configuration is not entitlement; a Meal Plan is an entitlement, not a
commercial package; entitlement is switched on per Institution and never
guessed; free text is never converted into a safety decision; a special Meal
replaces one for one; delivery frequency changes transport, not entitlement;
the Driver carries and the Institution receives; exact fulfilment is the normal
case and the interface says so; temperature and formal batch traceability
remain deferred.
