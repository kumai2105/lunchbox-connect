# 02_ROLES_AND_PERMISSIONS.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed user roles, access boundaries, and permission rules for the LunchBox Connect MVP.

This file controls **who may see or act on what**.

It does not define:

- database schema;
- UI layout;
- technical authentication implementation;
- workflow state-machine details;
- security infrastructure.

Anything not previously confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not grant access by assumption.

---

## 2. Governing Permission Principle

LunchBox Connect uses role-scoped access.

Every user must see and act only within the scope of their approved role.

The system must not expose unnecessary information simply because the data exists in the same platform.

Confirmed access principle:

**No unnecessary access.**

---

## 3. Confirmed Role Domains

The confirmed role / access domains are:

1. Super Admin
2. Nursery / School Admin
3. Operations Manager
4. Finance / Owner
5. Viewer
6. Parent / Guardian
7. Teacher / Nurse / Classroom Staff
8. Kitchen Operations
9. Driver / Logistics

No additional role is automatically approved.

Any additional role is:

`NOT_YET_DEFINED`

until explicitly approved.

---

# PART I — SUPER ADMIN

## 4. Super Admin Role

The **Super Admin** is the master-control role for LunchBox Connect.

The Super Admin has system-wide administrative authority over approved LunchBox Connect operational areas.

Confirmed Super Admin responsibilities / authority include:

- system-wide visibility;
- institutions;
- branches where applicable;
- users;
- students;
- parents / guardians;
- classes;
- staff assignments;
- portal content;
- operational statuses;
- menus;
- institutional billing cycles;
- deliveries;
- allergy approvals;
- overrides;
- system configuration;
- reporting;
- audit visibility.

The Super Admin is not institution-scoped.

The Super Admin operates across the LunchBox Connect system.

---

## 5. Super Admin Change Authority

Confirmed rule:

Important Super Admin changes must be centrally managed and auditable.

Previously established audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

The exact list of actions requiring a reason is:

`NOT_YET_DEFINED`

---

## 6. Super Admin Override Authority

The Super Admin has confirmed override authority.

The exact actions that may be overridden, override prerequisites, reason requirements, and restrictions are:

`NOT_YET_DEFINED`

An override must not be silently treated as an ordinary edit if the approved workflow later distinguishes the two.

---

## 7. Super Admin Allergy Approval Authority

Allergy approvals are centrally managed under Super Admin authority.

The exact approval workflow, evidence requirements, edit sequence, and escalation process are:

`NOT_YET_DEFINED`

---

## 8. Super Admin Status Authority

Operational statuses are centrally managed under Super Admin authority.

The exact status list and which statuses Super Admin may create, change, lock, or override are:

`NOT_YET_DEFINED`

The confirmed eligibility status remains:

`ACTIVE_BILLABLE_TO_NURSERY`

---

## 9. Super Admin Billing-Cycle Authority

Institutional billing cycles are centrally managed under Super Admin authority.

Parents do not pay LunchBox Connect directly in the MVP.

The exact billing-cycle actions and fields are:

`NOT_YET_DEFINED`

---

## 10. Super Admin Menu Authority

Menus are centrally managed under Super Admin authority.

The exact create / edit / approve / publish permission sequence is:

`NOT_YET_DEFINED`

until the menu workflow is explicitly defined.

---

# PART II — NURSERY / SCHOOL ADMIN

## 11. Nursery / School Admin Role

The Nursery / School Admin is institution-scoped.

Confirmed rule:

**Nursery / School Admin users may access their own institution, not unrelated institutions.**

The earlier project definition established the School Admin role as having full access within its permitted institutional scope.

“Full access” does not override higher-level restrictions reserved for Super Admin.

---

## 12. Nursery / School Admin Confirmed Access

Within the user's own institution, confirmed areas include:

- students;
- classes;
- parents / guardians;
- institution staff;
- enrollment / operational status information;
- allergy and dietary information;
- absences where applicable to meal operations;
- deliveries;
- meal-related reporting;
- class / staff completion monitoring.

