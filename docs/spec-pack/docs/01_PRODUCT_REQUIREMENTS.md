# 01_PRODUCT_REQUIREMENTS.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed product requirements for the LunchBox Connect MVP.

It describes what the software must support.

It does not define:

- database schema details;
- exact role permissions;
- detailed workflow state machines;
- technical architecture;
- UI design system;
- deployment infrastructure;
- security implementation.

Those items belong in their respective approved specification files.

Any requirement not yet confirmed is marked:

`NOT_YET_DEFINED`

---

## 2. Product Definition

LunchBox Connect is an institutional child nutrition operating system.

The software connects the operational relationship between:

- LunchBox Connect administration;
- nurseries / schools;
- students;
- parents / guardians;
- classroom staff / nurses;
- kitchen operations;
- delivery / logistics.

The system must operate as one connected platform with shared authoritative data.

---

## 3. Core Product Outcome

The system must support this connected operational chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The system must preserve the relationship between each stage.

A downstream stage must use authoritative upstream data rather than recreating its own independent version.

---

## 4. MVP Commercial Model

The MVP must support an institution-paid operating model.

Confirmed rules:

- Parents pay the nursery / school.
- The nursery / school pays LunchBox Connect.
- Parents do not pay LunchBox Connect directly.

Therefore the MVP must not require:

- parent checkout;
- parent payment gateway;
- parent invoices from LunchBox Connect;
- parent refunds from LunchBox Connect;
- direct parent subscription billing.

Institutional billing / enrollment status must determine operational student eligibility.

---

## 5. Institution Management Requirements

The system must support institution records for nurseries / schools.

The product must allow authorized users to manage confirmed institution-related operational data.

Confirmed institution-related requirements include:

- institution identity;
- institution users;
- institution students;
- classes;
- parents / guardians associated with students;
- student operational / enrollment status;
- allergy and dietary information;
- delivery-related information;
- meal-related reporting.

Exact institution fields are defined in the data model.

Exact institution permissions are defined in the roles-and-permissions file.

---

## 6. Branch Requirement

The Super Admin domain includes branches where applicable.

Exact branch structure, hierarchy, and whether every institution requires branches are:

`NOT_YET_DEFINED`

The MVP must not assume a branch model beyond what later approved specifications define.

---

## 7. Student Management Requirements

The system must maintain one authoritative student record per student.

The student record must support association with:

- an institution;
- a class;
- parent / guardian information;
- allergy information;
- dietary restriction information;
- operational / enrollment status;
- meal-related information.

The system must prevent disconnected portal-specific student records from becoming separate sources of truth.

Exact student fields are defined in the data model.

---

## 8. Student Eligibility Requirement

The system must support operational eligibility.

The confirmed eligible status is:

`ACTIVE_BILLABLE_TO_NURSERY`

Only eligible students may enter the production, delivery, and serving workflow.

The product must ensure that kitchen production counts are based on eligible students rather than manually invented student totals.

The full status list and status-transition rules are:

`NOT_YET_DEFINED`

---

## 9. Parent / Guardian Association Requirement

The system must support parent / guardian association with students.

Parent / guardian access must be limited to authorized child-specific information.

Confirmed parent-visible content may include:

- child menu;
- ingredients;
- allergens;
- nutrition information;
- meal information;
- permitted meal history / feedback;
- institution-related communication where defined.

Exact parent permissions and account rules are:

`NOT_YET_DEFINED`

---

## 10. Parent Payment Exclusion

The parent-facing experience must exclude direct LunchBox Connect payments in the MVP.

The product must not include:

- pay-now flows for parents;
- saved cards for LunchBox Connect payments;
- LunchBox Connect parent invoices;
- payment-plan management for parents;
- direct parent refunds;
- direct LunchBox Connect parent subscription checkout.

Historical documents that mention direct parent payment must not override this requirement.

---

## 11. Class Management Requirements

The system must support classes associated with an institution.

Students must be assignable to classes according to approved permissions.

Class information must be usable where required by:

- institution operations;
- kitchen grouping where applicable;
- classroom meal handling;
- reporting.

Exact class fields and class lifecycle are:

`NOT_YET_DEFINED`

---

## 12. Allergy Information Requirements

The system must support student allergy information.

Allergy information must:

- belong to the authoritative student record;
- be accessible only to authorized roles;
- be available to kitchen operations where required;
- be available to classroom-side users where required;
- affect meal preparation / handling where applicable.

The software must not invent clinical allergy rules.

