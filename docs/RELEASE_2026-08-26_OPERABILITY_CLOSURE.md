# RELEASE — OPERABILITY CLOSURE, 26 August 2026

**Repository:** `kumai2105/lunchbox-connect` · **Branch:** `claude/new-session-k5dd5u`
**Migration:** `0054_operability_closure.sql` — forward-only, after the actual
production ceiling of `0053`.
**Predecessor:** `docs/RELEASE_2026-08-25_OPERATIONAL_SPINE.md` (`0048`–`0053`).

---

## What this release is about

An independent inspection of the `0053` release found something the whole gate
had missed, and the reason it missed it is worth writing down.

Four capabilities existed in the database, were exported from `src/lib/api.ts`,
and were covered by SQL assertions. **No component imported any of them.** The
end-to-end test called the RPCs directly, so it proved the rule held and proved
nothing at all about whether an operator could reach it:

| Capability | Since | Component that called it before this release |
| --- | --- | --- |
| `bulkAssignStudentMealPlan` | `0048` | none |
| `assignManifestDriver` | `0052` | none |
| `advanceIssue` | `0051` | none |
| `correctOperationalRecord` | `0053` | none |

"The backend supports it" had quietly been standing in for "the business can do
it". Every one of the four was verified still missing at the released SHA
before being closed — the finding was reproduced, not taken on trust.

## What changed

### Bulk Student Meal Plan assignment — a screen

Onboarding a site means putting sixty children on two Plans. One dialog per
child is both an afternoon and sixty chances to pick the wrong row.

`Meal Plans → (institution) → Assign Plans` filters by **Missing a Plan**, by
current Plan, or by an already-scheduled change; selects; names the Plan and the
effective date; shows the review line; assigns.

It reuses the existing atomic RPC and does not soften it. There is no
partial-success path and no per-row result: one refusal writes nothing and the
message names every child refused. A roster half-assigned is worse than one not
assigned, because the half that succeeded looks finished.

### Naming a Driver — a screen, and the backend piece it needed

`assign_manifest_driver()` has let the Kitchen assign a Driver since `0052`.
Nothing let the Kitchen find out **who**: a Driver belongs to LunchBox rather
than to a site, so `app_users` is the wrong place to ask and correctly returns
nothing useful. The workflow was complete in the database and impossible in the
product, which is how "assign the driver by RPC" became a normal step.

`0054` adds `active_drivers()` — a projection, not a wider policy. Two columns,
to the two roles that may already assign, with no email, no phone, no
institution and no inactive accounts. Widening `app_users` to populate a
dropdown would have handed the Kitchen every account in the system to solve a
problem about four rows.

The Kitchen's Dispatch row now carries a Driver selector and **Assign driver** /
**Change driver**, and says *Assign a Driver before releasing* **before** the
click rather than refusing after it.

### The issue lifecycle — workable, and enforced

LunchBox actions an issue from Operations or from Kitchen production; the
institution acknowledges it on Today's delivery; LunchBox closes it. Three
screens, three parties, one record.

`0051` checked **who** may set a status and never checked **what the issue was
before**. All four of these were accepted:

```
OPEN                     -> CLOSED         (never actioned, never seen)
OPEN                     -> ACKNOWLEDGED   (acknowledging nothing)
CLOSED                   -> ACTIONED       (a closed issue reopening)
ACTIONED                 -> ACTIONED       (silently replacing the note)
```

`0054` states the lifecycle as the database rule it always should have been, and
makes the action note **required** — "we actioned it" with no account of what
was done is a status that survives an audit and answers no question. An internal
Production, Packing or Dispatch issue has no institution in the loop, so it
closes from actioned and can never be acknowledged at all.

### Correction — exposed, and still narrow

`Correct record` appears on the manifest row and the issue row for a Super
Admin, for exactly the three fields `correct_operational_record()` allows:
`delivery_manifests.delivery_point`, `operational_issues.description` and
`operational_issues.category`.

There is **no field picker**, because a field picker is how a correction
facility becomes a database console with an audit row attached. The dialog shows
the current value read-only, requires a different corrected value and a reason,
and says where the original goes. Demand is still corrected by adjusting it and
a completed handover by raising an issue — neither is correctable here.

### Institution receiver management — reachable