The exact create / read / update / delete permission for each field is governed by the detailed matrix in this file.

Where no exact action has been confirmed, it remains:

`NOT_YET_DEFINED`

---

## 13. Nursery / School Admin Cross-Institution Restriction

A Nursery / School Admin must not access:

- unrelated institutions;
- students from unrelated institutions;
- parents from unrelated institutions;
- classes from unrelated institutions;
- staff from unrelated institutions;
- institution-specific reports from unrelated institutions.

Cross-institution access is reserved for authorized higher-level roles such as Super Admin.

---

## 14. Nursery / School Admin Monitoring

Nursery Admins were previously established as able to monitor:

- class completion;
- staff completion;
- daily operational progress.

The exact dashboard calculations and completion criteria are:

`NOT_YET_DEFINED`

---

# PART III — OPERATIONS MANAGER

## 15. Operations Manager Role

An Operations Manager role was previously established.

Confirmed access:

- operational logs;
- operational issues.

The exact organizational scope of this role is:

`NOT_YET_DEFINED`

The exact create / edit / resolve / close permissions for logs and issues are:

`NOT_YET_DEFINED`

The Operations Manager must not receive unrelated permissions by assumption.

---

# PART IV — FINANCE / OWNER

## 16. Finance / Owner Role

A Finance / Owner access role was previously established.

Confirmed permission model:

**Reports only.**

This role must not receive operational editing authority merely because it can see reporting information.

The exact report set and data scope are:

`NOT_YET_DEFINED`

---

## 17. Finance / Owner Restrictions

Unless later explicitly approved, Finance / Owner access does not imply permission to:

- edit students;
- edit classes;
- edit allergy information;
- change kitchen production;
- change meal records;
- change delivery confirmations;
- edit menus;
- change classroom meal outcomes.

Any exception is:

`NOT_YET_DEFINED`

until explicitly approved.

---

# PART V — VIEWER

## 18. Viewer Role

A Viewer role was previously established.

Confirmed permission model:

**Read-only.**

A Viewer must not modify system records.

The exact data scope visible to a Viewer is:

`NOT_YET_DEFINED`

---

## 19. Viewer Restriction

Viewer access must not allow:

- create;
- edit;
- delete;
- approve;
- override;
- publish;
- change status;
- change billing eligibility.

---

# PART VI — PARENT / GUARDIAN

## 20. Parent / Guardian Role

Confirmed rule:

**Parents / guardians may access only their own child / children.**

A parent must not access unrelated students.

---

## 21. Parent Confirmed Visibility

Confirmed parent-visible areas include:

- child menu;
- ingredients;
- allergens;
- nutrition information;
- meal information;
- permitted meal history / feedback;
- institution-related communication where defined.

The exact fields visible inside each area are:

`NOT_YET_DEFINED`

---

## 22. Parent Child-Scope Restriction

A parent / guardian must not access:

- another family's child;
- another child's allergy profile;
- another child's meal history;
- another child's classroom records;
- another child's parent / guardian information.

---

## 23. Parent Payment Restriction

For the MVP, Parent / Guardian users must not have LunchBox Connect direct-payment functionality.

They must not be granted:

- parent checkout;
- payment gateway access for LunchBox Connect payment;
- LunchBox Connect invoice payment;
- direct subscription billing;
- LunchBox Connect refund controls.

---

## 24. Parent Editing Permissions

The exact parent ability to edit:

- student profile details;
- allergy information;
- dietary information;
- contact information;
- communication settings

is:

`NOT_YET_DEFINED`

No edit permission may be granted by assumption.

---

# PART VII — TEACHER / NURSE / CLASSROOM STAFF

## 25. Teacher / Nurse / Classroom Staff Role

Confirmed rule:

**Teachers, nurses, and classroom staff are scoped to their assigned class / classes.**

They must not automatically receive institution-wide student access.

---

## 26. Classroom Confirmed Operational Access

Previously established classroom-side work includes:

