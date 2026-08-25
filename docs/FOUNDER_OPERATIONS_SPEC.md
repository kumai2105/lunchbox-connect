# LunchBox Connect — Founder Operations Specification

**Canonical.** This is the operating model the software implements, written for
the person who runs the business and for whoever builds on it next. Where an
older document disagrees with this one on the topics below, this one is current
and the older statement is superseded — marked as such rather than deleted,
because the reasoning is worth keeping.

Established by migrations `0048`–`0053`, released 25 August 2026.

---

## 1. The five things that are not the same thing

Most confusion in this domain comes from collapsing concepts that sound
adjacent. They are kept apart deliberately, in the schema and in the interface.

| Concept | The question it answers | Where it lives |
| --- | --- | --- |
| **Institution service configuration** | *What can LunchBox provide at this **site**?* | `institution_service_plans.periods` |
| **Student Meal Plan** | *What does **this child** receive?* | `meal_plans` + `student_meal_plans` |
| **Menu / Rotation** | *What **food** is served for this date and sitting?* | `rotations`, `rotation_slots`, `meal_services` |
| **Eligibility** | *Is this child currently receiving LunchBox service at all?* | `students.operational_status` |
| **Special-meal decision** | *Given a dietary requirement, what does this child **actually** eat?* | `special_meal_resolutions` |

**Never infer one from another.** In particular, a site that serves Lunch does
not mean every child there receives Lunch.

### The case that makes it concrete

Two children, same Class, same Menu:

- **Child A** — Breakfast + Morning snack.
- **Child B** — Breakfast + Morning snack + Lunch + Afternoon snack.

Tuesday's Lunch is Chicken Curry. Child B receives it. Child A receives
**nothing**, and must never appear as 0%, missing, incomplete, absent, or in
Lunch production demand. Lunch is simply not part of what Child A receives.

---

## 2. Meal Plans

A Meal Plan is a **service entitlement**: a named set of the existing Meal
Periods (`breakfast`, `snack`, `lunch`, `afternoon_snack`). No new period type
exists or should be invented.

**It is not a commercial package.** There is no price, no billing, and no
"Package 1 / Package 2" in the schema. Commercial terms attach later through
their own approved rules. Hard-coding today's price list into the data model
would outlive the price list.

- Plans are LunchBox-controlled and reusable.
- A Super Admin decides which Plans are **available** at each Institution.
- An Institution Admin **reads** Plans and each child's current Plan. They do
  not author Plans and do not change a child's entitlement.
- **Retiring** a Plan stops new assignments. Existing and historical
  assignments stay truthful.
- A Plan that is already assigned may be **renamed** but its periods are frozen.
  Re-composing it would silently change what every past assignment meant,
  including for days already served. Create a new Plan and schedule a change.

### Assignment

`student_meal_plans` is effective-dated, `effective_until` inclusive.

**One child holds exactly one effective Plan on any date.** This is enforced by
a GiST exclusion constraint, not by application code, because every downstream
calculation is entitled to assume it.

Changing a Plan **ends** the old assignment the day before the new one starts
and opens a new row. September is never rewritten because October changed.

---

## 3. The non-destructive rollout

Production already serves children who have no Plan, because the concept did
not exist until `0048`. Three ways of guessing were available and all three are
refused:

- copying the site's service periods onto every child,
- inferring a Plan from historical serving records,
- defaulting everyone to "everything".

Instead, each Institution carries `student_plan_enforced_from`:

- **NULL** — not switched over. Production demand keeps its **exact pre-0048
  meaning** for that site. Nothing changes.
- **A date** — on and after it, Meal Plan entitlement governs production.

`activate_student_meal_plans()` **refuses** while any operationally active child
would be served without a valid Plan, and names every one of them. The switch
therefore cannot silently drop a child out of production.

`app_plan_enforced()` is the single place this boundary is decided, so the
cutover cannot mean one thing to the Kitchen and another to the Classroom.

---

## 4. Exact demand

One Meal is required for one child when **all** of these hold:

1. a Published Meal Service exists,
2. the Institution is active,
3. the site's service configuration includes that Meal Period,
4. the child is operationally active for LunchBox service,
5. the child holds an effective Meal Plan on that date,
6. that Plan contains the Meal Period,
7. any approved dietary requirement has a recorded operational resolution.

Conditions 5 and 6 apply only on and after that Institution's enforcement date.

**A special Meal replaces the standard Meal — it never adds one.** 80 entitled
children with 3 alternatives is 77 standard + 3 special = **80**. Never 83.
`standard_required` is computed as *entitled minus those holding an
alternative*, so the total cannot inflate arithmetically, and `final_demand`
carries a CHECK that `total = standard + special`.

### Attendance is not entitlement

`Absent`, `Unwell` and `Asleep` are Classroom recording states. They never
retro-reduce demand: the Meal was made because the child was entitled to it,
and that stays true. Any future pre-notified-absence adjustment is a separate
business rule that does not yet exist.

---

## 5. Dietary requirements and special meals

`students.medical_notes` is free text an Institution typed. It is **not**
parsed, string-matched, migrated, or treated as an authoritative record. A
Super Admin is shown that a legacy note exists and must read it; the software
draws no conclusion from it.

There is **no severity scale, no diagnosis field, no "safe" flag, and no
automatic conflict engine**. Free text cannot carry a child-safety guarantee,
and a screen that said "safe" on the strength of a string match would be worse
than one that says nothing — it would be trusted.

The controlled flow:

1. **Institution Admin submits** a factual requirement for their own child.
2. **Super Admin reviews** — approve, needs clarification, or reject.
3. For each entitled Published Meal Service, **a Super Admin decides** what that
   child is actually served:
   - `STANDARD_CONFIRMED` — a person looked at this requirement and this Meal
     and decided the standard Meal is right. A decision, not a default.
   - `ALTERNATIVE_ASSIGNED` — a named Meal Revision from the Meal Library.
     Never food typed into a box that the Library has never seen.

**An approved requirement with no recorded decision blocks finalisation.**
Nobody should be cooking while it is unknown what one of the children is being
served.

---

## 6. Exact fulfilment is the standard

Normal LunchBox operation is:

> **REQUIRED = PRODUCED = PACKED = DISPATCHED = HANDED OVER**

The software is shaped around that, not around daily variance. The Kitchen
never retypes a quantity the system already calculated: *Mark production
complete* **means** "the exact Final Demand was produced". The receiver is not
asked to count 120 packages when the manifest says 120 — that only adds a
chance to type 12.

Exceptions exist because robust software needs somewhere to record an abnormal
event. They are secondary buttons, never the main flow.

**Special Meals are confirmed individually**, by reference. "We made the three
specials" is a weaker assurance than "this child's Meal was made", and the
difference is exactly the child who gets the wrong tray.

---

## 7. Finalisation and late change

`final_demand` is a **snapshot**. Once the Kitchen is cooking, the numbers they
cooked to are a fact about the day.

- Ordinary changes upstream do **not** rewrite it.
- `demand_drift()` surfaces any divergence as a visible decision.
- **Apply adjustment** supersedes the snapshot (keeping the original) and
  requires a reason. **Keep finalised demand** is also recorded, with a reason.

Nothing silently mutates a finalised figure.

---

## 8. Delivery

Delivery configuration is effective-dated per Institution: **one or two runs a
day**, each with a window, plus the agreed delivery point.

**Delivery frequency changes transport grouping, never entitlement or total
demand.** Two runs carry the same already-calculated Meals in two vehicles.

Two invariants, both structural:

- `delivery_config_run_periods` is keyed `(config, period)`, so a period
  **cannot** be assigned to two runs.
- `set_delivery_config()` refuses to leave any serviced period unassigned.

**Nothing is defaulted for an existing Institution.** No configuration means no
manifest and a screen that says `DELIVERY CONFIGURATION REQUIRED`. The
commercial "one delivery" norm is not permission to write a row on every site's
behalf.

