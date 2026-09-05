# 09_ACCEPTANCE_TESTS.md — LunchBox Connect

## 1. Purpose

This document defines acceptance tests derived only from confirmed LunchBox Connect requirements.

A requirement is not complete until its applicable acceptance tests pass with evidence.

Tests that depend on a business rule still marked `NOT_YET_DEFINED` are marked:

`BLOCKED_BY_SPEC`

Claude Code must not invent the missing rule simply to make such a test executable.

---

## 2. Evidence Standard

A test result must contain actual evidence.

Acceptable evidence may include, depending on the future technical stack:

- automated test output;
- request / response evidence;
- database state evidence;
- UI interaction evidence;
- build output;
- deployment evidence;
- screenshots where appropriate;
- logs where appropriate.

Exact evidence tooling is:

`NOT_YET_DEFINED`

A statement such as “works” is not evidence.

---

## 3. Result Values

Each acceptance test must end with one of:

- `PASS`
- `FAIL`
- `BLOCKED_BY_SPEC`
- `BLOCKED_BY_ENVIRONMENT`
- `NOT_RUN`

No test may be marked `PASS` without evidence.

---

# PART I — CORE DATA INTEGRITY

## AT-001 — One Authoritative Student

**Requirement:** One Student must not exist as disconnected portal-specific copies.

**Test:**

1. Create or identify one Student.
2. Access the Student through authorized Admin context.
3. Access the same Student through another authorized operational context.
4. Change an approved shared Student value using an authorized workflow.
5. Verify dependent authorized views use the authoritative updated record rather than an unrelated copy.

**Expected:** No conflicting independent Student truth exists.

---

## AT-002 — Institution Association

**Requirement:** Every operational Student belongs to an Institution.

**Test:** Attempt to place a Student into operational meal workflow without the required Institution relationship.

**Expected:** System does not create a valid operational Student outside approved Institution context.

Exact required creation fields:

`BLOCKED_BY_SPEC`

if not yet defined.

---

## AT-003 — Class Scope Integrity

**Requirement:** Classroom users operate only on assigned Classes.

**Test:**

1. Create two Classes in authorized test data.
2. Assign Classroom User to Class A only.
3. Verify Class A is accessible.
4. Attempt to access Class B through UI and direct backend/API path.

**Expected:** Class B access is blocked.

---

# PART II — ELIGIBILITY

## AT-010 — Confirmed Eligible Status Enters Operations

**Requirement:** `ACTIVE_BILLABLE_TO_NURSERY` is operationally eligible.

**Test:**

1. Create an otherwise valid test Student.
2. Apply `ACTIVE_BILLABLE_TO_NURSERY` through an authorized test workflow.
3. Apply approved Meal assignment.
4. Generate / retrieve Production Demand.

**Expected:** Student may contribute to approved Production Demand.

Exact activation transition:

`BLOCKED_BY_SPEC`

until transition rules exist.

---

## AT-011 — Ineligible Student Cannot Bypass Eligibility

**Requirement:** Standard downstream meal operations may not bypass approved eligibility.

**Test:** Attempt to manually insert a Student into standard Production Demand without approved eligibility.

**Expected:** System rejects or prevents the bypass.

The exact ineligible status used for the test is:

`BLOCKED_BY_SPEC`

until the complete status list exists.

---

## AT-012 — Kitchen Cannot Change Eligibility

**Requirement:** Kitchen does not control Student eligibility.

**Test:**

1. Authenticate as Kitchen User.
2. Attempt to change Student operational status through UI.
3. Attempt the same through direct backend/API request.

**Expected:** Both attempts are blocked.

---

# PART III — PAYMENT MODEL

## AT-020 — No Parent Checkout

**Requirement:** Direct Parent payment to LunchBox Connect is excluded from the MVP.

**Test:**

1. Authenticate as Parent.
2. Inspect Parent navigation and available actions.
3. Attempt known application routes / APIs for LunchBox Connect Parent checkout if any exist.

**Expected:** No direct Parent LunchBox Connect checkout capability exists.

---

## AT-021 — No Parent Payment Data Model

**Requirement:** MVP does not require direct Parent payment entities.

**Test:** Inspect implemented schema / domain model.

**Expected:** No active MVP business entities exist for direct Parent LunchBox Connect checkout, payment, saved card, direct subscription billing, or Parent refund.

---

## AT-022 — Institution Is Billing Counterparty

**Requirement:** Institution pays LunchBox Connect.

