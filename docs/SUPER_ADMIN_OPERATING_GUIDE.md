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
implemented. They are not missing work; they are decisions not yet taken: the
structured allergy/dietary model, Packing/Dispatch/Delivery, multi-kitchen
routing, cross-institution student transfer, per-institution timezones,
meal-performance classification thresholds, and who at a nursery (as opposed to
a Super Admin) may end a guardian relationship.

Two things that used to be on this list are now built and are described below:
**ending a guardian relationship** and **the whole account, institution and
class lifecycle**.

## Accounts and passwords

Accounts in this platform are **administrator-issued**. This is a product
decision, not a gap: no invitation email is sent, nobody self-registers, and
there is **no "forgot password" link**. What has changed is what happens
afterwards — a password is no longer frozen at whatever you first typed.

### Creating an account

Three screens create accounts, all through the same server-side path
(`admin-create-user`), and all three ask you to type the password yourself:

| Screen               | Who it creates                             | Where            |
| -------------------- | ------------------------------------------ | ---------------- |
| Users                | any offered role, any institution          | Super Admin only |
| Institution → Invite | Classroom Staff scoped to that institution | Super Admin      |
| Staff                | Classroom Staff in your own institution    | Nursery Admin    |

The password must be at least 8 characters; Create stays disabled until it is.
Every password box has a **Show** control, so you can read back what you typed
before you send it. The account works the moment it is created — the person
signs in with their email address and the password you set. Give it to them
over a channel you trust.

**The role list is shorter than the nine roles in the spec, on purpose.** It
offers Super Admin, Institution Admin, Parent, Classroom staff and Kitchen —
the roles that have a screen behind them. Operations Manager, Finance / Owner,
Viewer and Driver are withheld while their modules are unbuilt, because
creating one of those accounts would hand somebody a working sign-in that leads
to a page saying "not available yet". Each returns to the list on the day its
module ships.

### Issuing a new password

**In the application, on the Users screen.** Find the person, click **Set
password**, type a new one and (optionally) a reason. That is all — you no
longer need the Supabase dashboard for this.

**You cannot look up their existing password, and neither can anyone else.**
The platform stores a one-way hash of it, not the password. If somebody has
forgotten theirs, you issue a replacement; there is nothing to retrieve. There
is no need to keep a written record of passwords you set, and you should not:
the person can change it themselves the moment they are signed in.

The audit log records **that** you issued a password, for whom, and the reason
you gave. It never records the password.

A **Nursery Admin** can do this too, for their own Classroom Staff and for
nobody else.

### Changing your own password

Everyone — you, a nursery manager, a teacher, a kitchen user, a parent — can
change their own password from their own account screen, reached by clicking
their name at the bottom of the sidebar (in the Parent app, from Profile). They
do not need their old password, because they are already signed in.

Tell each institution this at onboarding: a forgotten password goes to their
administrator, and everyone can change their own once they are in.

## Ending things: accounts, institutions and classes

Nothing in this platform is deleted. Everything is **deactivated** or
**archived**, and can be brought back. That is not caution — an account is
named as the actor on audit entries and as the recorder on classroom
observations, an institution owns the record of meals actually served to
children, and a class is what those meals were recorded against. Deleting any
of them would destroy that record or leave it pointing at nothing.

You choose the action. The platform decides whether it is allowed, and when it
refuses it tells you why in words, and does **not** quietly do something weaker
instead.

### Deactivating a person — Users screen

They stop being able to sign in, and any session they already have open stops
reading and writing immediately. Their current class assignments end. Nothing
is deleted, and you can reactivate them at any time.

**Reactivating does not put them back in their old classrooms.** Assign them
again if that is still right — nobody should be returned to a room without
somebody deciding it.

Two things you cannot do, and the screen will say so: **deactivate yourself**,
and **deactivate the last active Super Admin**.

A Nursery Admin can deactivate their own Classroom Staff. Nobody else's.

### Archiving an institution — Institution detail screen

It stops operating: no new classes or students, no schedule or calendar
changes, no publishing, no classroom recording. Everything it has ever recorded
stays exactly where it is and stays readable.

**It is refused while that institution has meal service published for today or
any future date.** That is a commitment the kitchen and its classrooms are
already working to. Resolve the window first.

### Archiving a class — Classes screen

**It must be empty first.** If students or staff are still assigned, archiving
is refused and says so — move them to another class rather than leaving a
closed class holding a roster. Once archived it takes no student, no staff and
no meal record, and it stops appearing anywhere you might put a child.

### Ending a guardian relationship — Parents / guardians screen

**End access** removes one parent's sight of one child, at once, including for
a session they have open. **A reason is required** — this is not something that
should ever be recorded anonymously.

It removes the link and nothing else. Their account survives (they may be
guardian to another child), the child survives, and every meal record survives.
You can link them again at any time.

Only you can do this. Whether a nursery should be able to, and on whose
authority, is a decision that has not been taken.

### Correcting details

- **A person's name or phone** — Users → Edit, or from their own account
  screen.
- **A child's name, ID or grade** — the child's profile → Edit details.
- **An institution's name or type** — Institution detail → Edit institution.

**An email address cannot be changed anywhere.** It is what the person signs in
with, and it is held both by the sign-in service and in their profile; a change
is only correct if both move together with the new address confirmed, and that
workflow does not exist yet. To move somebody to a new address, create their
new account and deactivate the old one.

**A role cannot be changed in place either.** A role decides what an account is
allowed to read, and rewriting it would give a session already in someone's
browser a reach it was never issued for. Create a correctly-scoped account and
deactivate the old one.

### Archiving a meal or a menu

Both are on their own screens, both confirm first, and they do different
things:

- **Archiving a Meal** takes it out of menu building. Menus that already use it
  keep it, days already published keep it, and every record of a child eating
  it keeps the recipe it had on the day.
- **Archiving a Menu** closes it for editing and stops it being assigned to an
  institution. Days already published from it are unaffected — publishing makes
  a dated meal service in its own right, which does not read back from the
  menu.

Neither is a delete; both restore.
