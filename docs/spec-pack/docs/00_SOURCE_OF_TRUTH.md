# 00_SOURCE_OF_TRUTH.md — LunchBox Connect

## 1. Purpose

This document is the authoritative factual source of truth for LunchBox Connect.

It records confirmed project decisions, established business rules, and the current known state of the system.

This file overrides older project documents when they conflict with later confirmed decisions.

Anything not confirmed must be marked:

`NOT_YET_DEFINED`

No assumption may be treated as a confirmed fact.

---

## 2. Project Name

**LunchBox Connect**

---

## 3. What LunchBox Connect Is

LunchBox Connect is an institutional child nutrition operating system.

It is designed to connect the operational relationship between:

- LunchBox Connect administration
- nurseries / schools
- enrolled students
- parents / guardians
- classroom staff / nurses
- kitchen operations
- delivery / logistics

LunchBox Connect is not defined as a consumer food-delivery marketplace.

---

## 4. Core Operating Model

The confirmed core operational chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The system must operate from shared authoritative data.

The same student must not be maintained as separate disconnected records across different portals.

Different users may access different views or actions according to their permissions, but the underlying operational data must remain connected.

---

## 5. Legal / Contracting Entity

Current project documents identify **Jazeel Restaurant** as the legal contracting entity operating LunchBox Connect.

LunchBox Connect is the operating / service identity used for the institutional child nutrition service.

Any future legal restructuring is:

`NOT_YET_DEFINED`

---

## 5A. Kitchen / Production Entity

**Kitchen is a confirmed independent LunchBox Connect operational entity, distinct from the legal contracting entity in §5 and distinct from any Institution.**

Confirmed for the MVP:

- The current production Kitchen is **Jazeel Restaurant** (the same entity that is also, separately, the legal contracting party under §5 — two different roles held by the same current entity).
- LunchBox Connect intends to later operate its own dedicated Kitchen. The architecture must not require rebuilding Institutions, Students, Classes, Guardians, eligibility, Menus, Allergy / Dietary data, Classroom records, Parent accounts, Delivery history, or Reporting when that happens.
- The Kitchen belongs to the LunchBox Connect operational side. It does not belong to, and is not owned by, any Nursery / School.
- Kitchen user accounts are LunchBox Connect-side accounts, provisioned only by Super Admin. Nursery / School Admin must not create or manage Kitchen accounts.

See `13_DECISION_LOG.md` Decision 031 for the full decision record and `04_DATA_MODEL.md` §24A for the Kitchen entity definition.

Multiple simultaneous active Kitchens, Kitchen territories, geographic routing, capacity planning, overflow, and Kitchen-transfer workflows remain:

`NOT_YET_DEFINED`

---

## 6. Customer Model

LunchBox Connect serves institutions such as:

- nurseries
- schools

The institution is the commercial customer in the confirmed MVP model.

Parents are not direct LunchBox Connect payment customers in the MVP.

---

## 7. Confirmed Payment Model

For the MVP:

- Parents pay the nursery / school.
- The nursery / school pays LunchBox Connect.
- Parents do not pay LunchBox Connect directly.
- LunchBox Connect does not process direct parent payments in the MVP.

The software must therefore not include:

- parent checkout
- parent payment gateway
- parent invoices issued by LunchBox Connect
- parent refunds issued by LunchBox Connect
- automatic parent billing to LunchBox Connect

Any historical document referring to direct parent-payment enrollment is obsolete for the MVP.

---

## 8. Institutional Billing and Student Operational Eligibility

Institutional billing / enrollment status controls whether a student enters the LunchBox Connect operational food-service workflow.

The confirmed eligible operational status is:

`ACTIVE_BILLABLE_TO_NURSERY`

Only students with the approved eligible status may enter the production, delivery, and serving workflow.

The exact full status list is:

`NOT_YET_DEFINED`

The exact transition rules between statuses are:

`NOT_YET_DEFINED`

---

## 9. Student Record Principle

Each student must have one authoritative record.

That record may be used by authorized system areas including:

- institution administration
- kitchen operations
- classroom operations
- delivery-related workflow
- parent-visible child information
- reporting

The student record must not be independently recreated by each portal.

---

## 10. Confirmed Student-Related Information