**Test:** Inspect implemented billing domain.

**Expected:** Any approved MVP billing relationship is Institution-side, not direct Parent-side.

Exact institutional billing workflow:

`BLOCKED_BY_SPEC`

until billing details are defined.

---

# PART IV — ROLE ACCESS

## AT-030 — Nursery Isolation

**Requirement:** Nursery / School Admin accesses own Institution only.

**Test:**

1. Create Institution A and Institution B.
2. Assign Nursery Admin A to Institution A.
3. Verify authorized Institution A access.
4. Attempt Institution B access through UI.
5. Attempt Institution B access through direct backend/API request.

**Expected:** Institution B is inaccessible.

---

## AT-031 — Parent Isolation

**Requirement:** Parent sees own child / children only.

**Test:**

1. Associate Parent A with Student A.
2. Create unrelated Student B.
3. Verify Parent A can access permitted Student A information.
4. Attempt Student B access through UI and backend/API.

**Expected:** Student B is inaccessible.

---

## AT-032 — Classroom Assignment Isolation

**Requirement:** Classroom User accesses assigned Class / Classes only.

**Expected:** Unassigned Class access is blocked at UI and backend.

---

## AT-033 — Driver Assignment Isolation

**Requirement:** Driver accesses assigned Deliveries only.

**Test:** Assign Delivery A to Driver A and Delivery B to Driver B. Attempt Driver A access to Delivery B through UI and backend/API.

**Expected:** Delivery B is inaccessible to Driver A.

---

## AT-034 — Kitchen Data Minimization

**Requirement:** Kitchen receives Production and required Allergy / Dietary data only.

**Test:** Authenticate as Kitchen User and attempt access to unrelated Parent and financial information.

**Expected:** Unnecessary Parent / financial data is unavailable.

Exact Kitchen-identifying fields:

`BLOCKED_BY_SPEC`

until defined.

---

## AT-035 — Finance / Owner Is Reports Only

**Test:** Authenticate as Finance / Owner and attempt operational edit actions.

**Expected:** Operational writes are blocked.

---

## AT-036 — Viewer Is Read Only

**Test:** Authenticate as Viewer and attempt create, update, delete, approve, override, publish, and status-change operations.

**Expected:** Writes are blocked.

Exact Viewer readable scope:

`BLOCKED_BY_SPEC`

until defined.

---

## AT-037 — No UI-Only Authorization

**Requirement:** Backend authorization independently enforces permissions.

**Test:** For a restricted action, bypass normal UI and send the equivalent direct request.

**Expected:** Unauthorized request is rejected.

---

# PART V — ALLERGY / DIETARY

## AT-040 — Allergy Uses Authoritative Student Data

**Test:**

1. Associate approved Allergy information with Student.
2. View authorized Admin representation.
3. View authorized Kitchen representation.
4. View authorized Classroom representation.

**Expected:** All permitted views derive from the authoritative Allergy record.

Exact field visibility:

`BLOCKED_BY_SPEC`

until defined.

---

## AT-041 — Kitchen Has Required Allergy Awareness

**Requirement:** Kitchen must have required approved Allergy / Dietary information for preparation.

Exact required fields:

`BLOCKED_BY_SPEC`

---

## AT-042 — Classroom Allergy Awareness

**Requirement:** Classroom users have required Allergy awareness for assigned Students.

Exact warning format:

Not part of acceptance logic.

Exact fields:

`BLOCKED_BY_SPEC`

---

## AT-043 — Unrestricted Notes Not Auto-Published to Parent

**Test:**

1. Enter unrestricted classroom free text in a test workflow where such note entry is permitted.
2. Verify the text does not automatically appear in Parent view unless approved predefined/review rules have been satisfied.

**Expected:** No automatic Parent publication.

Exact review workflow:

`BLOCKED_BY_SPEC`

---

# PART VI — MENU / NUTRITION

## AT-050 — Menu Is Data, Not Hard-Coded Content

**Requirement:** Routine Menu content must be administratively manageable data.

**Test:** Update approved Menu data without editing application source code.

**Expected:** Authorized views use the updated approved Menu data.

Exact Menu permissions and lifecycle:

`BLOCKED_BY_SPEC`

until defined.

---

## AT-051 — Approved Nutrition Values Preserved

**Requirement:** Structured Nutrition data must preserve approved source values.

**Test:** Load an approved reference item and compare stored/displayed values against the approved source.

**Expected:** Values match the approved source.

