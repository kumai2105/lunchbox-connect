# Founder go-live checklist — the six business decisions only you can make

The software is built, tested and live. What it does **not** have is the
commercial agreement behind each Institution: which meal periods they bought,
which menu they eat, and from when. Nothing in the system invents those, and
nothing should — a migration that guessed a nursery's contract would be
inventing revenue and feeding children off a menu nobody agreed.

This is the whole remaining list. It is six fields across three screens, all
inside the app, as **Super Admin**.

---

## Why nothing shows on the Classroom, Parent or Kitchen screens yet

The dated meal a teacher records against does not exist until it is *published*,
and publishing can only resolve a meal when three things line up:

```
  Service Plan          which periods this Institution is contracted for, and from when
        +
  Rotation assignment   which menu they eat, and which week it starts on
        +
  no closure that day
        ↓
  Publish  ──────────►  Meal Services (dated, per period)
                              ↓
              Classroom recording · Parent meal information · Kitchen demand
```

`record_serving_batch` refuses any observation with no published Meal Service
behind it — deliberately, so a meal record can never point at a meal that was
never actually planned. So until you publish, the register correctly shows
nothing to record.

**Current production state, read directly from the database:**

| | Institution A (nursery) | Institution B (school) |
|---|---|---|
| Classes | 2 | 2 |
| Students | 5 | 5 |
| Service Plan | ✅ 1 — breakfast, snack, lunch, afternoon snack, from 2026-08-20 | ❌ **none** |
| Rotation assignment | ❌ **none** | ❌ **none** |
| Published Meal Services | 0 | 0 |

A meal library already exists: **20 Meals**, each with a revision, and one
rotation ("Legacy menu") carrying **20 slots**.

---

## The six things to enter

### 1 · Service Plan — which periods each Institution bought
**Where:** Institutions → open the Institution → **Service** tab

- **Institution B has no Service Plan at all.** Until it has one, no date
  resolves for that school and nothing can be published for it.
- **Institution A already has one** covering all four periods from 2026-08-20.
  Confirm that is genuinely what they purchased; it was created during setup,
  not from a signed agreement.

### 2 · Purchased meal periods
Part of the same Service Plan form. Tick only the periods the Institution
actually pays for — breakfast, snack, lunch, afternoon snack. A period you tick
here is a period the Kitchen will be asked to produce for.

### 3 · Effective date
Also on the Service Plan. The date the contract starts. Publishing will not
resolve meals for dates before it.

### 4 · Menu / Rotation assignment — which menu they eat
**Where:** Institutions → open the Institution → **Calendar / Service** tab
**Neither Institution has one.** This is the single reason Institution A, which
already has a plan, still shows nothing.

### 5 · Anchor date — which week of the rotation is running now
Set with the assignment. A four-week rotation needs to know which week today
falls in; the anchor is what makes week 1 mean week 1. Get this wrong and the
right meals appear on the wrong weeks.

### 6 · Publish a date range
**Where:** Menu Builder → **Publish**

Choose the Institution and a date range. This creates the dated Meal Services.
Publishing is explicit and reversible for future dates; once a meal has been
*served*, its service becomes historical and is protected from edits.

---

## What switches on the moment you publish

| Surface | What appears |
|---|---|
| **Classroom (Today)** | Period tabs for the published periods; the roster becomes recordable; Absent/Unwell/Sleeping work in one tap |
| **Parent portal** | Today's meal for their child, the published weekly menu with ingredients and allergens, and results once staff record them |
| **Kitchen (Production Demand)** | Quantities per exact Meal Revision, per date and period, for eligible children only |

---

## Two things to be deliberate about

**Do not publish further ahead than you are willing to stand behind.** Future
services stay editable, so a shorter first window is the safer choice — publish
a week, watch one real day flow through the Classroom and the Parent portal,
then extend.

**The Service Plan is a billing statement as much as a technical setting.**
Ticking a period that was not purchased will show up as Kitchen production
demand and as meals a parent expects. Check it against the actual agreement.

---

## Not on this list, on purpose

These remain `NOT_YET_DEFINED` in the specification and are deliberately not
implemented. They are not missing work; they are decisions not yet taken:
guardian unlink semantics, the structured allergy/dietary model, retention and
archival policy, Packing/Dispatch/Delivery, multi-kitchen routing, cross-
institution student transfer, per-institution timezones, meal-performance
classification thresholds.
