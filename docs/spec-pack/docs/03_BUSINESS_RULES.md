# 03_BUSINESS_RULES.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed business rules that govern LunchBox Connect.

These rules determine how approved business facts affect system behavior.

This file does not define:

- database tables;
- UI layout;
- technical architecture;
- API implementation;
- deployment;
- detailed role permissions beyond what is already established elsewhere.

Anything not previously confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not invent business rules.

---

## 2. Governing Business Model

LunchBox Connect operates as an institutional child nutrition system.

The confirmed commercial relationship is:

**Parent / Guardian → Nursery / School → LunchBox Connect**

For the MVP:

- parents pay the nursery / school;
- the nursery / school pays LunchBox Connect;
- parents do not pay LunchBox Connect directly.

This rule controls the software behavior.

---

## 3. Institution Is the Commercial Customer

The institution is the commercial customer in the confirmed MVP model.

The institution may be:

- a nursery;
- a school.

Parent / Guardian users are not direct LunchBox Connect commercial customers in the MVP.

---

## 4. Parent Direct-Payment Prohibition

The MVP must not operate a direct parent-payment model.

The system must not create or require:

- parent checkout;
- parent card payment to LunchBox Connect;
- direct parent subscription billing;
- LunchBox Connect parent invoices;
- direct parent refunds from LunchBox Connect;
- parent payment gateway workflow.

Any historical material mentioning direct parent-payment enrollment is obsolete for the MVP.

---

## 5. Institutional Billing Controls Operational Eligibility

A student's operational participation depends on approved institutional billing / enrollment status.

The confirmed eligible status is:

`ACTIVE_BILLABLE_TO_NURSERY`

Only students with approved eligible status may enter the meal-service operational chain.

The complete status list is:

`NOT_YET_DEFINED`

The complete status transition rules are:

`NOT_YET_DEFINED`

---

## 6. Eligibility Controls Production

Kitchen demand must derive from eligible student records.

A student who is not operationally eligible must not be counted in standard production demand unless a later approved rule explicitly provides an exception.

The exact exception model is:

`NOT_YET_DEFINED`

---

## 7. Eligibility Controls Delivery and Serving

The confirmed operational chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

A student must not bypass eligibility and appear independently in downstream operational stages.

Exact exception handling is:

`NOT_YET_DEFINED`

---

## 8. One Authoritative Student Record

Each student must have one authoritative record.

The same student record must drive all authorized downstream workflows.

Separate portals must not maintain conflicting independent versions of:

- student identity;
- institution;
- class;
- eligibility;
- allergy information;
- dietary restriction information;
- meal-related data.

---

## 9. Institution Association Rule

Every operational student must belong to an institution.

The exact rule for:

- transfers between institutions;
- students belonging to multiple institutions;
- historical institution associations

is:

`NOT_YET_DEFINED`

---

## 10. Class Association Rule

The system supports student-to-class association.

Class information may affect:

- institution operations;
- classroom scope;
- kitchen grouping where applicable;
- reporting.

The exact rules for:

- changing class;
- multiple classes;
- historical class tracking;
- temporary class changes

are:

`NOT_YET_DEFINED`

---

## 11. Parent / Guardian Association Rule

Students may be associated with parent / guardian records.

Parents may access only their own authorized child / children.

The exact business rules for:

- multiple guardians;
- primary guardian;
- secondary guardian;
- separated-parent access;
- guardian invitation;
- guardian removal

are:

`NOT_YET_DEFINED`

---

## 12. Allergy Information Is Operationally Significant

Student allergy information is operational data that affects meal handling.

The institution provides relevant allergy information.

Approved allergy data must be available to authorized users who require it for:

- meal preparation;
- classroom allergy awareness;
- approved administration.

The exact clinical taxonomy and workflow are:

`NOT_YET_DEFINED`

---

## 13. Dietary Restriction Information Is Operationally Significant

Student dietary restriction information may affect meal handling.

Approved dietary data must be available to authorized users who require it for meal preparation and operational awareness.

The exact dietary categories and modification rules are:

`NOT_YET_DEFINED`

---

## 14. No Allergy Rule Invention

Claude Code must not infer or create medical / clinical allergy policy.

It must not invent:

- severity levels;
- substitution rules;
- cross-contamination rules;
- emergency escalation rules;
- allergy approval thresholds;
- medical clearance rules.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