Authorised Delivery Receiver is a **capability, not a role**. An Institution
Admin has always been allowed to grant it to their own Admins and Classroom
Staff; the only screen offering it was `/delivery`, which is not in their
sidebar. In practice that meant knowing a URL.

The card now sits on **Today's delivery**, which is in their navigation, and
renders whether or not a delivery is scheduled today.

### Delivery configuration — the interface now matches the matrix

`delivery` has always granted `school_admin` and `kitchen` `'view'` and nothing
else. The screen offered *Change configuration* to whoever opened it, so an
Institution Admin was shown a button that could only ever be refused. It is now
offered only where `can(role, 'delivery', 'update')` holds, and the read-only
view says who to ask. The receiver controls are governed separately, because
they are a separate authority — the Kitchen sees receiver state and is offered
no action, since `set_delivery_receiver()` asks `app_can_manage_institution()`,
which the Kitchen never satisfies.

### The stale Deliveries shell — gone

`/deliveries` rendered a page telling every Super Admin and Driver that
dispatch, delivery states and proof of handover "are not built". That was true
when it was written and false from `0052` onward, which made it the one
dishonest screen in the product.

The shell is deleted and the nav entry with it. The URL is preserved as a
redirect, because three roles had it bookmarked and each of them has a real
screen now:

| Role | Lands on |
| --- | --- |
| Super Admin, Kitchen | `/operations` |
| Driver | `/my-deliveries` |
| Institution Admin, Classroom Staff | `/handover` |

Deliberately a redirect and not a second manifest UI. There is one delivery
workflow, reached from wherever that role does its work.

## The evidence

### `tests/e2e/closure.spec.ts` — one two-run day, driven by clicking

The rule this file enforces: **the action under test is performed through the
interface.** Fixture creation may use the service key or a signed-in RPC —
building a day is not a business action — but at the step the test is named
after, it clicks.

It runs a complete second working day with **two delivery runs**: bulk assign,
activate, exact demand 5 / 5 / 3 / 3, each sitting on exactly one run with the
totals unchanged by the split, a receiver authorised and revoked and
re-authorised, a Driver named on both runs, run 1 completing handover
independently of run 2, a delivery issue actioned and acknowledged and closed by
three different people, an internal Kitchen issue the institution never sees,
and a correction whose original value is still readable in Audit.

### `tests/sql/verify_operability_closure.sql` — 12 named assertions

Including the one that matters most for `active_drivers()`: the Kitchen can name
a Driver **while reading zero driver rows from `app_users`**. The first draft of
that assertion failed, and the cause was the test rather than the product — it
had set `request.jwt.claims` without `set local role authenticated`, so it was
still running as the table owner, which bypasses RLS entirely. A raw table read
taken without that line proves nothing.

### `src/lib/operability.reachability.test.ts` — the regression guard

A **named list** of the four actions, failing if any loses its way into the
product. Deliberately not a rule that every export in `api.ts` must be called by
a component: plenty legitimately are not, and a blunt rule like that produces a
failing test with an obvious wrong answer — delete the export — which is how a
test stops being read.

### `spine.spec.ts` kept its shape and lost its two shortcuts

The bulk assignment and the driver assignment there are now clicks. Nothing else
about it changed: fixture creation is still fixture creation.

## Security

- `active_drivers()` and the replaced `advance_operational_issue()` both set an
  explicit `search_path`, are revoked from `public` and `anon`, and are granted
  to `authenticated` only. The grants are **restated** for the functions that
  already had them: `create or replace` keeps the existing ACL, but relying on
  that means the file stops saying what is true, and `0047` exists because eight
  functions inherited a default nobody had written down.
- No RLS policy was weakened, and no read was widened. The one new read is a
  projection with its own predicate.
- `app_special_meal_reference()` gains the `search_path` it lost in `0049` —
  the one warning the previous release introduced, closed inside the migration
  that had to exist anyway rather than by editing an applied file.
- `0001`–`0053` are untouched.

## What did NOT change

Nothing about the operating model. Student Meal Plan is still child-level
entitlement, delivery configuration is still Institution-level, delivery
frequency still changes transport grouping only, a Special Meal still replaces a
standard Meal one-for-one, and exact fulfilment is still the standard.

`student_plan_enforced_from` remains NULL for every existing production
Institution. Temperature, cold-chain, formal batch/lot traceability,
regulator-approval statuses and any severity model for allergies remain
deferred by decision.