- role-based daily / “Today” operational view;
- students in assigned classes;
- meal status;
- allergy awareness;
- breakfast tracking;
- snack tracking;
- lunch tracking;
- afternoon snack tracking;
- daily meal insights;
- meal serving status;
- meal outcome / consumption recording;
- incident or note recording where permitted.

---

## 27. Classroom Assignment Restriction

Teacher / Nurse / Classroom Staff users must not access unrelated classes unless an approved assignment grants that access.

A classroom user must not gain access to every student in the institution merely because they work there.

---

## 28. Classroom Allergy Visibility

Teachers / nurses must have the allergy awareness required for students within their authorized class scope.

Exact allergy fields visible to each classroom role are:

`NOT_YET_DEFINED`

---

## 29. Classroom Meal Recording

Teacher / Nurse / Classroom Staff may record approved meal-service information for students within their assigned scope.

Confirmed categories include:

- meal served status;
- meal outcome / consumption;
- permitted notes / incidents.

Exact values and edit windows are:

`NOT_YET_DEFINED`

---

## 30. Parent-Visible Classroom Notes

Previously established rule:

Parent-visible notes must use:

- safe predefined status; or
- review before becoming parent-visible.

The exact predefined statuses, reviewer, review process, and publication conditions are:

`NOT_YET_DEFINED`

Claude Code must not make unrestricted free-text classroom notes automatically visible to parents.

---

# PART VIII — KITCHEN OPERATIONS

## 31. Kitchen Operations Role

Confirmed rule:

**Kitchen access is limited to production and allergy / dietary information required for meal preparation.**

Kitchen users must not receive unnecessary nursery, parent, financial, or administrative access.

---

## 32. Kitchen Confirmed Access

Kitchen Operations may access operational information required for:

- production quantities;
- meals by institution;
- meals by class where applicable;
- meal package / menu assignment;
- allergy modifications;
- dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

---

## 33. Kitchen Student Information Restriction

Kitchen staff must not receive full student records merely because a meal belongs to a student.

Kitchen-visible student information must be limited to what is required for approved production and safe meal handling.

The exact student-identifying fields visible to kitchen users are:

`NOT_YET_DEFINED`

---

## 34. Kitchen Allergy Access

Kitchen users may access approved allergy / dietary data necessary to prepare meals safely.

Kitchen users do not gain Super Admin allergy-approval authority.

The exact allergy fields and whether kitchen users may acknowledge, flag, or escalate data are:

`NOT_YET_DEFINED`

---

## 35. Kitchen Production Restriction

Kitchen users must not independently invent student totals.

Production demand must derive from authoritative operational data and eligible students.

Kitchen users must not change student eligibility merely to change production quantities.

---

## 36. Kitchen Financial Restriction

Kitchen access does not include parent payment functionality.

Kitchen access does not automatically include:

- institution financial reporting;
- billing-cycle administration;
- pricing configuration;
- parent financial information.

Any exception is:

`NOT_YET_DEFINED`

---

# PART IX — DRIVER / LOGISTICS

## 37. Driver / Logistics Role

Confirmed rule:

**Drivers may access only their assigned deliveries.**

Drivers must not receive unnecessary access to unrelated institutions, students, or system administration.

---

## 38. Driver Confirmed Access

Driver / Logistics users may access information required for their assigned delivery work, including:

- assigned delivery;
- destination institution;
- dispatched quantities;
- delivery status;
- delivery timing;
- delivery issues / shortages where recorded;
- delivery confirmation / handover evidence where defined.

---

## 39. Driver Cross-Delivery Restriction

A driver must not automatically access:

- deliveries assigned to unrelated drivers;
- unrelated institutions;
- complete student records;
- parent / guardian records;
- institutional billing information;
- menu administration;
- allergy approval controls;
- system configuration.

---

## 40. Driver Student Data Restriction

The exact student-level information, if any, visible to drivers is:

`NOT_YET_DEFINED`

No student data beyond approved delivery necessity may be exposed by assumption.

---

