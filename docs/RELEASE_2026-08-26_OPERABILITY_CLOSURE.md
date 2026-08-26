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

### And a fifth thing, which the closure found rather than closed

The browser test that drives the new Driver selector could not find it:

```
Locator: getByLabel('Driver for ZZ E2E Closure … run 1')
Expected: 1   Received: 0
```

The selector's label is built from the manifest's institution name, and the
name was not there. `delivery_manifests_select` lets the Kitchen read every
manifest — correctly, the Kitchen dispatches them — but
`app_can_see_institution()` has **no `kitchen` branch**, so the Kitchen cannot
read `institutions`. PostgREST returns an unreadable embedded row as **null**
rather than as an error, so `select *, institutions(name)` handed the screen a
manifest with no site on it and no complaint.

This is the same defect the Driver's screen had before `0053`, one role along,
and it has been live since `0052`. The Dispatch table showed a blank
institution for every run, and the **labels dialog** — the sheet the packing
bench prints and sticks on the crate — put a blank line where the destination
goes. Nothing asserted the name, so nothing failed.

`manifests_for_date()` closes it by projection: the predicate is
`delivery_manifests_select` restated word for word, so no role sees a manifest
it could not already see, and the row now carries the name of the place it is
going to. The Kitchen still cannot read `institutions`, and the SQL suite
asserts exactly that while the Kitchen reads two named manifests.

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

### `tests/sql/verify_operability_closure.sql` — 14 named assertions

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

### Two test defects, and one of them mattered

**Every disposable-institution teardown in the suite was silently failing.**
They ended at `delete from institutions`, which is **refused** once a day has
actually been lived — `delivery_manifests.institution_id` is
`on delete restrict` — and PostgREST returns the refusal in `error` rather than
throwing. Institutions and their manifests were surviving into later specs, and
that is how `spine.spec` hit a strict-mode violation against a manifest
belonging to an institution that should no longer have existed.
`removeInstitutionDay()` deletes through the restrict edges in order and
**checks** the final delete, so a missed reference fails the spec that owns it
instead of the spec that runs next.

**A dead click had no cap at all.** Playwright's default `actionTimeout` is
`0` — no cap — so `locator.click()` on a control that never becomes actionable
waits out the whole TEST timeout, which was 240s here. Four dead clicks would
be sixteen minutes, the step cap would kill the job before the reporter ran,
and the run would produce a red square with no locator in it.

That is a latent property of the configuration rather than something observed:
the run that prompted the change was cancelled on a **misread of how much time
had passed**, not on evidence of a hang. The cap is kept anyway, because the
property is real and the failure mode it prevents is the worst kind — a red
job with nothing in it to act on. `playwright.config.ts` now caps actions at
15s and navigation at 30s, so a stuck interaction becomes a named failure with
the locator printed. 15s is longer than any real interaction in this app and
the same order as the `expect()` timeout beside it.

The step and job caps were left alone: nothing has shown the suite needs more
than 15 minutes, and raising a cap to accommodate an unmeasured problem is how
a cap stops meaning anything.

### `spine.spec.ts` kept its shape and lost its two shortcuts

The bulk assignment and the driver assignment there are now clicks. Nothing else
about it changed: fixture creation is still fixture creation.

## Security

- `active_drivers()`, `manifests_for_date()` and the replaced
  `advance_operational_issue()` all set an
  explicit `search_path`, are revoked from `public` and `anon`, and are granted
  to `authenticated` only. The grants are **restated** for the functions that
  already had them: `create or replace` keeps the existing ACL, but relying on
  that means the file stops saying what is true, and `0047` exists because eight
  functions inherited a default nobody had written down.
- No RLS policy was weakened, and no read was widened. Both new reads are
  projections whose predicates restate rules that already existed —
  `manifests_for_date()` is `delivery_manifests_select` word for word.
- `app_special_meal_reference()` gains the `search_path` it lost in `0049` —
  the one warning the previous release introduced, closed inside the migration
  that had to exist anyway rather than by editing an applied file.
- `0001`–`0053` are untouched.

Measured on production after the apply, not predicted: **0 advisor ERRORS**.
`function_search_path_mutable` fell 4 → 3, which is the
`app_special_meal_reference()` fix landing.
`authenticated_security_definer_function_executable` rose 104 → 106 — the two
genuinely new functions, granted to `authenticated` on purpose.
`anon_security_definer_function_executable` stayed at **39**, which is the
number that would have signalled a real mistake. Recorded in full as finding 19
of `docs/OPEN_FINDINGS.md`.

## `0055` — the Kitchen can see which site each production line is for

Added after the closure shipped, because the release that follows it is the
onboarding of a second Institution, and that is what turns Finding 17 from a
cosmetic note into an operational hazard.

The Production and packing table listed one row per finalised sitting and
rendered only the period:

```
Sitting   Required   Production   Packing
Lunch     18         READY        WAITING_FOR_PRODUCTION
Lunch     23         READY        WAITING_FOR_PRODUCTION
```

Two sites, two rows identical but for a quantity that could legitimately
match — and the buttons beside them mark food **produced** and **packed**.

The cause is the one this release already met once: `final_demand` carries
`institution_id`, the Kitchen cannot read `institutions`, and PostgREST returns
an unreadable embed as **null** rather than as an error. Embedding the name
would have produced a blank column and no complaint.

`final_demand_for_date()` closes it by projection: the predicate restates
`final_demand_select` word for word, the join adds the name, superseded rows are
dropped, and the ordering is by site so a two-site day groups on the bench. The
table leads with a **Site** column, and each state action names its site and
sitting — which also let `closure.spec` and `spine.spec` stop clicking "the
first button on the screen", closing a cross-spec hazard `closure.spec` had
already flagged in a comment of its own.

`verify_kitchen_sees_the_site` adds 5 assertions. The one that matters is that
the Kitchen reads two **named** production lines while reading **zero** rows
from `institutions`.

## One open question closed on the way past

Finding 18 asked whether Cloudflare's Git integration — which builds and
comments "Deployment successful" on every push to this branch — publishes to
the live custom domain. If it did, every commit would push a frontend ahead of
its backend, which is the one ordering this project treats as non-negotiable.

It was settled by fingerprint rather than by argument. Vite names an asset from
its content, so the bundle filename identifies the tree that built it.
`prod-smoke` pointed at `https://www.lunchboxconnect.com` — after Cloudflare
had built `0122466` and `2a5c0ee` from this branch — reported
`index-X1uI2czC.js`. Rebuilding both candidate trees with `deploy.yml`'s exact
build environment gives `index-SnlDdnhZ.js` for this branch's head and
`index-X1uI2czC.js` for `5d6b506`, the last deliberate deploy.

The live site is the last deliberate deploy, and it did not move while the Git
integration built this branch twice. **The integration is preview-only, and
`deploy.yml`'s backend-readiness gate is not bypassable by a push.** Confirmed
before this release's frontend deploy, because afterwards the question would
have been unanswerable from outside.

## What did NOT change

Nothing about the operating model. Student Meal Plan is still child-level
entitlement, delivery configuration is still Institution-level, delivery
frequency still changes transport grouping only, a Special Meal still replaces a
standard Meal one-for-one, and exact fulfilment is still the standard.

`student_plan_enforced_from` remains NULL for every existing production
Institution. Temperature, cold-chain, formal batch/lot traceability,
regulator-approval statuses and any severity model for allergies remain
deferred by decision.