Exact allergy taxonomy, severity model, escalation rules, and edit permissions are:

`NOT_YET_DEFINED`

---

## 13. Dietary Restriction Requirements

The system must support student dietary restriction information.

Dietary information must be connected to the authoritative student record.

Kitchen operations must be able to use approved dietary information when preparing required meals.

Exact dietary restriction taxonomy and modification rules are:

`NOT_YET_DEFINED`

---

## 14. Menu Management Requirements

The system must support structured menu information.

Confirmed menu-related information may include:

- meal;
- ingredients;
- allergens;
- nutrition information;
- portion information.

Menus must be manageable as system data rather than requiring application code changes for routine menu updates.

The software must not invent:

- meals;
- ingredients;
- allergens;
- nutrition values;
- portions;
- clinical claims.

Exact menu fields and menu approval process are:

`NOT_YET_DEFINED`

---

## 15. Nutrition Information Requirements

The system must be able to store and display approved nutrition information where authorized.

Existing project material includes nutrition reference data.

The product must preserve approved source values accurately when they are incorporated into structured system data.

Exact required nutrition fields are:

`NOT_YET_DEFINED`

---

## 16. Meal Assignment Requirements

The system must support an approved relationship between:

- student;
- menu / meal;
- institution;
- class where applicable;
- eligibility;
- allergy / dietary information.

The exact meal-assignment model is:

`NOT_YET_DEFINED`

The product must not create meal assignments using rules that have not been approved.

---

## 17. Absence Handling Requirement

The nursery / school domain includes absences where applicable to meal operations.

The product must support absence-related information if and where it affects approved meal operations.

Exact absence cut-off times, production impact, cancellation logic, and edit permissions are:

`NOT_YET_DEFINED`

---

## 18. Kitchen Production Requirements

The system must include a kitchen operations domain.

Kitchen operations must support:

- production quantities;
- meals by institution;
- meals by class where applicable;
- meal package / menu assignment;
- allergy or dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

Production quantities must derive from authoritative eligible student records.

Kitchen staff must not independently create production totals that conflict with the authoritative student and eligibility data.

---

## 19. Production Quantity Requirement

The system must calculate or derive production demand from approved operational data.

Production demand must be connected to:

- eligible students;
- approved meal assignment;
- institution;
- allergy / dietary requirements where applicable.

Exact production calculation rules are:

`NOT_YET_DEFINED`

---

## 20. Special Meal Handling Requirement

The system must support special meal handling where required by approved allergy or dietary data.

The exact definition of a special meal, modification categories, kitchen controls, and approval rules are:

`NOT_YET_DEFINED`

---

## 21. Packing Requirement

Kitchen operations include packing / labels where defined.

The product must be capable of connecting packed meals to the relevant production and delivery workflow.

Exact packing unit, label format, label fields, and printing method are:

`NOT_YET_DEFINED`

---

## 22. Dispatch Requirement

The system must support dispatch readiness and dispatch-related operational information.

Dispatch must relate to actual prepared production.

Dispatch must feed the delivery / logistics workflow.

Exact dispatch states, confirmation requirements, and user permissions are:

`NOT_YET_DEFINED`

---

## 23. Delivery / Logistics Requirements

The system must include a delivery / logistics domain.

Confirmed logistics requirements include:

- assigned delivery work;
- destination institution;
- dispatched quantities;
- delivery status;
- delivery timing;
- delivery issues / shortages where recorded;
- delivery confirmation / handover evidence where defined.

Exact route planning, driver assignment logic, delivery windows, and proof-of-delivery method are:

`NOT_YET_DEFINED`

---

## 24. Delivery-to-Institution Relationship

Every delivery record must relate to the correct institution.

Delivery records must relate to actual dispatched production.

The product must not maintain delivery quantities independently from production without an approved reason and traceable workflow.

---

## 25. Classroom Meal Handling Requirements

The system must include a teacher / nurse / classroom operational interface.

Confirmed classroom-side requirements include:

- student meal status;
- allergy awareness;
- meal serving status;
- meal outcome / consumption recording;
- incident or note recording where permitted.

The interface must use the authoritative student and meal information.

Exact classroom fields and actions are:

`NOT_YET_DEFINED`

---

## 26. Meal Serving Requirement

The system must support recording meal serving status.

Serving records must relate to:

- the correct student;
- the relevant meal;
- the relevant institution / class context;
- the applicable date / service context.

Exact serving states are:

`NOT_YET_DEFINED`

---

## 27. Meal Outcome / Consumption Requirement