### Custody

```
PREPARING → READY_FOR_DISPATCH → RELEASED → IN_TRANSIT → ARRIVED → HANDED_OVER
```

The **Driver carries**; the **Institution receives**. A Driver can record
collection and arrival and **cannot** complete handover — that is the
institution's own act, by a person it deliberately authorised.

**Authorized Delivery Receiver is a capability, not a role.** It grants the
handover action for one Institution and widens nothing else. Only that site's
own active Admin or Classroom Staff are eligible. Parents never are.

A receiver may **accept custody with an issue open**. That records both, and
closes neither.

---

## 9. Reporting and closure

Reconciliation shows an ordinary day as ordinary: required 80, produced 80,
packed 80, handed over, specials 3 of 3, issues 0. This is deliberately not a
variance-management product.

**Classroom completion is reported separately and never blocks closure.**
Logistics finished when the food was handed over; whether institution staff have
finished recording intake is a different fact about a different organisation.

Analytics denominators count only children **entitled** to that sitting. A
morning-only child can never reduce Lunch completion by existing.

Closing the day asserts every production, packing and delivery step reached a
final state and every special Meal is accounted for. An issue already accepted
at handover stays open and stays visible.

---

## 10. Corrections

Completed operational events are never hard-deleted or silently overwritten.
`correct_operational_record()` records the old value, the new value, the actor
and the reason — and it is deliberately **not** a generic row editor. It works
on an allow-list of named fields. A correction facility that can write any
column of any table is a database console with an audit row attached, and it
would be used as one.

Demand is corrected by **adjusting** it. A completed handover is corrected by
**raising an issue**.

---

## 11. Deferred — stated, not implied

These are **not** built, and the software makes no claim about them:

- **Temperature / cold chain.** No ranges, checkpoints, acceptance thresholds or
  rejection rules. The applicable official requirements are not confirmed for
  this software state, and inventing them would be manufacturing regulatory
  compliance. `DEFERRED — REGULATORY / OPERATING RULE CONFIRMATION REQUIRED.`
- **Formal batch / lot traceability.** Internal Production Run and Manifest IDs
  exist for internal reconciliation and are not modelled or marketed as
  regulated lot traceability.
- **Regulator approval statuses.** No "Dubai Municipality Approved" or
  equivalent exists, because no verified workflow for one exists.
- Multi-kitchen routing, billing automation, procurement, route optimisation, an
  attendance system, Parent chat or payments, and AI features.

Kitchen remains a separate operational entity from Institution so today's
physical kitchen is not hard-coded into the customer model. Jazeel Restaurant is
the current operating kitchen; multi-kitchen routing remains undefined.

---

## 12. Where each rule is enforced

| Rule | Enforced by |
| --- | --- |
| One effective Meal Plan per child per date | GiST exclusion constraint, `0048` |
| Plan periods ⊆ site's serviced periods | `assign_student_meal_plan()` |
| Activation requires complete roster | `activate_student_meal_plans()` + `institution_plan_readiness()` |
| Legacy demand unchanged pre-enforcement | `app_plan_enforced()` / `app_student_counts_for()` |
| Special replaces standard, one for one | `final_demand` CHECK + demand arithmetic |
| Approved requirement blocks finalisation | `finalize_demand()` |
| Alternative must be a real Meal Revision | `resolve_special_meal()` |
| Specials individually accounted | `complete_production()` / `complete_packing()` |
| One run per serviced period | `(config, period)` primary key + `set_delivery_config()` |
| Driver cannot hand over | `confirm_handover()` |
| Receiver must be authorised for that site | `app_is_delivery_receiver()` |
| Kitchen sees minimum child data | `kitchen_special_meals()` projection |
| Parent sees no logistics | RLS on every spine table |

Every one of these is proved in `tests/sql/verify_operational_spine.sql` and
`tests/sql/verify_spine_scenarios.sql`, and driven through the product in
`tests/e2e/spine.spec.ts`.
