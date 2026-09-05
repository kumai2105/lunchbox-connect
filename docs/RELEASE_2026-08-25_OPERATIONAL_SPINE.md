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

## What the gate cost, and what it caught

Nine runs of the browser suite stand between the first green local build and
108/108. Recorded because the split is the interesting part.

**Seven were defects in the tests.** A landing route the fixtures knew about and
the spec did not; a role picker that had legitimately gained an entry; fixtures
calling gated RPCs through the service key, which is not a user and never
passes `app_is_super_admin()`; loops guarded by a bare `.count()` taken before
the screen's first fetch had returned; assertions matching two elements at
once, including one where `getByText('Lunch')` matched the product's own name
in the header.

Three of those deserve their own line, because in each case the fixture was
refused by a rule that was working:

- `class_staff` refused a Classroom account from another institution. The
  tenant boundary, doing its job. The spec now creates its own staff member.
- The Authorized Delivery Receiver must be the site's own Admin or Classroom
  Staff, so the shared fixture's Institution Admin was correctly ineligible —
  which is why the handover step had been written as optional and proved
  nothing. The spec now creates its own receiver and the step is mandatory.
- The shared fixture's Parent already had a child elsewhere, so linking a second
  one made the portal open on the first. The screen reported that child's
  sittings perfectly correctly while the assertion asked about ours.

**Two were defects in the product**, and the suite is the only reason they are
not in production:

- **Three screens used the UTC date, not the operational one.** The activation
  dialog defaulted *Enforce from* to `new Date().toISOString()`, and Delivery
  Setup used the same expression twice — once to decide which configuration is
  *current*. Between 20:00 and 24:00 UTC that is the wrong day in Dubai. The
  run that caught it executed at 01:41 Dubai: the fixture assigned Plans
  effective the 26th and the dialog asked whether everyone had a Plan covering
  the 25th. All three now call `operationalToday()`.
- **The Driver could not see where they were going.** *My deliveries* read
  `delivery_manifests` with an embedded `institutions(name)`. A Driver holds no
  read on `institutions` — correctly — and PostgREST returns an unreadable
  embedded row as **null**, not an error, so the card rendered
  "Institution — run 1". Fixed by projection rather than by widening the
  policy: `my_delivery_manifests()` returns the fields that screen needs for
  that Driver's own manifests, and `b5` proves a Driver still reads zero
  institution rows directly.

A third was found while investigating a failure rather than by the failure
itself: today's Parent cards were entitlement-filtered but the **Recent days**
list below them was not. Before Meal Plans the site's published sittings and
the child's were the same list; this release makes that false, and a Lunch row
on a morning-only child's history reads to their guardian exactly like a meal
nobody recorded. `student_entitled_periods()` answers the whole range in one
call and reuses `app_student_counts_for()`, so the history cannot reach a
different answer than production did.

## Production apply

Applied 25 August 2026 from commit `90eb71d`, through
`.github/workflows/prod-apply-migrations.yml` dispatched with the project ref
typed in full.

A recovery point was captured before anything changed — the `public` and `auth`
schemas as they stood at `0047` — and retained as a workflow artifact for 90
days. It is a schema dump, not a data dump.

| Migration | Recorded as |
| --- | --- |
| `0048_student_meal_plan_entitlement` | `20260825235052` |
| `0049_dietary_requirements_and_special_meals` | `20260825235055` |
| `0050_exact_demand_and_finalisation` | `20260825235100` |
| `0051_production_packing_issues` | `20260825235103` |
| `0052_delivery_manifest_dispatch_handover` | `20260825235107` |
| `0053_reconciliation_closure_corrections` | `20260825235110` |

Then the three privileged Edge Functions were redeployed —
`admin-create-user`, `admin-set-password`, `admin-set-active` — and
`SUPABASE_SERVICE_ROLE_KEY` confirmed present in the function environment by
name and digest. That key exists only there. It is in no frontend build.

### `supabase db push` could not do this, and the reason matters

Every migration this project has ever received went through the Supabase
Management API, which records the ledger row as a **timestamp** carrying the
file's name — `20260823172428 / 0043_meal_period_tags`. The CLI derives its
version from the filename prefix instead, `0043`, so it found fifty remote rows
it had no local file for and stopped. Nothing was wrong with the database.

Its suggested remedy is to mark all fifty `reverted` and push everything, which
on a live database replays `0001`–`0047` against a schema that already has
them. The apply step now continues the pattern that produced every existing
row: skip what is recorded, then apply and record each remaining file in its
own transaction.

Verification asks the database, not the ledger. A row in `schema_migrations` is
a claim; `to_regclass` on `meal_plans`, `student_meal_plans`, `final_demand`,
`delivery_manifests` and `operational_days` is the thing itself, and a null in
any of them fails the job before a frontend can be deployed against it.

### Nothing changed for anyone

Every Institution carries `student_plan_enforced_from` NULL. Production demand
keeps its exact pre-`0048` meaning until a Super Admin switches a site over
deliberately, and `activate_student_meal_plans()` refuses while any
operationally active child there lacks a valid Plan — naming each one.