The system must support recording meal outcome / consumption information.

Confirmed concept:

- classroom-side users may record meal outcome / consumption.

Exact consumption options, scoring system, notes, and whether all institutions use the same options are:

`NOT_YET_DEFINED`

---

## 28. Incident / Note Requirement

The classroom-side workflow may include incident or note recording where permitted.

Exact incident types, escalation logic, visibility, retention, and permissions are:

`NOT_YET_DEFINED`

---

## 29. Parent Visibility Requirements

Authorized parents / guardians must be able to view permitted information related to their child.

Confirmed possible parent-visible areas include:

- menu;
- ingredients;
- allergens;
- nutrition;
- meal information;
- permitted meal history / feedback;
- institution communication where defined.

Parent visibility must be based on the same authoritative underlying system data.

Exact visibility rules are defined in the roles-and-permissions file.

---

## 30. Institution Reporting Requirements

The nursery / school domain includes meal-related reporting.

The system must support institution-relevant reporting based on authorized operational data.

Exact reports, calculations, filters, export formats, and date ranges are:

`NOT_YET_DEFINED`

---

## 31. Super Admin Reporting Requirements

The Super Admin domain includes reporting.

The product must support reporting across authorized LunchBox Connect operational data.

Potential source domains already confirmed include:

- institutions;
- students;
- meals;
- production;
- delivery;
- serving / meal outcomes;
- institutional operations.

Exact KPI definitions and dashboards are:

`NOT_YET_DEFINED`

---

## 32. System Configuration Requirement

The Super Admin domain includes system configuration.

The product must support approved configuration data without requiring code changes where the specification defines values as administratively configurable.

Exact configurable items are:

`NOT_YET_DEFINED`

---

## 33. Commercial Configuration Requirement

Existing agreements contain values such as:

- package pricing;
- minimum student counts;
- advance-payment periods;
- delivery-related terms.

These values must not automatically become hard-coded product rules.

The approved software model for commercial configuration is:

`NOT_YET_DEFINED`

---

## 34. User Management Requirement

The Super Admin domain includes users.

The product must support system users and their association with authorized roles / domains.

Exact account lifecycle, invitation, authentication, password, session, deactivation, and recovery rules are:

`NOT_YET_DEFINED`

---

## 35. Role-Based Access Requirement

The system must restrict data and actions according to approved user roles and permissions.

The product must not assume that every role can:

- see all institutions;
- see all students;
- edit students;
- edit allergies;
- change eligibility;
- change billing status;
- edit menus;
- change production;
- alter delivery confirmations;
- view global reporting.

Exact permissions are defined in `02_ROLES_AND_PERMISSIONS.md`.

---

## 36. Data Consistency Requirement

The product must maintain one connected source of operational truth.

Examples:

- student identity must come from the authoritative student record;
- eligibility must come from the authoritative status;
- allergy / dietary information must come from the authoritative student profile;
- production must derive from approved operational data;
- delivery must relate to dispatch;
- classroom records must relate to the correct student and meal;
- parent-visible data must derive from authorized underlying records.

---

## 37. Auditability Requirement

Important administrative changes are intended to be auditable.

Previously confirmed audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

Exact audited actions are:

`NOT_YET_DEFINED`

until defined in the security / audit specification.

---

## 38. Historical Data Conflict Requirement

The product must follow the approved authority hierarchy.

Older agreements, PDFs, spreadsheets, presentations, menus, and drafts may contain obsolete rules.

If historical material conflicts with a later approved requirement, the later approved requirement wins.

Known obsolete example:

- direct parent-payment enrollment wording.

Current MVP rule:

- institution pays LunchBox Connect.

---

## 39. Reference Data Requirement

The system may use structured reference data derived from approved source material.

Reference data may include:

- menu information;
- nutrition information;
- allergen information;
- portion information;
- approved status / enum values once defined.

Claude Code must not invent missing reference values.

Unresolved values must remain:

`NOT_YET_DEFINED`

---

## 40. Mobile Usability

The system contains operational users who may access it from mobile devices.

The exact responsive and mobile usability requirements will be defined in the UI / UX specification.

Native iOS and Android applications are not a confirmed MVP requirement.

---

## 41. Native Application Status

Native iOS application:

`NOT_YET_DEFINED`

Native Android application:

`NOT_YET_DEFINED`

Claude Code must not treat native apps as approved MVP scope.

---

## 42. Third-Party Integration Status

No specific third-party provider is currently approved for:

