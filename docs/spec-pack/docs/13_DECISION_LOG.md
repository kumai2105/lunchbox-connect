# 13_DECISION_LOG.md — LunchBox Connect

## 1. Purpose

This document records confirmed LunchBox Connect decisions and known superseded rules.

It is not a brainstorming log.

Only confirmed decisions belong here.

Where the exact original decision date was not recovered, the date field is marked:

`DATE_NOT_RECOVERED`

This file was compiled into the software specification pack on:

`2026-08-14`

---

## Decision 001 — Product Positioning

**Date:** `DATE_NOT_RECOVERED`

**Decision:** LunchBox Connect is an institutional child nutrition operating system / Institutional Nutrition System, not merely a catering company and not a consumer food-delivery marketplace.

**Status:** ACTIVE

---

## Decision 002 — Connected System Principle

**Date:** `DATE_NOT_RECOVERED`

**Decision:** LunchBox Connect must operate as one connected system using authoritative shared data rather than separate portal-specific truths.

Confirmed chain:

`Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting`

**Status:** ACTIVE

---

## Decision 003 — Commercial Counterparty

**Date:** `DATE_NOT_RECOVERED`

**Decision:** The Institution is the commercial customer in the MVP.

Parents pay the Nursery / School.

Nursery / School pays LunchBox Connect.

**Status:** ACTIVE

---

## Decision 004 — Direct Parent Payment Removed From MVP

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Direct Parent payment to LunchBox Connect is not part of the MVP.

Excluded:

- Parent checkout;
- Parent payment gateway;
- Parent LunchBox Connect invoices;
- Parent LunchBox Connect refunds;
- direct Parent LunchBox Connect subscription billing.

**Supersedes:** Historical agreement wording referring to direct Parent-payment enrolments.

**Status:** ACTIVE

---

## Decision 005 — Confirmed Operational Eligibility Value

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Confirmed eligible Student status:

`ACTIVE_BILLABLE_TO_NURSERY`

Only eligible Students may enter the standard Production, Delivery, and Serving chain.

Full status state machine remains undefined.

**Status:** ACTIVE

---

## Decision 006 — One Authoritative Student Record

**Date:** `DATE_NOT_RECOVERED`

**Decision:** The same Student must not exist as disconnected independent records in Parent, Nursery, Classroom, Kitchen, and Logistics portals.

**Status:** ACTIVE

---

## Decision 007 — Super Admin

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Super Admin is the system-wide master-control role.

Confirmed domains include Institutions, Users, Students, Classes, Guardians, Menus, Allergy approvals, operational statuses, billing cycles, Kitchen, Deliveries, Reporting, system configuration, audit information, and overrides.

**Status:** ACTIVE

---

## Decision 008 — Nursery / School Admin Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Nursery / School Admin is limited to its own Institution.

**Status:** ACTIVE

---

## Decision 009 — Parent Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Parent / Guardian access is limited to own authorized child / children.

**Status:** ACTIVE

---

## Decision 010 — Classroom Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Teacher / Nurse / Classroom Staff access is limited to assigned Class / Classes.

**Status:** ACTIVE

---

## Decision 011 — Kitchen Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Kitchen Operations receives Production and required Allergy / Dietary information only and must not receive unnecessary Parent / finance data.

Kitchen must not independently invent Student counts.

**Status:** ACTIVE

---

## Decision 012 — Driver Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Driver / Logistics access is limited to assigned Deliveries.

**Status:** ACTIVE

---

## Decision 013 — Finance / Owner Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Finance / Owner is reports only.

**Status:** ACTIVE

---

## Decision 014 — Viewer Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Viewer is read-only.

**Status:** ACTIVE

---

## Decision 015 — Operations Manager

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Operations Manager has Operational Logs and Operational Issues.

Exact organizational scope remains:

`NOT_YET_DEFINED`

**Status:** ACTIVE / PARTIALLY DEFINED

---

## Decision 016 — No Live Chat

**Date:** `DATE_NOT_RECOVERED`

**Decision:** No live chat in MVP.

**Status:** ACTIVE

---

## Decision 017 — Classroom Daily View

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Teacher / Nurse / Classroom Staff has a role-based daily / “Today” operational concept.