## 15. Menu Is Managed Operational Data

Menus must be represented as manageable system data.

Routine menu updates must not require changing application source code.

Approved menu information may include:

- meal;
- ingredients;
- allergens;
- nutrition information;
- portion information.

Exact menu schema is defined elsewhere.

---

## 16. Menu Source Accuracy Rule

When menu data is entered from approved source material, the system must preserve the approved information accurately.

Claude Code must not invent:

- ingredients;
- allergens;
- nutrition values;
- portions;
- meal descriptions;
- health claims.

Unknown values remain:

`NOT_YET_DEFINED`

---

## 17. Meal Assignment Must Use Approved Rules

The system must connect students to applicable meals using approved meal-assignment rules.

The exact assignment logic is:

`NOT_YET_DEFINED`

Claude Code must not select a meal for a student using assumed logic.

---

## 18. Production Counts Must Be Derived

Kitchen production counts must derive from authoritative system data.

They must not be maintained as independent manually invented totals.

Confirmed inputs include:

- eligible students;
- institution;
- approved meal assignment;
- allergy / dietary requirements where applicable.

Exact production calculation formula is:

`NOT_YET_DEFINED`

---

## 19. Production Must Remain Traceable

Production demand must remain traceable to the underlying operational records that caused the quantity.

If a quantity changes because student eligibility or another approved upstream input changes, the production view must reflect the approved business logic.

Exact recalculation timing and locking rules are:

`NOT_YET_DEFINED`

---

## 20. Kitchen Cannot Change Student Eligibility

Kitchen staff must not change student eligibility merely to alter production.

Eligibility is an upstream administrative rule.

Kitchen operations consume approved eligibility data.

---

## 21. Kitchen Cannot Invent Students

Kitchen staff must not create operational student records as a workaround for production demand.

Student records belong to the authoritative student-management flow.

---

## 22. Special Meal Handling

Special meal handling exists where required by approved allergy or dietary information.

The exact definition of:

- special meal;
- modified meal;
- substitution;
- approval requirement;
- kitchen acknowledgment

is:

`NOT_YET_DEFINED`

---

## 23. Packing Must Relate to Production

Where packing is used, packed meal quantities must relate to actual approved production.

Packing must not create an unrelated second quantity system.

Exact packing unit and label rules are:

`NOT_YET_DEFINED`

---

## 24. Dispatch Must Relate to Prepared Production

Dispatch must be based on actual prepared / approved production.

Dispatch information must not be independent of the kitchen production records it represents.

The exact dispatch-locking and confirmation rules are:

`NOT_YET_DEFINED`

---

## 25. Delivery Must Relate to Dispatch

Every delivery must relate to actual dispatch information.

A delivery record must identify the destination institution.

Delivery quantities must be tied to dispatched quantities according to the approved workflow.

The exact discrepancy-handling rule is:

`NOT_YET_DEFINED`

---

## 26. Delivery Responsibility Boundary

Existing project agreements establish:

- LunchBox Connect-side responsibility for meal preparation, packaging, and delivery;
- nursery / school responsibility for internal serving / feeding after delivery handover.

The exact legal and operational boundary language remains governed by the current approved agreements.

---

## 27. Daily Delivery Reference Rule

Current agreement material references one daily delivery unless otherwise agreed.

For software behavior, the exact delivery frequency configuration rule is:

`NOT_YET_DEFINED`

This reference must not be converted into a hard-coded permanent technical limit without an approved rule.

---

## 28. Delivery Exception Handling

The system may need to represent:

- shortages;
- delivery issues;
- timing issues;
- handover evidence where defined.

The exact exception types, severity, escalation, and closure rules are:

`NOT_YET_DEFINED`

---

## 29. Classroom Serving Must Use Correct Student and Meal

Any classroom serving record must relate to:

- the correct student;
- the relevant meal;
- the relevant institution / class context;
- the applicable service date / context.

The system must not create generic meal outcomes that cannot be traced to the correct student and meal.

---

## 30. Classroom Staff Scope Rule

Teacher / Nurse / Classroom Staff users are limited to assigned classes.

They must not automatically gain access to unrelated classes.

---

## 31. Meal Outcome Recording

Classroom-side users may record approved meal outcome / consumption information.