The system is known to require student-related information including:

- student identity
- institution
- class
- parent / guardian association
- allergy information
- dietary restriction information
- operational / enrollment status
- meal-related information

Exact field definitions belong in the approved data model and are not defined in this file.

---

## 11. Allergy and Dietary Information

Nurseries / schools provide relevant student allergy and dietary information.

This information affects meal operations.

Kitchen operations must use authoritative student allergy / dietary data when preparing required meals.

Classroom-side users must have the allergy awareness required by their approved permissions.

Exact allergy taxonomy, severity rules, clinical escalation rules, and editing permissions are:

`NOT_YET_DEFINED`

---

## 12. Menu and Nutrition

LunchBox Connect uses structured menus.

Existing project material includes menu, nutrition, portion, and allergen reference information.

The software must support authoritative menu information that may include:

- meal
- ingredients
- allergens
- nutrition information
- portion information

Exact menu database fields and approval rules are:

`NOT_YET_DEFINED`

Existing menu and nutrition documents are reference material unless their contents are explicitly incorporated into approved structured data.

---

## 13. Institution Responsibilities

Existing project documents establish that the nursery / school provides relevant operational student information required for service.

This includes student, allergy, and dietary information needed for meal-service operations.

Existing agreements also place responsibility for internal serving / feeding after delivery handover with the nursery / school.

Any more detailed responsibility matrix will be defined in the appropriate approved business-rules file.

---

## 14. LunchBox Connect Operational Responsibilities

Existing project material establishes LunchBox Connect-side responsibilities around:

- meal preparation
- packaging
- delivery
- institutional meal-service operations

Exact operational responsibility boundaries will be governed by approved business rules and current agreements.

---

## 15. Delivery Model

Existing project material establishes institutional delivery as part of the LunchBox Connect service.

Current agreement material references one daily delivery unless otherwise agreed.

The software must support a delivery workflow connected to actual production and institutional destinations.

Exact route logic, cut-off times, proof-of-delivery format, delivery windows, and exception handling are:

`NOT_YET_DEFINED`

---

## 16. Super Admin Domain

The LunchBox Connect system includes a Super Admin domain.

Confirmed areas under Super Admin include:

- institutions
- branches where applicable
- users
- students
- classes
- parents / guardians
- menus
- allergies and dietary restrictions
- institutional billing status
- kitchen operations
- deliveries
- reporting
- system configuration
- audit information

Exact screens and permissions are defined elsewhere.

---

## 17. Nursery / School Domain

The LunchBox Connect system includes a nursery / school domain.

Confirmed areas include:

- students
- classes
- parents / guardians
- enrollment / operational status
- allergy and dietary information
- absences where applicable to meal operations
- deliveries
- meal-related reporting

Exact permissions and workflows are defined elsewhere.

---

## 18. Parent / Guardian Domain

The LunchBox Connect system includes a parent / guardian domain.

Confirmed parent-visible areas include:

- child menu
- ingredients
- allergens
- nutrition information
- meal information
- permitted meal history / feedback
- institution-related communication where defined

Parent payment functionality is excluded from the MVP.

Exact parent permissions are:

`NOT_YET_DEFINED`

until defined in the approved permissions specification.

---

## 19. Teacher / Nurse / Classroom Domain

The LunchBox Connect system includes a classroom-side operational interface.

Confirmed areas include:

- student meal status
- allergy awareness
- meal serving status
- meal outcome / consumption recording
- incident or note recording where permitted

Exact fields, actions, and permissions are:

`NOT_YET_DEFINED`

until approved in the relevant specification.

---

## 20. Kitchen Operations Domain

The LunchBox Connect system includes a kitchen operations domain.

Confirmed areas include:

- production quantities
- meals by institution
- meals by class where applicable
- meal package / menu assignment
- allergy or dietary modifications
- special meal handling
- preparation status
- packing / labels where defined
- dispatch readiness

Kitchen production quantities must derive from authoritative eligible student records.

Kitchen staff must not independently invent student counts that conflict with system eligibility.

---

## 21. Driver / Logistics Domain

The LunchBox Connect system includes a delivery / logistics domain.

Confirmed areas include:

- assigned delivery work
- destination institution
- dispatched quantities
- delivery status
- delivery timing
- delivery issues / shortages where recorded
- delivery confirmation / handover evidence where defined