Previously established meal-tracking categories:

- Breakfast;
- Snack;
- Lunch;
- Afternoon Snack.

**Status:** ACTIVE

---

## Decision 018 — Parent-Visible Notes Protection

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Unrestricted classroom free-text notes do not automatically become Parent-visible.

Parent-visible notes must use:

- safe predefined status; or
- review before publication.

Exact review flow remains:

`NOT_YET_DEFINED`

**Status:** ACTIVE

---

## Decision 019 — Kitchen Production Source

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Kitchen Production Demand derives from authoritative eligible Student data and approved Meal information.

Kitchen cannot create an independent authoritative Student-count system.

**Status:** ACTIVE

---

## Decision 020 — Dispatch / Delivery Chain

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Dispatch relates to actual Production, and Delivery relates to Dispatch.

**Status:** ACTIVE

---

## Decision 021 — Responsibility After Handover

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Current service model places internal serving / feeding responsibility with the Nursery / School after completed Delivery handover.

**Source alignment:** Current Nursery agreements.

**Status:** ACTIVE

---

## Decision 022 — Historical Contract Commercial Values Are Not Permanent Software Logic

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Contract prices, minimum Student counts, prepayment periods, and delivery terms are reference data unless explicitly approved as software configuration rules.

**Status:** ACTIVE

---

## Decision 023 — Menu / Nutrition Source Status

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Existing Menu and Nutrition documents may be used as reference / seed evidence, but approximate Nutrition values and Nurse Review Draft content must not be presented as final operationally approved Nutrition truth.

**Status:** ACTIVE

---

## Decision 024 — Technical Stack Not Yet Approved

**Date:** `DATE_NOT_RECOVERED`

**Decision:**

`TECHNICAL_STACK = NOT_YET_DEFINED`

LunchBox Connect must not inherit another project's stack by assumption.

**Status:** **SUPERSEDED by Decision 034.** The technical stack has since been
approved (A1–A3) and implemented; it is no longer undefined. The original
caution — do not inherit another project's stack by assumption — still holds,
but the stack itself is now the approved one recorded in Decision 034.

---

## Decision 025 — No Automatic Native App Requirement

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Native iOS and Android are not confirmed MVP requirements.

**Status:** ACTIVE / NOT YET DEFINED FOR FUTURE

---

## Decision 026 — No External Provider Approved Yet

**Date:** `DATE_NOT_RECOVERED`

**Decision:** No specific provider is currently approved for payment, WhatsApp, SMS, email, authentication, analytics, maps/routing, external Nutrition data, or School/Nursery management integration.

**Status:** ACTIVE

---

## Decision 027 — No Unsupported Completion Claims

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Code existence, a successful build, or a rendered UI is not sufficient proof of completion.

Completion requires evidence against approved acceptance criteria.

**Status:** ACTIVE

---

## Decision 028 — Independent Verification and Release Gate

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Implementation must be independently verified and subject to a release gate that can block unsupported approval.

**Status:** ACTIVE

---

## Decision 029 — Undefined Means Undefined

**Date:** `DATE_NOT_RECOVERED`

**Decision:** When a project rule has not been approved, Claude Code must mark it:

`NOT_YET_DEFINED`

rather than invent it.

**Status:** ACTIVE

---

## Decision 030 — Specification Pack Governance

**Date:** `2026-08-14`

**Decision:** The LunchBox Connect software build is governed by `CLAUDE.md` and the numbered specification pack. Files are built from confirmed facts, with unresolved items explicitly left undefined.

**Status:** ACTIVE

---

## Decision 031 — Kitchen Operating Model (Independent Entity)

**Date:** `2026-08-18`

**Decision:** Kitchen is a confirmed independent LunchBox Connect operational entity. It belongs to the LunchBox Connect operational side, not to any Nursery / School, and is not owned by or duplicated per Institution.

The correct operational relationship is:

`Institution → Eligible Students → Production Demand → Kitchen → Production → Dispatch → Delivery → Institution`

For the MVP:

- The current production Kitchen is **Jazeel Restaurant**. This is current operational data, not permanently hard-coded business logic.
- LunchBox Connect intends to later operate its own dedicated Kitchen. Changing the operational Kitchen must not require rebuilding or corrupting Institutions, Students, Classes, Guardians, eligibility, Menus, Allergy / Dietary data, Classroom records, Parent accounts, Delivery history, or Reporting.
- Kitchen user accounts are LunchBox Connect-side accounts. They are provisioned only by Super Admin. Nursery / School Admin must not create or manage Kitchen accounts.
- Kitchen users receive only the Production and required Allergy / Dietary information needed for their approved work (per Decision 011 / Decision 019, both still ACTIVE and unchanged by this decision).
- Kitchen users must never be able to change Student eligibility to alter Production Demand (per Decision 019, unchanged).

**Not approved MVP behavior** (remain `NOT_YET_DEFINED`, must not be implemented by assumption):

- multiple active Kitchens operating simultaneously;
- Kitchen territories;
- geographic Kitchen assignment;
- automatic Kitchen selection;
- Production splitting between Kitchens;
- Kitchen capacity planning;
- Kitchen overflow rules;
- branch-to-Kitchen routing;
- Kitchen transfer workflows.

**Supersedes:** Nothing. Supplements Decision 011 (Kitchen Scope) and Decision 019 (Kitchen Production Source), both of which remain ACTIVE and unchanged — this decision adds the entity/ownership model those decisions did not previously specify.

**Status:** ACTIVE

---

## Decision 032 — Classroom Meal Tracking, Parent Visibility, Meal Analytics & Staff Usability

**Date:** `2026-08-18`

**Decision:** Finalizes the previously-provisional classroom meal-recording data model and defines the fast tablet workflow, Parent-visible derived views, LunchBox Connect Meal-performance analytics, and Student photo support, all sourced from one authoritative Classroom Meal Record.

**Supersedes:** The provisional demo `meal_outcome` value set (`full`/`partial`/`refused`/`absent`), which `docs/BUILD_STATUS.md` already flagged as provisional and never finalized. Replaced by the structured fields below.

Confirmed structured fields on the Classroom Meal Record (one row per Student × Meal period × service date):

- **served_status**: `SERVED` / `NOT_SERVED`. `NOT_SERVED` never implies 0% consumed — they are different facts.
- **consumption_pct** (only when served): one of `0 / 25 / 50 / 75 / 100`. No free-text substitute is authoritative.
- **behavior**: `ATE_INDEPENDENTLY` / `NEEDED_ENCOURAGEMENT` / `REFUSED`.
- **low_intake_reason** (shown when intake is low, i.e. 0% or 25%): `NOT_HUNGRY` / `DID_NOT_LIKE_IT` / `DISTRACTED` / `SLEEPING` / `ABSENT` / `UNWELL` / `OTHER`. Whether it is mandatory at 0%/25% is left to implementation; the data model and UI must support it either way.
- **concern_observed**: boolean (`NO_CONCERN` / `CONCERN_OBSERVED`). Only surfaces a note field when true.
- **note**: existing internal free-text field (`serving_notes`) — unrestricted text still never auto-publishes to Parents (Decision 018 unchanged).
- **menu_item_id**: ~~the specific Menu row this observation was recorded against, resolved via the same week/weekday/period lookup the Parent menu view already uses.~~
  **SUPERSEDED for new operations.** Classroom observation traceability now runs
  `meal_service_id → meal_revision_id → meal_id`: the dated, published Meal Service the
  observation was recorded against, and through it the exact Meal Revision served. That is
  what makes a historical record still show January's recipe after March's edit, which the
  week/weekday/period lookup could not express.
  Every NEW Classroom Meal Record must carry `meal_service_id` (migrations 0029/0033); the
  `menu_item_id` column is **retained for pre-cutover records** and must not be deleted —
  it is the only link those historical rows have. No new operation writes it.

**Absence/exception handling is mandatory, not decorative:** `ABSENT`, `UNWELL`, `SLEEPING`, and `NOT_SERVED` must never count as evidence of Meal dislike in any analytics or Parent-facing summary. Meal-preference metrics are computed over the valid observation population only (served, and not one of those exception reasons).