The exact outcome values are:

`NOT_YET_DEFINED`

The exact edit window is:

`NOT_YET_DEFINED`

---

## 32. Parent-Visible Notes Rule

Previously confirmed rule:

Parent-visible classroom notes must use either:

- safe predefined status; or
- review before becoming parent-visible.

Unrestricted free-text classroom notes must not automatically become parent-visible.

The exact reviewer and publication workflow are:

`NOT_YET_DEFINED`

---

## 33. Parent Visibility Uses Authorized Underlying Data

Parents must see only authorized information relating to their own child / children.

Parent-visible information must derive from authoritative system records.

A separate parent-only version of the child's operational truth must not be maintained.

---

## 34. Parent Visibility Does Not Create Payment Rights

Parent access to:

- menus;
- ingredients;
- allergens;
- nutrition;
- meal history;
- feedback

does not imply direct payment access.

Payment remains institution-based in the MVP.

---

## 35. Nursery / School Scope Rule

Nursery / School Admin users are limited to their own institution.

They must not access unrelated institutions or unrelated institution data.

---

## 36. Super Admin Rule

Super Admin is the master-control role.

Confirmed Super Admin areas include:

- institutions;
- branches where applicable;
- users;
- students;
- classes;
- parents / guardians;
- menus;
- allergy approvals;
- operational statuses;
- institutional billing cycles;
- kitchen operations;
- deliveries;
- reporting;
- system configuration;
- audit information;
- overrides.

The exact action-level permission matrix is defined in `02_ROLES_AND_PERMISSIONS.md`.

---

## 37. Operations Manager Rule

The Operations Manager role has confirmed access to:

- operational logs;
- operational issues.

The exact organizational scope and action rights remain:

`NOT_YET_DEFINED`

---

## 38. Finance / Owner Rule

The Finance / Owner role is:

**Reports only.**

This role does not gain operational editing rights by implication.

---

## 39. Viewer Rule

The Viewer role is:

**Read-only.**

Viewer access does not include create, edit, delete, approve, override, publish, or status-change actions.

The exact read scope remains:

`NOT_YET_DEFINED`

---

## 40. Kitchen Access Rule

Kitchen access is limited to information required for:

- production;
- approved allergy / dietary handling;
- packing where defined;
- dispatch readiness.

Kitchen staff must not receive unnecessary:

- parent data;
- finance data;
- institutional administration data;
- system configuration access.

---

## 40A. Kitchen Is a LunchBox Connect Entity, Not an Institution Entity

Confirmed rule (docs/13 Decision 031):

Kitchen belongs to the LunchBox Connect operational side. It is not owned by, and must not be scoped to, any single Nursery / School.

Kitchen user accounts are provisioned only by Super Admin. Nursery / School Admin must not create or manage Kitchen accounts.

For the MVP, the current production Kitchen is Jazeel Restaurant — current operational data, not permanently hard-coded business logic. LunchBox Connect intends to later operate its own dedicated Kitchen without requiring the rest of the platform to be rebuilt.

---

## 41. Driver Access Rule

Drivers may access only assigned deliveries.

Drivers do not automatically receive:

- complete student records;
- parent records;
- institutional billing information;
- menu administration;
- system configuration.

---

## 42. No Live Chat

Confirmed MVP rule:

**No live chat.**

No role receives live-chat functionality unless the rule is explicitly changed later.

---

## 43. No Unnecessary Access

Confirmed rule:

**No unnecessary access.**

If access is not required by an approved role or workflow, it must not be granted by assumption.

---

## 44. Absence May Affect Meal Operations

Absence handling is part of the institution-side operational model where applicable.

The exact rule for:

- when an absence affects production;
- absence cut-off time;
- same-day absence;
- late absence;
- reactivation;
- credits or financial treatment

is:

`NOT_YET_DEFINED`

---

## 45. No Automatic Financial Assumption From Absence

The system must not automatically infer a refund, credit, or billing change from a student absence unless an approved commercial rule defines that behavior.

Such financial treatment is:

`NOT_YET_DEFINED`

---

## 46. Commercial Values Must Not Be Hard-Coded From Historical Contracts

Historical or current agreements may contain values including:

- pricing;
- minimum student counts;
- advance-payment periods;
- delivery-related fees or terms.

Those values are not automatically permanent software rules.