# PART X — ACCESS CONTROL RULES

## 41. Own-Institution Rule

Institution-scoped users may access only the institution scope authorized for them.

Confirmed institution-scoped roles include Nursery / School Admin.

Whether Operations Manager, Finance / Owner, and Viewer are always institution-scoped is:

`NOT_YET_DEFINED`

until explicitly confirmed.

---

## 42. Own-Child Rule

Parent / Guardian access is limited to the user's own child / children.

This rule is mandatory.

---

## 43. Assigned-Class Rule

Teacher / Nurse / Classroom Staff access is limited to assigned classes.

This rule is mandatory.

---

## 44. Production-Need Rule

Kitchen users may access only information necessary for approved production, allergy / dietary handling, packing, and dispatch preparation.

This rule is mandatory.

---

## 45. Assigned-Delivery Rule

Driver / Logistics access is limited to assigned deliveries.

This rule is mandatory.

---

## 46. No Live Chat

Previously confirmed project rule:

**No live chat.**

No role receives live-chat functionality in the MVP unless this rule is explicitly changed later.

---

## 47. No Unnecessary Access

Previously confirmed project rule:

**No unnecessary access.**

Claude Code must apply least-scope behavior according to the approved role definitions.

This does not authorize Claude Code to invent new security policy; it means an undefined permission must not be granted automatically.

---

# PART XI — PERMISSION MATRIX

## 48. Permission Matrix Key

The following values are used:

- `YES` — confirmed permission
- `NO` — confirmed restriction
- `SCOPED` — confirmed permission only inside the role's approved scope
- `READ_ONLY` — confirmed view-only permission
- `NOT_YET_DEFINED` — not previously decided

---

## 49. High-Level Permission Matrix

| Capability                           | Super Admin                       | Nursery / School Admin                         | Operations Manager            | Finance / Owner | Viewer                                   | Parent / Guardian | Teacher / Nurse / Classroom | Kitchen                     | Driver             |
| ------------------------------------ | --------------------------------- | ---------------------------------------------- | ----------------------------- | --------------- | ---------------------------------------- | ----------------- | --------------------------- | --------------------------- | ------------------ |
| System-wide visibility               | YES                               | NO                                             | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | NO                          | NO                          | NO                 |
| Own institution access               | YES                               | YES                                            | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | SCOPED                      | SCOPED operationally        | SCOPED by delivery |
| Unrelated institution access         | YES                               | NO                                             | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | NO                          | NO                          | NO                 |
| Student administration               | YES                               | SCOPED                                         | NOT_YET_DEFINED               | NO              | READ_ONLY only if within undefined scope | NO                | NO                          | NO                          | NO                 |
| View own child                       | YES                               | SCOPED institutionally                         | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | YES               | SCOPED by assigned class    | SCOPED production need      | NOT_YET_DEFINED    |
| View unrelated children              | YES                               | SCOPED only within institution where permitted | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | NO                          | NO                          | NO                 |
| Class management                     | YES                               | SCOPED                                         | NOT_YET_DEFINED               | NO              | READ_ONLY only if within undefined scope | NO                | NO                          | NO                          | NO                 |
| Staff assignment                     | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Allergy approval                     | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Allergy awareness                    | YES                               | SCOPED                                         | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | SCOPED own child  | SCOPED assigned class       | SCOPED production need      | NOT_YET_DEFINED    |
| Change operational status            | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Change billing cycle                 | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Menu administration                  | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | SCOPED operational use only | NO                 |
| Kitchen production access            | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | READ_ONLY only if within undefined scope | NO                | NO                          | YES                         | NO                 |
| Create independent production totals | NO as business-rule bypass        | NO                                             | NO                            | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Classroom meal recording             | YES where acting administratively | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | SCOPED assigned class       | NO                          | NO                 |
| Assigned-delivery operation          | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NO              | NO                                       | NO                | NO                          | NO                          | YES                |
| Global reporting                     | YES                               | NO unless separately approved                  | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | NO                          | NO                          | NO                 |
| Institution reporting                | YES                               | SCOPED                                         | NOT_YET_DEFINED               | REPORTS_ONLY    | READ_ONLY if within defined scope        | NO                | NOT_YET_DEFINED             | NOT_YET_DEFINED             | NO                 |
| Operational logs / issues            | YES                               | NOT_YET_DEFINED                                | YES                           | NO              | READ_ONLY only if in defined scope       | NO                | NOT_YET_DEFINED             | NOT_YET_DEFINED             | NOT_YET_DEFINED    |
| System configuration                 | YES                               | NO unless explicitly delegated later           | NO unless explicitly approved | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Override authority                   | YES                               | NO unless explicitly approved                  | NO unless explicitly approved | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Audit visibility                     | YES                               | NOT_YET_DEFINED                                | NOT_YET_DEFINED               | NOT_YET_DEFINED | NOT_YET_DEFINED                          | NO                | NO                          | NO                          | NO                 |
| Direct parent payment                | NO                                | NO                                             | NO                            | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |
| Live chat                            | NO                                | NO                                             | NO                            | NO              | NO                                       | NO                | NO                          | NO                          | NO                 |