**Same record, three authorized outcomes:** the Nurse/Teacher records once. That one Classroom Meal Record simultaneously feeds (a) the authorized Parent view (today's meals, human-readable consumption, weekly insights), and (b) aggregated LunchBox Connect Meal-performance analytics (Super Admin — no separate "management" role exists yet, so this uses the existing Decision 007 Super Admin reporting domain, not a new role). No duplicate entry, no duplicate source of truth (Decision 006).

**Meal-performance classifications** (`KEEP` / `MONITOR` / `REVIEW_IMPROVE` / `CANDIDATE_FOR_REMOVAL`) are internal decision-support labels a human reads from the analytics. The software must never auto-remove, auto-substitute, or auto-modify a Meal from analytics alone.

**Student photo:** optional, operational-identification purpose only (recognizing a child quickly in a roster of 15-30). Not mandatory at Student creation. Never a public/unrestricted URL — governed by the same `app_can_see_student` boundary as the rest of the Student record (Decision 006/010). Kitchen and Driver do not receive Student photos merely by preparing or delivering a Meal (Decision 011/012 unchanged).

**Staff usability is an explicit product requirement, not a nice-to-have:** the classroom workflow is evaluated on taps-per-student, typing avoided, and exception-first design (extra fields appear only when triggered), not merely on "does it technically work."

**Not approved yet** (remain `NOT_YET_DEFINED`, do not implement by assumption): AI Meal recommendations, automatic clinical interpretation, automatic Meal removal, mood/psychology scoring, social comparison between children, exact-grams consumption, Meal/Menu versioning beyond the existing week/weekday/period model, edit-window/locking rules beyond an immediate same-session correction.

**Status:** ACTIVE

---

## Decision 033 — Master Operating Logic Lock: Meal → Rotation → Calendar → Service Plan → Meal Service

**Date:** `2026-08-18`

**Decision:** Locks the full operating chain from the reusable Meal through to the dated Meal Service that every downstream domain shares. Establishes five previously-absent domain concepts and the deterministic rules that connect them.

**Supersedes:** the clause in Decision 032 listing _"Meal/Menu versioning beyond the existing week/weekday/period model"_ as `NOT_YET_DEFINED`. Meal revisions and Rotation/Calendar separation are now approved and specified here. Also supersedes the implicit assumption in migration `0002` that a single flat `menus` table keyed by `(week_number, weekday, period)` is the authoritative Menu model — that table conflated five distinct concepts and could not express any of them correctly.

### Approved concepts (previously conflated)

- **Meal** — a reusable food item in the Meal Library. Not a date, not a Menu, not a Calendar.
- **Meal revision** — an immutable snapshot of a Meal's content. Historical truth is preserved by reference to a revision, never by mutating the Meal.
- **Rotation** — a reusable arrangement of Meals across week number × weekday × Meal period. Rotation length is **data-driven**; a four-week rotation is the current business reference, never a hard-coded limit.
- **Institution Service Plan** — which Meal periods an Institution actually receives, with effective dates. The master Rotation may contain four periods while an Institution receives three; the Institution must not receive the fourth.
- **Meal Service** — the resolved, dated fact: Institution + service date + Meal period + Meal revision. This is the shared operational anchor for Production, Kitchen, Classroom, Parent and Analytics. No portal independently re-resolves what was served.

### Calendar resolution precedence (deterministic, in order)

1. Explicit closure / no-service → no standard Meal Service is generated.
2. Explicit date-specific override → use the override.
3. Special period / camp assignment → use the special configuration.
4. Normal active Rotation assignment for that Institution.
5. Nothing applicable → **no Meal is fabricated.**

### Mandatory invariants

- **Past truth survives future edits.** Editing a Meal creates a new revision; a Meal Service that **carries Classroom Meal Records** keeps the revision those records were filed against. January history never retroactively shows March's recipe.
  - **Correction (future-republish).** Publication alone does not freeze a Meal Service. A **future, unserved** published service may be deliberately re-resolved — a later override, closure or rotation change is applied by republishing, and the dated rows move with it. Immutability attaches to a service that has been **served** (it carries serving records), not to one that has merely been published. An earlier version of this line said "already-published", which would have frozen next week's menu against a correction the Founder had approved; the implementation (migration 0030) follows the rule as stated here.
- **A closure does not shift the Rotation.** If Monday is closed, Tuesday still serves Tuesday's rotation slot. Rotation position derives from the calendar mapping, not from counting served days.
- **A date override changes only that date.** The master Rotation is untouched; the next comparable weekday returns to normal.
- **Draft is not operational.** Unpublished schedule changes must never reach Parent, Kitchen, Nursery or Classroom views.
- **Expected and actual are different facts.** Expected demand, produced, packed, dispatched and received quantities are stored separately; a shortfall never rewrites the expected figure. Variance is derived.
- **Late absence never rewrites history.** A classroom absence recorded during the meal period does not retroactively reduce the production demand the Kitchen already worked to.
- **Class context is historical.** Moving a Student to another Class does not move their past Classroom Meal Records into it.

### Republishing a future Meal Service (approved)

Publication alone does not freeze a Meal Service. A **future, unserved** published service
may deliberately re-resolve — a later Override, Closure or Menu correction is applied by
republishing, and the dated rows move with it. A service that **carries serving history**
is immutable: its Meal truth, and the revision its observations were filed against, never
change. The boundary between those two states is serialized in the database (migration
0036): the publisher locks the service before testing for history, and Classroom recording
locks it before creating the first observation, so a republish can neither swap the
revision under an in-flight observation nor orphan it.

### The Institution's published schedule (Founder-approved)

A Nursery/School Admin may **see** their own institution's published dated schedule —
today's applicable periods and the published week — read from the same authoritative
`meal_services` rows the Kitchen and Parent portals consume. It is strictly read-only:
no create, edit or publish action exists for that role, and the raw Rotation templates,
Service Plans and Calendar configuration behind the schedule remain Super-Admin-only at the
database boundary (migration 0036). Menu authorship stays with the Super Admin.

### Analytics distinction (reinforces Decision 032)

_Actual intake_ (what physically happened to a child, which a Parent may need to see) and _Meal acceptance_ (whether the Meal itself is liked) are different measures. `ABSENT` / `UNWELL` / `SLEEPING` / `NOT_SERVED` remain excluded from acceptance metrics. `DID_NOT_LIKE_IT` must come from the recorded structured reason and must never be inferred from low intake alone. Analytics must retain the ability to distinguish Meal revisions so a recipe improvement can be evaluated.

### Not approved — remain `NOT_YET_DEFINED`

Bulk/CSV/Excel/PDF Meal import, AI menu parsing, pre-production absence workflow and its cutoff time, production lock policy and who may override it, permanent production/delivery state enums, GPS/routing/proof-of-delivery, multi-Kitchen routing/territories/capacity, retention and deletion rules, commercial pricing and billing logic, Parent payment, daily Parent meal choice.

**Status:** ACTIVE

---

## Superseded Rule Register

### S-001 — Direct Parent-Payment Enrolment

Historical source wording:

- direct Parent-payment enrolments.

Current status:

`SUPERSEDED_FOR_MVP`

Replacement:

- Parent pays Institution.
- Institution pays LunchBox Connect.

---

## Decision 034 — Technical Stack Approved (records A1–A3)

**Date:** 2026-08-20

**Decision:** The technical stack is APPROVED (A1–A3) and is the one the
repository already implements. This decision RECORDS that approved stack so no
canonical document still says it is undefined; it does not introduce a new
choice. It supersedes Decision 024 and the `TECHNICAL_STACK = NOT_YET_DEFINED`
statements in `00_SOURCE_OF_TRUTH.md §26` and `10_DEPLOYMENT_RUNBOOK.md §3`.

`TECHNICAL_STACK`:

- **Frontend:** TypeScript · React 18 + Vite (single-page app) · React Router.
- **Backend:** Supabase — PostgreSQL, Auth (GoTrue), Storage, Edge Functions (Deno).
- **Authorization:** PostgreSQL Row Level Security is the enforcement boundary,
  mirrored by an app-level RBAC matrix; privileged writes go through
  SECURITY DEFINER RPCs and BEFORE-write triggers.
- **Migrations:** Supabase CLI SQL migrations (`supabase/migrations/0001`–`0039`).
- **Deploy:** Cloudflare Workers serve the built frontend; the database is Supabase.
- **Tooling:** pnpm · Vitest (unit) · Playwright (E2E) · ESLint · Prettier.
- **Operational timezone (MVP):** Asia/Dubai (GST, UTC+4, no DST). Per-institution
  timezones are `NOT_YET_DEFINED`.

The Decision 024 caution still applies: the stack must not be assumed from
another project. Items genuinely still undefined (see §Out-of-scope and the
`BLOCKED_BY_SPEC` list) remain `NOT_YET_DEFINED`.

**Status:** ACTIVE

---

## Decision 035 — A Meal image, once attached to a Meal Revision, is history

**Date:** 2026-08-20

**Decision:** A Meal Revision is already immutable — saving a Meal produces a
NEW revision rather than editing the old one — because a past published Meal
Service must keep describing what was actually served. That rule was enforced on
the row and not on the picture the row points at: the meal-image storage policy
allowed the Super Admin to delete or overwrite any object in the bucket.

Reproduced before this decision was recorded: deleting the object succeeded
while the historical revision kept its reference, so every past Meal Service
using that meal — and every Parent looking at what their child was served —
resolved to nothing. Overwriting is the quieter failure: the reference survives
and the picture silently becomes a different meal.

**Rule:** a storage object referenced by any `meal_revisions.image_path` may no
longer be deleted or overwritten by any client, including the Super Admin. An
object no revision references is **not** history and stays removable, so an
upload abandoned before the Meal was saved can still be cleaned up.

**Not decided here:** retention, archival and deletion policy for referenced
meal images remains `NOT_YET_DEFINED`. This decision does not invent one; it
records the safe default that history is kept until a policy exists.

**Scope note:** the `student-photos` bucket is deliberately unaffected. A
student photo is current identity rather than a record of a past event, and
`students.photo_path` is a live pointer — replacing it falsifies no historical
record.

**Implemented by:** migration `0037`; asserted in `tests/sql/verify_db_boundary.sql`
(including a control proving the bucket is reference-guarded, not frozen).

**Status:** ACTIVE

---

## Decision 036 — A view's `security_invoker` option is part of its definition

**Decided:** 2026-08-21 (release verification) · **Status:** ACTIVE

`v_dashboard_institutions` carries no role test of its own. It is safe only
because `security_invoker = true` makes its base-table reads run as the caller,
so RLS scopes them. Migration `0031` created it that way. Migration `0033`
rebuilt it to fix a completion denominator and wrote `create or replace view
... as`, omitting the `with (security_invoker = true)` clause.

`CREATE OR REPLACE VIEW` **resets reloptions when the clause is absent**. The
option was dropped silently — no error, no warning, and the view kept returning
the same rows to an admin, so nothing looked wrong. It had reverted to owner
rights, and every base-table read inside it ran as `postgres`.

`anon` holds `SELECT` on the view, so the exposure was unauthenticated.
Reproduced against production before the fix was written: as `anon`,
`select * from institutions` was refused, while
`select name, classrooms, active_students from v_dashboard_institutions`
returned every institution's name, classroom count and eligible-child
headcount. No child-level data was reachable; tenant identity and headcount
were.

**Rule:** `security_invoker` is part of a view's security definition, not a
formatting detail. Any `create or replace view` on a view that has it must
restate the `with (security_invoker = true)` clause. A view that relies on the
caller's RLS for its scoping must say so in a `comment on view`, so the next
person rebuilding it knows the option is load-bearing.

**Implemented by:** migration `0039` (which also sets the option on
`v_meal_performance`, `v_meal_revision_performance` and `v_production_demand`
— never exploitable, since each reads a SECURITY DEFINER `*_impl()` that
checks `auth.uid()` itself, but an explicit refusal beats a silent empty
result, and it clears the standing linter ERROR).

**Status:** ACTIVE

---

## Change-Control Rule

When the user explicitly changes an active decision:

1. preserve the historical entry;
2. mark the old decision `SUPERSEDED`;
3. add the new decision;
4. update `00_SOURCE_OF_TRUTH.md`;
5. update every affected specification;
6. update acceptance tests;
7. do not leave contradictory active rules.
