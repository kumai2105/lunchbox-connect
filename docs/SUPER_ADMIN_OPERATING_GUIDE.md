# Configuring an Institution — the Super Admin operating guide

Everything in this document is done by clicking, signed in as **Super Admin**.
None of it needs a developer, a migration, a SQL statement or a Supabase
dashboard edit. Where a control was missing, that was recorded as a product
operability defect and fixed — see `docs/OPEN_FINDINGS.md`.

An earlier version of this file described "the six business decisions only you
can make". That framing was wrong and has been removed. An Institution's
configuration is not a fixed list of six fields; it is **three effective-dated
record sets plus one action**, and each of the three holds as many rows over
time as the business needs. The count is not a property of the product.

---

## The configuration model, as the database actually defines it

| What                | Table (migration 0016)             | What one row says                                                           | How many                       |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| **Identity**        | `institutions`                     | the name, and whether it is a nursery or a school                           | exactly one, editable          |
| **Service plan**    | `institution_service_plans`        | _these meal periods, from this date_                                        | one per change, forever        |
| **Menu assignment** | `institution_rotation_assignments` | _this menu, from this date, starting on this week of it_                    | one per change, forever        |
| **Calendar rules**  | `calendar_exceptions`              | _this closure / one-off meal change / special period, over these dates_     | as many as the year needs      |
| **Publication**     | `publish_meal_services()`          | not stored configuration — the action that turns the above into dated meals | run whenever something changes |

The three record sets are **effective-dated**. Changing a nursery's package or
its menu means adding a row with a later date — it never edits the old row. The
resolver always takes the newest row dated on or before the day being resolved
(`resolve_rotation_week`, `service_plan_includes`), so days that already
happened keep the configuration they actually ran under. That is what makes
historical reporting honest.

---

## Nothing appears downstream until you publish

```
  Service plan          which periods this Institution is contracted for, from when
        +
  Menu assignment       which menu, from when, starting on which of its weeks
        +
  Calendar rules        closures, one-off changes, special periods
        ↓
  Publish  ──────────►  Meal Services (dated, per period)
                              ↓
              Classroom recording · Parent meal information · Kitchen demand
```

`record_serving_batch` refuses any observation with no published Meal Service
behind it, deliberately, so a meal record can never point at a meal nobody
planned. Until you publish, the register correctly shows nothing to record.

---

## Doing it

### 1 · The Institution record

**Institutions → + Add institution**, or open one and press **Edit institution**
on the Overview tab. Name and type (nursery or school). Both stay editable —
a nursery gets renamed, or was first recorded under the wrong type. Institutions
are never deleted; that is refused at the database, on purpose, because history
references them.

### 2 · The service plan — which periods they bought

**Institutions → open one → Service tab → Contracted meal periods**

Tick the periods this Institution actually pays for, set **Effective from**, and
save. A period ticked here is a period the Kitchen will be asked to produce for,
so check it against the agreement rather than against what the menu happens to
contain.

To change the package later, tick the new set and give a **later** effective
date. The card shows what is in effect _today_, and a timeline underneath shows
every dated row, marked **In effect**, **Scheduled** or **Superseded**. A row
dated in the future can be withdrawn; one that already governs real days cannot,
because withdrawing it would silently restate what those days were.

### 3 · The menu assignment — and the anchor you set only once

**Institutions → open one → Service tab → Assigned menu**

Choose the menu, the effective date, and **Starting rotation week** — which week
of that menu the effective date lands on.

**You set the starting week once.** Every week after that advances by itself
from the calendar: week 2, then 3, then back to week 1. Closures do not shift
it — a closed week still counts as a week — and a year later the same single
anchor is still resolving the right week. Nobody picks a rotation week week by
week. (Proved in `tests/sql/verify_rotation_autoadvance.sql` and by the
"one anchor, and the weeks advance by themselves" end-to-end test.)

Switching menus later works the same way as the package: assign the new menu
from a later date. Earlier days keep the menu they were served under, and the
new menu starts on whichever of _its_ weeks you name.

### 4 · Calendar rules — the exceptions

**Institutions → open one → Calendar tab**

Three kinds, resolved in this order: **closure** beats **date-specific meal
change** beats **special period / camp menu** beats the normal rotation. A rule
can cover one period or all of them, over any date range. A public holiday never
requires rebuilding a menu.

### 5 · Publish a window

**Institutions → open one → Service tab → Publish schedule**

Choose a date range and publish. This creates the dated Meal Services the
Classroom, Parent and Kitchen screens read. Re-publish the affected window after
changing anything above — the configuration change alone does not reach those
screens.

Publishing is safe to repeat. Future services re-resolve; a day whose meal has
already been _served_ is historical and is protected from being rewritten.

---

## What switches on the moment you publish

| Surface                         | What appears                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Classroom (Today)**           | Period tabs for the published periods; the roster becomes recordable; Absent/Unwell/Sleeping in one tap                    |
| **Parent portal**               | Today's meal for their child, the published weekly menu with ingredients and allergens, and results once staff record them |
| **Kitchen (Production Demand)** | Quantities per exact Meal Revision, per date and period, for eligible children only                                        |

---

## Two things to be deliberate about

**Publish only as far ahead as you are willing to stand behind.** Future
services stay editable, so a short first window is the safer choice — publish a
week, watch one real day flow through the Classroom and the Parent portal, then
extend.

**The service plan is a billing statement as much as a technical setting.** A
period ticked here becomes Kitchen production demand and a meal a parent
expects.

---

## Not on this list, on purpose

These remain `NOT_YET_DEFINED` in the specification and are deliberately not
implemented. They are not missing work; they are decisions not yet taken:
guardian unlink semantics, the structured allergy/dietary model, retention and
archival policy, Packing/Dispatch/Delivery, multi-kitchen routing, cross-
institution student transfer, per-institution timezones, meal-performance
classification thresholds.

## Accounts and passwords

Accounts in this platform are **administrator-issued**. This is a product
decision, not a gap: no invitation email is sent, nobody self-registers, and
there is no self-service password reset.

**Creating an account.** Three screens create accounts, all through the same
server-side path (`admin-create-user`), and all three ask you to type the
password yourself:

| Screen               | Who it creates                             | Where            |
| -------------------- | ------------------------------------------ | ---------------- |
| Users                | any role, any institution                  | Super Admin only |
| Institution → Invite | Classroom Staff scoped to that institution | Super Admin      |
| Staff                | Classroom Staff in your own institution    | Nursery Admin    |

The password must be at least 8 characters; Create stays disabled until it is.
The account works the moment it is created — the person signs in with their
email address and the password you set. Give it to them over a channel you
trust.

**Keep a record of what you set.** There is no screen in the application where
anyone — the account holder, a Nursery Admin, or you — can change a password.
The password you type at creation is that person's password until an
administrator issues a different one.

**Issuing a new password.** When someone forgets theirs, it is done in the
Supabase dashboard, not in the application:

1. Supabase → project `llnofriwvnerntrbpehc` → **Authentication** → **Users**
2. Find the account by email address
3. Set a new password
4. Tell the person, over a channel you trust

Tell each institution this at onboarding, so their staff know that a forgotten
password goes to their administrator and not to a "forgot password" link that
does not exist.

**If this model should change**, the two pieces that would replace it are a
"Forgot password?" link on the sign-in screen (which needs email sending
configured on the domain first) and a "Change password" control for a signed-in
user (which needs no email at all). Neither is built today.