---

# PART XII — UNRESOLVED PERMISSIONS

## 50. Permissions Still Not Defined

The following permission details remain intentionally unresolved:

- exact Nursery / School Admin create / edit / delete rights by field;
- whether Nursery / School Admin may change eligibility status;
- whether Nursery / School Admin may change billing status;
- whether Nursery / School Admin may submit or edit allergy information versus only request approval;
- exact Operations Manager organizational scope;
- exact Operations Manager issue-resolution actions;
- exact Finance / Owner reporting scope;
- exact Viewer data scope;
- exact parent profile-edit rights;
- exact parent allergy / dietary edit rights;
- exact teacher versus nurse permission differences;
- exact classroom note-edit window;
- exact reviewer for parent-visible notes;
- exact kitchen student-identifying fields;
- exact kitchen acknowledgment / escalation actions;
- exact driver student-level visibility;
- exact institution user-management rights;
- exact user invitation / deactivation rights;
- exact audit-log visibility below Super Admin;
- exact delete / archive rights for every role;
- exact export / download rights;
- exact permission delegation rules.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

# PART XIII — ENFORCEMENT RULES

## 51. Permission Enforcement

Claude Code must enforce approved permissions in actual application logic.

Hiding a button in the interface is not sufficient permission enforcement.

A restricted role must also be blocked from performing unauthorized actions through backend requests, direct URLs, API calls, or manipulated client state.

The exact technical authorization implementation is defined later in the security / architecture specifications.

---

## 52. No Permission Invention

If a requested feature requires a permission that this file marks `NOT_YET_DEFINED`, Claude Code must not silently grant that permission.

It must preserve the undefined state until the permission is explicitly approved.

---

## 53. No Privilege Expansion

Claude Code must not expand a user's access because:

- it is easier to implement;
- the role title sounds senior;
- another software product works that way;
- a screen already contains the data;
- the frontend needs the data for convenience.

Approved scope controls access.

---

## 54. One User, Approved Scope

A user may interact only with data authorized by:

- their role;
- their institution scope where applicable;
- their child association where applicable;
- their class assignment where applicable;
- their production need where applicable;
- their delivery assignment where applicable.

---

## 55. Final Permission Rule

The confirmed access model is:

- **Super Admin:** master control across the LunchBox Connect system.
- **Nursery / School Admin:** own institution.
- **Operations Manager:** operational logs and issues; exact scope not yet defined.
- **Finance / Owner:** reports only.
- **Viewer:** read-only.
- **Parent / Guardian:** own child / children only.
- **Teacher / Nurse / Classroom Staff:** assigned class / classes only.
- **Kitchen Operations:** production and required allergy / dietary information only.
- **Driver / Logistics:** assigned deliveries only.

Additional access must not be assumed.

Undefined permissions remain:

`NOT_YET_DEFINED`