Exact logistics permissions and workflow states are:

`NOT_YET_DEFINED`

until defined in the approved workflow specification.

---

## 22. Reporting

Reporting is part of the confirmed LunchBox Connect system.

Reporting may use connected operational information from:

- institutions
- students
- meals
- production
- delivery
- serving / meal outcomes
- institutional operations

Exact reports, metrics, filters, and calculations are:

`NOT_YET_DEFINED`

until approved in the reporting / product specification.

---

## 23. Auditability

Important administrative changes are intended to be auditable.

Previously established audit concepts include:

- previous value
- new value
- user responsible
- timestamp
- reason where required

Exact audited actions are:

`NOT_YET_DEFINED`

until defined in the approved security / audit specification.

---

## 24. Existing Commercial References

Existing project agreements contain commercial terms such as:

- package pricing
- minimum student counts
- advance-payment periods
- delivery-related terms

These values are current reference material only unless explicitly confirmed as active software rules.

They must not be hard-coded into software merely because they appear in a contract.

Current software configuration rules for commercial terms are:

`NOT_YET_DEFINED`

until defined in the approved business-rules and data-model files.

---

## 25. Historical Direct Parent Payment Wording

Some older project material references direct parent-payment enrollment.

This is no longer the approved MVP model.

Current rule:

**Institution pays LunchBox Connect.**

Historical direct-parent-payment wording must not be implemented in the MVP.

---

## 26. Technical Stack

The LunchBox Connect technical stack has not yet been formally approved in the project source of truth.

Therefore:

`TECHNICAL_STACK = NOT_YET_DEFINED`

Claude Code must not assume that LunchBox Connect uses the same technical architecture as The Eastern Charm or any other project.

---

## 27. Native Mobile Applications

Native iOS and Android applications are not currently part of the confirmed MVP source of truth.

Their future inclusion is:

`NOT_YET_DEFINED`

No native application requirement may be assumed unless explicitly approved.

---

## 28. Third-Party Integrations

The following are not yet confirmed for LunchBox Connect unless later approved:

- payment gateway provider
- WhatsApp provider
- SMS provider
- email provider
- authentication provider
- analytics provider
- mapping / routing provider
- external nutrition database
- external school-management integration

Status:

`NOT_YET_DEFINED`

---

## 29. Security and Privacy

The system will handle child-related operational information.

Exact security, privacy, authentication, authorization, retention, access, and data-isolation rules are:

`NOT_YET_DEFINED`

until defined in the approved security specification.

Claude must not invent these rules.

---

## 30. Existing Software Status

At the current confirmed project state, LunchBox Connect does not yet have an approved completed production software system.

No authoritative completed LunchBox Connect repository, database schema, migration set, RBAC implementation, API contract, deployment configuration, or completed acceptance-test suite has been established as current project truth.

Any future implementation must be verified against the approved specification set.

---

## 31. Reference Documents

Historical and current project materials may include:

- nursery agreements
- menu documents
- nutrition documents
- sales material
- presentations
- commission documents
- other business files

These files may provide evidence and context.

They do not override this source-of-truth file when a later confirmed decision conflicts with them.

---

## 32. Decision Authority

Current explicit user instructions have highest authority.

After the user's current explicit instruction, this file is the primary factual project source.

If a later confirmed decision changes a rule in this file, this file must be updated to prevent conflicting active project truth.

---

## 33. Unknown Information Rule

Any project fact not already confirmed must be marked:

`NOT_YET_DEFINED`

Claude Code must not:

- guess it
- infer it from another company
- copy it from a competitor
- treat a historical draft as approval
- choose a default and present it as final

---

## 34. Final Source-of-Truth Statement

LunchBox Connect is an institutional child nutrition operating system built around one connected operational data flow:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

For the MVP:

- the institution is the commercial customer;
- parents do not pay LunchBox Connect directly;
- student eligibility controls meal operations;
- the system uses shared authoritative records;
- all portals operate on connected data;
- historical contradictory rules do not override later confirmed decisions;
- unknown decisions remain `NOT_YET_DEFINED`.

This document contains facts only.

Future files define implementation detail without changing these facts unless the user explicitly changes the source of truth.