If the software later supports commercial configuration, the exact configuration model must follow approved specifications.

---

## 47. Historical Contract Values Are Reference Until Confirmed

A contract value appearing in a PDF does not automatically become:

- a system default;
- a database constraint;
- a hard-coded price;
- a validation rule.

Unless the value is explicitly confirmed as active software logic, its status is:

`REFERENCE_ONLY`

---

## 48. Existing Legal Entity Rule

Current project documents identify **Jazeel Restaurant** as the legal contracting entity operating LunchBox Connect.

Any future legal-entity change is:

`NOT_YET_DEFINED`

The software must not assume a future legal restructuring.

---

## 49. Branch Logic Is Not Fully Defined

Branches are included where applicable.

The business rules for:

- institution without branches;
- institution with multiple branches;
- users across multiple branches;
- student transfer between branches;
- billing at institution versus branch level

are:

`NOT_YET_DEFINED`

---

## 50. Reporting Must Use Operational Truth

Reports must derive from approved system records.

A report must not create a separate version of the operational facts.

Examples:

- production reporting must use production records;
- delivery reporting must use delivery records;
- serving reporting must use classroom meal records;
- eligibility reporting must use authoritative status data.

Exact KPIs are:

`NOT_YET_DEFINED`

---

## 51. Auditability of Important Administrative Changes

Important administrative changes are intended to be auditable.

Confirmed audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

Exact audited actions are:

`NOT_YET_DEFINED`

---

## 52. Override Must Be Traceable

Super Admin override authority exists.

Where the approved workflow requires an override reason or audit entry, the override must not be recorded as an ordinary silent edit.

Exact override rules are:

`NOT_YET_DEFINED`

---

## 53. Historical Data Must Not Override Current Rules

When older documents conflict with later approved decisions, the later approved decision controls.

Known confirmed example:

Older wording:

- direct parent-payment enrollment.

Current approved rule:

- institution pays LunchBox Connect;
- parents do not pay LunchBox Connect directly.

---

## 54. Business Rule Precedence

When implementing business logic, Claude Code must follow this order:

1. current explicit user instruction;
2. `00_SOURCE_OF_TRUTH.md`;
3. this `03_BUSINESS_RULES.md`;
4. approved product, role, workflow, and data specifications;
5. decision log;
6. current approved structured project data;
7. reference documents;
8. historical drafts.

---

## 55. Undefined Rule Handling

If implementation requires a business rule that is not defined, Claude Code must mark it:

`NOT_YET_DEFINED`

It must not:

- guess;
- copy a competitor;
- assume an industry default;
- choose a convenient value;
- silently create a rule in code.

---

## 56. No Business-Logic Bypass for Technical Convenience

Claude Code must not change business logic simply because a different implementation is easier.

Examples of prohibited behavior:

- counting an ineligible student to simplify production;
- allowing kitchen staff to alter eligibility;
- exposing all students to classroom users;
- giving parents direct payment because a payment component already exists;
- hard-coding contract prices because configuration is not built yet.

---

## 57. Business Data Versus Application Logic

Approved business data that may change over time must not automatically be treated as permanent code logic.

The exact list of configurable business data is:

`NOT_YET_DEFINED`

until the data model and system configuration rules define it.

---

## 58. Failure Must Not Become Success

A failed or incomplete business operation must not be recorded or displayed as successful.

Examples:

- failed eligibility update must not appear active;
- failed dispatch must not appear delivered;
- failed meal recording must not appear saved;
- missing required allergy data must not be silently treated as complete if the approved workflow requires it.

Exact validation rules are defined later.

---

## 59. Final Confirmed Business Chain

The governing LunchBox Connect business chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The confirmed rules are:

- the institution is the commercial customer;
- parents do not pay LunchBox Connect directly in the MVP;
- student eligibility controls entry into meal operations;
- one authoritative student record drives downstream workflows;
- kitchen production derives from approved eligible records;
- dispatch derives from production;
- delivery derives from dispatch;
- classroom records relate to the correct student and meal;
- parent access is limited to authorized child-specific information;
- role scope must be respected;
- historical contradictory material does not override later confirmed decisions;
- unconfirmed business rules remain `NOT_YET_DEFINED`.

This file contains business rules only.

It does not authorize Claude Code to invent missing operational policy.