---

## AT-052 — No Invented Nutrition Value

**Test:** Provide a source item with an unresolved Nutrition field.

**Expected:** System does not invent a Nutrition value and present it as approved.

---

# PART VII — PRODUCTION

## AT-060 — Production Demand Derives From Eligible Students

**Requirement:** Production Demand is derived from authoritative eligible records and approved meal data.

**Test:** Compare Production Demand against its contributing eligible Student set.

**Expected:** Demand is traceable to approved inputs.

Exact formula:

`BLOCKED_BY_SPEC`

until calculation rules are defined.

---

## AT-061 — Kitchen Cannot Invent Student Count

**Test:** Attempt to replace authoritative Student-derived demand with an unrelated manually invented total.

**Expected:** Manual total does not become the authoritative demand source.

---

## AT-062 — Production Is Traceable

**Test:** Select a Production record / demand result and trace it back to Institution, approved Meal information, and contributing eligible records.

**Expected:** Traceability exists.

Exact technical implementation:

Depends on architecture, but logical requirement must pass.

---

# PART VIII — DISPATCH AND DELIVERY

## AT-070 — Dispatch Relates to Production

**Test:** Inspect a Dispatch record.

**Expected:** It is linked to actual prepared / approved Production.

Exact Dispatch states:

`BLOCKED_BY_SPEC`

---

## AT-071 — Delivery Relates to Dispatch

**Test:** Inspect a Delivery.

**Expected:** Delivery is linked to Dispatch and destination Institution.

---

## AT-072 — Delivery Cannot Be Independent Quantity Truth

**Test:** Compare Delivery quantities / content with linked Dispatch according to approved logic.

**Expected:** Delivery does not maintain an unrelated authoritative quantity source.

Exact discrepancy rule:

`BLOCKED_BY_SPEC`

---

## AT-073 — Driver Only Assigned Delivery

Covered by `AT-033`.

---

## AT-074 — Handover Evidence

Delivery confirmation / handover evidence is included where defined.

Exact proof method:

`BLOCKED_BY_SPEC`

---

# PART IX — CLASSROOM / SERVING

## AT-080 — Classroom Record Uses Correct Student and Meal

**Test:** Record a meal event for Student A.

**Expected:** Record is tied to:

- Student A;
- relevant Meal;
- Institution / Class context;
- service date / context.

---

## AT-081 — Classroom User Cannot Record for Unassigned Class

**Test:** Attempt meal recording for Student in unassigned Class.

**Expected:** Blocked.

---

## AT-082 — Meal Period Support

Previously established meal tracking includes:

- Breakfast;
- Snack;
- Lunch;
- Afternoon Snack.

**Test:** Verify the implemented classroom workflow can represent applicable approved meal periods.

Exact mapping to Menu records:

`BLOCKED_BY_SPEC`

until meal-assignment details exist.

---

## AT-083 — Consumption Recording

Meal outcome / consumption recording is required.

Exact allowed outcomes:

`BLOCKED_BY_SPEC`

---

# PART X — PARENT VISIBILITY

## AT-090 — Parent Data Comes From Authoritative Records

**Test:** Update an approved underlying child Meal record through authorized operations.

**Expected:** Parent-visible permitted information derives from the updated source rather than an independent copy.

---

## AT-091 — Parent Cannot See Unreviewed Free Text

Covered by `AT-043`.

---

## AT-092 — Parent Cannot See Unrelated Child

Covered by `AT-031`.

---

# PART XI — REPORTING

## AT-100 — Reporting Uses Authoritative Operational Data

**Test:** Compare a report figure to its source operational records.

**Expected:** Report is derived from approved operational truth.

Exact KPI calculation:

`BLOCKED_BY_SPEC`

until KPI definitions exist.

---

## AT-101 — Institution Report Scope

**Test:** Nursery Admin A attempts to access Institution B reporting.

**Expected:** Blocked.

---

## AT-102 — Finance / Owner Cannot Edit From Reports

**Expected:** Reporting access does not provide operational write capability.

---

# PART XII — AUDIT

## AT-110 — Audit Captures Required Concepts

For actions later defined as auditable, verify Audit Record contains required approved concepts:

- previous value;
- new value;
- responsible User;
- timestamp;
- reason where required.

Exact audited event:

`BLOCKED_BY_SPEC`

until audited action list exists.

---

## AT-111 — Override Distinguishable From Ordinary Edit

For workflows later requiring override tracking:

**Expected:** Override is distinguishable from ordinary edit.

Exact workflow:

`BLOCKED_BY_SPEC`

---

# PART XIII — FAILURE BEHAVIOR

## AT-120 — Failed Action Is Not Shown as Success

**Test:** Cause a controlled failed write operation.

**Expected:** UI / API does not report success and authoritative data remains unchanged.

---

## AT-121 — Unauthorized Action Is Not Saved

**Test:** Attempt unauthorized direct request.

**Expected:** No unauthorized state change occurs.

---

## AT-122 — Missing Required Data

Exact required fields remain undefined.

Status:

`BLOCKED_BY_SPEC`

until relevant field rules exist.

---

# PART XIV — EXPLICIT EXCLUSIONS

## AT-130 — No Live Chat

**Test:** Inspect approved MVP routes/modules and role navigation.

**Expected:** No live-chat feature exists.

---

## AT-131 — No Loyalty

**Expected:** No loyalty system exists in MVP.

---

## AT-132 — No Referral System

**Expected:** No referral system exists in MVP.

---

## AT-133 — No Social Feed

**Expected:** No social-feed feature exists in MVP.

---

## AT-134 — No AI Feature

**Expected:** No AI feature is included merely by assumption.

---

## AT-135 — No Unapproved Native App Requirement

**Expected:** Build does not claim native iOS / Android as completed MVP scope unless later approved.

---

# PART XIV-B — LIFECYCLE, CREDENTIALS AND AUDIT (added 2026-08-23)

Every test in this part has a named implementation. `verify_lifecycle_security`
refers to `tests/sql/verify_lifecycle_security.sql`; `lifecycle.spec` refers to
`tests/e2e/lifecycle.spec.ts`.

## AT-150 — A deactivated account can do nothing, token or no token

**Expected:** With a valid, already-issued JWT, a deactivated account reads no
row of any table — including its own `app_users` row — and every write is
refused. **Proven by:** verify_lifecycle_security a1, a2; lifecycle.spec
("deactivating stops the sign-in and deletes nothing", from a fresh browser).

## AT-151 — Deactivation ends class assignments; reactivation does not restore them

**Expected:** Deactivating Classroom Staff removes their `class_staff` rows.
Reactivating returns their role scope and leaves those rows removed.
**Proven by:** verify_lifecycle_security a3, a4, a5.

## AT-152 — Nothing is deleted

**Expected:** After deactivation the `app_users` row still exists, carries the
reason, and every record naming that person is unchanged. **Proven by:**
lifecycle.spec (database assertion after the UI action).

## AT-153 — The last active Super Admin cannot be deactivated