- payment gateway;
- WhatsApp;
- SMS;
- email;
- authentication;
- analytics;
- maps / routing;
- external nutrition data;
- school-management integration.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

## 43. Technical Architecture Status

The product requirements do not define the technical stack.

The LunchBox Connect technical architecture is:

`NOT_YET_DEFINED`

until formally approved in the technical specification.

---

## 44. Security Requirement

The product will handle child-related operational information.

Security, authentication, authorization, privacy, retention, and data-isolation requirements must be defined in the approved security specification.

Claude Code must not invent permanent security policy.

---

## 45. Error and Incomplete-State Requirement

The product must not present failed, incomplete, or missing operations as successful.

Implementation must distinguish between:

- successful action;
- failed action;
- incomplete action;
- blocked action;
- missing required data.

Exact UI error behavior is defined in the UI / UX specification.

---

## 46. Verification Requirement

A feature is not considered complete merely because:

- code exists;
- the application builds;
- a screen renders;
- a single test passes.

Product completion must be verified against approved acceptance criteria.

The exact acceptance tests are defined in `09_ACCEPTANCE_TESTS.md`.

---

## 47. MVP Product Domains Summary

The confirmed MVP product domains are:

1. Super Admin
2. Nursery / School
3. Parent / Guardian
4. Teacher / Nurse / Classroom Staff
5. Kitchen Operations
6. Driver / Logistics
7. Institutional billing / eligibility administration
8. Reporting
9. System configuration
10. Audit-related capability where specified

No additional domain is automatically approved.

---

## 48. Explicit MVP Exclusions

The following are not approved MVP requirements:

- direct parent payment to LunchBox Connect;
- parent checkout;
- parent payment gateway;
- LunchBox Connect parent invoice flow;
- parent refunds from LunchBox Connect;
- direct parent subscription billing;
- consumer food-delivery marketplace behavior;
- loyalty systems;
- referral systems;
- social features;
- gamification;
- AI features;
- native iOS application;
- native Android application;
- unapproved third-party integrations;
- unapproved additional user roles;
- unapproved commercial models.

If any of these are later approved, the source-of-truth and product-requirements files must be updated.

---

## 49. Requirements That Remain Undefined

The following important product details remain intentionally unresolved until their dedicated files are approved:

- complete status list;
- status transition rules;
- full permission matrix;
- exact student fields;
- exact institution fields;
- exact class fields;
- exact parent account rules;
- allergy taxonomy;
- allergy severity logic;
- dietary taxonomy;
- menu schema;
- menu approval workflow;
- nutrition schema;
- meal-assignment rules;
- absence cut-off and production impact;
- production calculation rules;
- special meal rules;
- packing and label specification;
- dispatch states;
- logistics route rules;
- delivery proof method;
- classroom serving states;
- consumption options;
- incident rules;
- report definitions;
- KPI definitions;
- commercial configuration model;
- authentication rules;
- audit-event list;
- responsive screen requirements;
- security and privacy rules;
- technical architecture;
- integration providers.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

## 50. Final Product Requirement

LunchBox Connect must operate as one connected institutional child nutrition system.

The MVP must preserve this chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The product must:

- use shared authoritative data;
- respect the institution-paid commercial model;
- exclude direct parent payment;
- allow operational domains to work from the same connected records;
- derive kitchen demand from eligible students;
- connect dispatch to production;
- connect delivery to dispatch;
- connect classroom records to the correct student and meal;
- expose only authorized information to each role;
- keep undefined decisions explicitly undefined;
- avoid adding unapproved scope.

This document defines what the MVP must accomplish.

It does not authorize Claude Code to invent how undefined requirements should work.

---

## Operability Requirements Closed 2026-08-23

The platform previously had no way, inside the product, to end anything. These
are now requirements met rather than gaps:

- an account can be **deactivated and reactivated**, with a reason, and cannot
  be deleted;
- an Institution and a Class can be **archived and reactivated**, with a
  reason, and cannot be deleted;
- a person's **name and phone** can be corrected, by them or by whoever
  administers their account;
- a **password can be issued** by an administrator and **changed by its owner**
  while signed in;
- a **guardian relationship can be ended** by a Super Admin, with a reason;
- a **child's own details** can be corrected where the child is.

Requirements explicitly NOT met, and deliberately so: changing an email
address (it is an authentication identity and the synchronised workflow does
not exist — Decision 038), changing a role in place (it would give a live
session a reach it was not issued for), and self-service password reset by
email (accounts are administrator-issued by decision).