**Expected:** Refused, with a reason the operator can read on screen. Nobody may
deactivate their own account either. **Proven by:** verify_lifecycle_security
a6; lifecycle.spec ("the last active Super Admin cannot be deactivated, and is
told why").

## AT-154 — An Institution Admin's account authority is exactly their own classroom staff

**Expected:** They may deactivate and reset their own institution's Classroom
Staff, and no Super Admin, Parent, Kitchen user, peer Institution Admin, or any
account of another institution. **Proven by:** verify_lifecycle_security a7,
a8, a9.

## AT-155 — A person may correct their own name and phone, and nothing else

**Expected:** An ACTIVE person may write their own `full_name` and `phone`. A
deactivated one may not, even on their own row. Nobody may write another
person's. **Proven by:** verify_lifecycle_security a10.

## AT-156 — Email is unreachable through the profile edit

**Expected:** `update_user_profile` takes no email argument at all, and the
interface presents the email as disabled with the reason given. **Proven by:**
verify_lifecycle_security a10 (fails if the argument ever appears);
lifecycle.spec ("email and role are not editable, and the screen says why").

## AT-157 — An administrator issues a password; the old one dies; the audit holds neither

**Expected:** After a Super Admin issues a replacement, the new password signs
in and the old one is refused. The `user.password_reset` audit row carries the
actor, the subject and the reason, and contains neither the old nor the new
value. **Proven by:** lifecycle.spec; verify_lifecycle_security x2.

## AT-158 — Any signed-in person can change their own password

**Expected:** Including a Parent, from their own profile, with no
administrator involved and no privileged key. The new password then signs them
in. **Proven by:** lifecycle.spec ("a Parent changes their own password from
their own profile").

## AT-159 — A Class is archived only when empty

**Expected:** Archiving is refused while students or staff remain, and the
refusal names what is in the way. An empty Class archives, then takes no
student, no staff assignment and no meal record, and stops being offered as
somewhere to put a child. **Proven by:** verify_lifecycle_security c1–c4;
lifecycle.spec (both halves).

## AT-160 — An Institution is archived only by a Super Admin, and not over a live commitment

**Expected:** Only a Super Admin may archive. Archiving is refused while meal
service is published for today or any future date. Once archived it gains no
class, student, configuration or publication — and every record it already owns
is preserved and readable. **Proven by:** verify_lifecycle_security i1–i5.

## AT-160b — An archived Institution gains no people, service role included

**Expected:** Inserting an `app_users` row pointed at an archived Institution
is refused **as the table owner**, with RLS out of the picture — the context
the Edge Function actually writes in. Its existing staff remain fully
manageable. **Proven by:** verify_lifecycle_security i4b.

## AT-161 — Guardian revocation is deliberate, immediate, and narrow

**Expected:** A Super Admin only; a reason required; the Parent's access to
that child ends at once; the Parent account, the child and all meal history
survive untouched. An Institution Admin is not offered the action. **Proven
by:** verify_lifecycle_security g1–g5; lifecycle.spec (the reason requirement
and the Institution Admin's absence of the control).

## AT-162 — The audit covers the lifecycle and holds no password material

**Expected:** Each lifecycle action writes one audit row carrying the actor and
the state moved to; guardian revocation carries its reason; no row anywhere
contains password material. **Proven by:** verify_lifecycle_security x1, x2.

## AT-163 — A tag-only Meal edit is not a new revision

**Expected:** Changing only which sittings a Meal is suitable for updates the
tags and appends no `meal_revisions` row. Changing the recipe still appends
one. The Meal keeps one identity across both. **Proven by:**
`tests/sql/verify_meal_period_tags.sql` t3.

## AT-164 — Only roles with a screen are offered for provisioning

**Expected:** The account-creation role picker offers Super Admin, Institution
Admin, Parent, Classroom Staff and Kitchen. The four roles whose navigation is
entirely shells are withheld, derived from the navigation rather than listed.
**Proven by:** `src/lib/authorization.consistency.test.ts`;
`tests/e2e/login.roles.spec.ts`.

## AT-165 — An Institution Admin is shown no unbuilt module

**Expected:** No `shell: true` entry appears in the Institution Admin
navigation. The Super Admin keeps its shell entries. **Proven by:**
`src/lib/authorization.consistency.test.ts`.

---

# PART XV — BUILD / RELEASE EVIDENCE

## AT-140 — Build Evidence

Once a technical stack exists, the production build command must complete successfully before release.

Current build command:

`BLOCKED_BY_SPEC`

---

## AT-141 — Automated Test Evidence

Once test framework is approved, required automated tests must pass.

Current framework / command:

`BLOCKED_BY_SPEC`

---

## AT-142 — Migration Evidence

Once database architecture exists, required migrations must be verified.

Current migration system:

`BLOCKED_BY_SPEC`

---

## AT-143 — Deployment Evidence

A release may not be marked deployed without evidence from the approved production environment.

Current environment:

`BLOCKED_BY_SPEC`

---

# PART XVI — RELEASE BLOCKERS

## 146. Automatic Release Blockers

The release must be blocked if:

- a required acceptance test is `FAIL`;
- implementation contradicts `00_SOURCE_OF_TRUTH.md`;
- direct Parent LunchBox Connect payment was added to MVP;
- role isolation is broken;
- unauthorized cross-Institution access exists;
- unauthorized cross-child Parent access exists;
- unauthorized cross-Class classroom access exists;
- unauthorized cross-Delivery Driver access exists;
- Kitchen can alter Student eligibility;
- failed actions are shown as successful;
- test / demo data is presented as production truth;
- a required `NOT_YET_DEFINED` business decision was silently invented.

---

## 147. Spec-Blocked Tests

A `BLOCKED_BY_SPEC` test is not a product failure by itself.

It means implementation cannot be finalized until the missing business decision is approved.

Claude Code must not convert `BLOCKED_BY_SPEC` into `PASS` by inventing the missing rule.

---

## 148. Final Acceptance Rule

LunchBox Connect is not accepted because:

- code was generated;
- a page renders;
- a build passes;
- an AI says it is finished.

Acceptance requires evidence against the approved requirements.

Where a required rule remains undefined, the relevant test remains:

`BLOCKED_BY_SPEC`
