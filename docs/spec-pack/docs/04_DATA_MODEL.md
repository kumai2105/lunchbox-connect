# 04_DATA_MODEL.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed logical data model for the LunchBox Connect MVP.

It describes:

- the core business entities the system must represent;
- the confirmed relationships between those entities;
- which records are authoritative;
- which downstream records depend on upstream records;
- which details remain undefined.

This document does not define:

- physical database technology;
- SQL types;
- indexes;
- UUID format;
- timestamps;
- migration syntax;
- API payloads;
- UI fields;
- encryption implementation.

Anything not already confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not invent permanent data fields or constraints simply to complete a database schema.

---

# PART I — DATA MODEL PRINCIPLES

## 2. One Authoritative Operational Data Model

LunchBox Connect must operate from connected authoritative records.

The same business fact must not be stored as unrelated competing versions across different portals.

Confirmed principle:

**One source of operational truth, multiple role-based views.**

---

## 3. Core Data Chain

The confirmed business-data chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Data relationships must preserve this chain.

Downstream operational records must remain traceable to the upstream records that caused them.

---

## 4. No Independent Portal Databases

The following areas must not maintain independent conflicting copies of core operational truth:

- Super Admin;
- Nursery / School;
- Parent / Guardian;
- Teacher / Nurse / Classroom;
- Kitchen;
- Driver / Logistics.

Role-specific interfaces may display different data, but they must use the same authoritative underlying business records where those records are shared.

---

# PART II — CORE ENTITIES

## 5. Institution

### Entity

`Institution`

Represents a nursery or school using LunchBox Connect.

### Confirmed purpose

The institution:

- is the commercial customer in the MVP;
- contains or owns institution-scoped operational data;
- has students;
- has classes;
- has institution users;
- receives deliveries;
- receives institution-level reporting;
- participates in institutional billing / eligibility administration.

### Confirmed relationships

An Institution may relate to:

- Branch records where applicable;
- Student records;
- Class records;
- User records;
- Parent / Guardian relationships through students;
- Meal / menu assignments where applicable;
- Production demand;
- Dispatch records;
- Delivery records;
- Institutional billing records;
- Reports.

### Exact fields

`NOT_YET_DEFINED`

---

## 6. Branch

### Entity

`Branch`

Branches exist where applicable.

### Confirmed purpose

A Branch may represent an operational subdivision of an Institution.

### Confirmed relationship

A Branch belongs to an Institution where the branch model is used.

### Unresolved rules

The following are:

`NOT_YET_DEFINED`

- whether every institution must have a branch;
- whether students belong directly to Institution, Branch, or both;
- whether classes belong directly to Institution, Branch, or both;
- whether billing is institution-level or branch-level;
- whether users may span multiple branches;
- branch lifecycle;
- branch transfer logic.

---

## 7. Student

### Entity

`Student`

Represents a child enrolled in the LunchBox Connect institutional operating model.

### Confirmed principle

Each student must have one authoritative student record.

### Confirmed relationships

A Student:

- belongs to an Institution;
- may belong to a Class;
- is associated with Parent / Guardian records;
- has operational / enrollment status;
- may have Allergy information;
- may have Dietary Restriction information;
- participates in Meal-related operations when eligible;
- may be included in Production demand;
- may have Classroom Meal records;
- may have Parent-visible child information derived from authorized underlying data;
- contributes to Reporting.

### Confirmed minimum information concepts

The authoritative Student record must support:

- student identity;
- institution;
- class;
- parent / guardian association;
- allergy information;
- dietary restriction information;
- operational / enrollment status;
- meal-related information.

### Exact fields

`NOT_YET_DEFINED`

---

## 8. Class

### Entity

`Class`

Represents an institution class / classroom grouping.

### Confirmed relationships

A Class:

- belongs within an Institution context;
- contains or is associated with Students;
- may be assigned to Teacher / Nurse / Classroom Staff users;
- may be used by Kitchen Operations for grouping where applicable;
- may be used in Reporting.

### Exact fields and lifecycle

`NOT_YET_DEFINED`

---

## 9. Parent / Guardian

### Entity

`Guardian`

Represents a parent or guardian associated with one or more authorized students.

### Confirmed relationships

A Guardian:

- is associated with Student records;
- may receive Parent / Guardian user access;
- may view only their own authorized child / children;
- may view approved child-specific menu, nutrition, allergen, meal, and feedback information.

### Exact fields

`NOT_YET_DEFINED`

### Exact relationship model

The following remain:

`NOT_YET_DEFINED`

- one guardian to many students;
- multiple guardians per student;
- primary guardian;
- secondary guardian;
- legal guardian status;
- guardian invitation;
- guardian removal;
- guardian approval flow.

---

## 10. User

### Entity

`User`

Represents a person with authenticated access to LunchBox Connect.

### Confirmed role domains

Users may belong to approved access domains including:

- Super Admin;
- Nursery / School Admin;
- Operations Manager;
- Finance / Owner;
- Viewer;
- Parent / Guardian;
- Teacher / Nurse / Classroom Staff;
- Kitchen Operations;
- Driver / Logistics.

### Confirmed relationships

A User may have:

- a Role;
- an Institution scope where applicable;
- Class assignment where applicable;
- Guardian association where applicable;
- a Kitchen entity association where applicable (Kitchen Operations users associate with a Kitchen, not an Institution — docs/13 Decision 031);
- assigned Deliveries where applicable.

### Exact account fields

`NOT_YET_DEFINED`

---

## 11. Role

### Entity

`Role`

Represents an approved permission domain.

### Confirmed role values

The approved role / access domains are:

- `SUPER_ADMIN`
- `NURSERY_SCHOOL_ADMIN`
- `OPERATIONS_MANAGER`
- `FINANCE_OWNER`
- `VIEWER`
- `PARENT_GUARDIAN`
- `TEACHER_NURSE_CLASSROOM`
- `KITCHEN_OPERATIONS`
- `DRIVER_LOGISTICS`

### Exact technical role representation

`NOT_YET_DEFINED`

### Permission details

Controlled by:

`02_ROLES_AND_PERMISSIONS.md`

---

# PART III — STATUS AND ELIGIBILITY DATA

## 12. Student Operational Status

### Entity / concept

`StudentOperationalStatus`

Represents the student's approved operational / enrollment status.

### Confirmed status

The confirmed eligible status is:

`ACTIVE_BILLABLE_TO_NURSERY`

### Confirmed effect

Only students with approved eligible status may enter the standard:

- production;
- delivery;
- serving

operational chain.

### Complete status list

`NOT_YET_DEFINED`

### Status transition rules

`NOT_YET_DEFINED`

### Whether status is stored as entity, enum, or related record

`NOT_YET_DEFINED`

---

## 13. Institutional Billing / Eligibility Record

### Entity / concept

`InstitutionalBillingEligibility`

Represents institution-side billing / enrollment information that affects student operational eligibility.

### Confirmed commercial rule

Parents do not pay LunchBox Connect directly.

The Institution pays LunchBox Connect.

### Confirmed relationship

Institutional billing / eligibility information affects whether a Student becomes operationally eligible.

### Exact fields

`NOT_YET_DEFINED`

### Exact relationship to student status

`NOT_YET_DEFINED`

---

# PART IV — ALLERGY AND DIETARY DATA

## 14. Student Allergy Information

### Entity / concept

`StudentAllergy`

Represents approved allergy information associated with a Student.

### Confirmed relationships

Student Allergy data:

- belongs to the authoritative Student profile;
- may affect Kitchen meal preparation;
- must be available to authorized Classroom users for allergy awareness;
- is subject to centrally managed allergy approval under Super Admin authority.

### Exact fields

`NOT_YET_DEFINED`

### Exact taxonomy

`NOT_YET_DEFINED`

### Exact severity model

`NOT_YET_DEFINED`

### Exact approval record structure

`NOT_YET_DEFINED`

---

## 15. Student Dietary Restriction

### Entity / concept

`StudentDietaryRestriction`

Represents approved dietary restriction information associated with a Student.

### Confirmed relationships

Dietary Restriction data:

- belongs to the authoritative Student profile;
- may affect Kitchen meal preparation;
- may affect special meal handling.

### Exact fields

`NOT_YET_DEFINED`

### Exact taxonomy

`NOT_YET_DEFINED`

---

# PART V — MENU AND NUTRITION DATA

## 16. Menu

### Entity

`Menu`

Represents structured menu data managed by LunchBox Connect.

### Confirmed purpose

Menus must be administratively manageable system data rather than hard-coded application logic.

### Confirmed relationships

A Menu may relate to:

- Meals;
- Institutions where applicable;
- Students through approved meal-assignment logic;
- Production demand;
- Parent-visible menu information;
- Reporting.

### Exact fields

`NOT_YET_DEFINED`

---

## 17. Meal

### Entity

`Meal`

Represents an approved meal within LunchBox Connect menu data.

### Confirmed meal information concepts

A Meal may include:

- ingredients;
- allergens;
- nutrition information;
- portion information.

### Confirmed relationships

A Meal may relate to:

- Menu;
- Student meal assignment;
- Production;
- Classroom meal records;
- Parent-visible information;
- Reporting.

### Exact fields

`NOT_YET_DEFINED`

---

## 18. Ingredient

### Entity / concept

`Ingredient`

Ingredients are confirmed menu-related information.

### Relationship

Ingredients may be associated with Meals.

### Exact storage model

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 19. Meal Allergen Information

### Entity / concept

`MealAllergen`

Allergens are confirmed menu-related information.

### Relationship

Meal allergen information may be associated with Meals.

### Exact taxonomy and storage model

`NOT_YET_DEFINED`

---

## 20. Nutrition Information

### Entity / concept

`NutritionInformation`

Represents approved nutrition data associated with a Meal or other approved menu structure.

### Existing source material

Current project material includes nutrition reference information.

### Confirmed rule

Structured nutrition data must preserve approved source values accurately.

### Exact fields

`NOT_YET_DEFINED`

---

## 21. Portion Information

### Entity / concept

`PortionInformation`

Represents approved portion information associated with a Meal or menu item.

### Exact fields and unit model

`NOT_YET_DEFINED`

---

# PART VI — MEAL ASSIGNMENT DATA

## 22. Student Meal Assignment

### Entity / concept

`StudentMealAssignment`

Represents the approved relationship between a Student and the Meal / Menu applicable to that student.

### Confirmed relationship inputs

Meal assignment may depend on:

- Student;
- Institution;
- Class where applicable;
- eligibility;
- approved menu / meal;
- allergy information;
- dietary restriction information.

### Exact assignment rules

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 23. Absence

### Entity / concept

`StudentAbsence`

Absence is part of institution-side operations where applicable to meal service.

### Confirmed relationship

An Absence may affect meal operations according to approved rules.

### Exact production effect

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

### Exact cut-off behavior

`NOT_YET_DEFINED`

---

# PART VII — KITCHEN AND PRODUCTION DATA

## 23A. Kitchen

### Entity

`Kitchen`

Represents a LunchBox Connect operational production entity (docs/13 Decision 031). Confirmed as a first-class entity distinct from `Institution` and distinct from the legal contracting entity (docs/00 §5).

### Confirmed purpose

The Kitchen:

- belongs to the LunchBox Connect operational side, not to any Institution;
- is not owned by, and must not be duplicated per, Institution;
- is the entity Production references as responsible for fulfilling Production Demand;
- for the MVP, the current Kitchen is Jazeel Restaurant — operational data, not permanently hard-coded logic.

### Confirmed relationships

A Kitchen:

- may be referenced by Production Demand and Production Record as the responsible Kitchen;
- may have Kitchen Operations `User` accounts associated with it (in place of an Institution scope);
- does not own or duplicate the authoritative Student record.

### Confirmed restriction

Changing which Kitchen is active/responsible must not require rebuilding Institution, Student, Class, Guardian, eligibility, Menu, Allergy/Dietary, Classroom, Parent, Delivery, or Reporting data (docs/13 Decision 031).

Multiple simultaneous active Kitchens, territories, geographic routing, capacity planning, overflow, and transfer workflows are:

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED` beyond the minimum needed to identify the entity and its active/responsible status.

---

## 24. Production Demand

### Entity / concept

`ProductionDemand`

Represents the quantity of meals required from Kitchen Operations based on authoritative approved operational data.

### Confirmed inputs

Production Demand derives from:

- eligible Students;
- Institution;
- approved Meal / Menu assignment;
- Allergy information where applicable;
- Dietary Restriction information where applicable;
- the responsible Kitchen entity (docs/13 Decision 031).

### Confirmed restriction

Kitchen staff must not independently invent production totals that conflict with authoritative system data.

### Exact calculation rules

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 25. Production Record

### Entity / concept

`ProductionRecord`

Represents Kitchen operational preparation information.

### Confirmed purpose

A Production Record must reference the responsible Kitchen entity (docs/13 Decision 031).

Kitchen operations include:

- production quantities;
- meals by institution;
- meals by class where applicable;
- allergy / dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

### Exact distinction between demand and production record

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 26. Special Meal / Modification

### Entity / concept

`SpecialMealModification`

Represents approved meal modification required by allergy or dietary information.

### Exact definition

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 27. Packing Record

### Entity / concept

`PackingRecord`

Represents approved packing information where packing is implemented.

### Confirmed relationship

Packing must relate to actual Production.

### Exact packing unit

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 28. Meal Label

### Entity / concept

`MealLabel`

Labels are included where defined within Kitchen Operations.

### Confirmed relationship

A label must relate to approved production / packing information where labels are used.

### Exact label contents

`NOT_YET_DEFINED`

### Exact storage / printing model

`NOT_YET_DEFINED`

---

# PART VIII — DISPATCH AND DELIVERY DATA

## 29. Dispatch

### Entity

`Dispatch`

Represents the handoff from prepared Kitchen production into the delivery workflow.

### Confirmed relationship

Dispatch must relate to actual prepared / approved Production.

Dispatch feeds Delivery / Logistics operations.

### Exact fields

`NOT_YET_DEFINED`

### Exact dispatch states

`NOT_YET_DEFINED`

---

## 30. Delivery

### Entity

`Delivery`

Represents a delivery from LunchBox Connect operations to an Institution.

### Confirmed relationships

A Delivery:

- belongs to a destination Institution;
- must relate to Dispatch;
- may include dispatched quantities;
- may have delivery status;
- may have delivery timing;
- may have issue / shortage information;
- may include delivery confirmation / handover evidence where defined;
- may be assigned to a Driver / Logistics user.

### Exact fields

`NOT_YET_DEFINED`

---

## 31. Driver Assignment

### Entity / concept

`DriverAssignment`

Represents the relationship between a Driver / Logistics user and an assigned Delivery.

### Confirmed access consequence

Drivers may access only assigned deliveries.

### Exact fields and assignment lifecycle

`NOT_YET_DEFINED`

---

## 32. Delivery Issue / Shortage

### Entity / concept

`DeliveryIssue`

Represents a delivery issue or shortage where recorded.

### Confirmed relationship

A Delivery Issue belongs to a Delivery.

### Exact categories, severity, and fields

`NOT_YET_DEFINED`

---

## 33. Delivery Confirmation / Handover Evidence

### Entity / concept

`DeliveryConfirmation`

Represents delivery confirmation or handover evidence where defined.

### Confirmed relationship

Delivery confirmation belongs to a Delivery.

### Exact evidence format

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

# PART IX — CLASSROOM MEAL DATA

## 34. Classroom Meal Record

### Entity

`ClassroomMealRecord`

Represents the operational record of a Student's meal in the classroom-side workflow. One authoritative row per Student × Meal period × service date (docs/13 Decision 032).

### Confirmed relationships

A Classroom Meal Record must relate to:

- the correct Student;
- the relevant Meal (`menu_item_id`, resolved via the existing week/weekday/period Menu lookup — no separate Menu-versioning system);
- the relevant Institution / Class context;
- the applicable service date / context;
- the recording User.

### Confirmed information concepts

It includes:

- meal serving status (§35);
- structured consumption (§36);
- eating behavior;
- low-intake reason where applicable;
- a concern flag;
- an optional internal note (subject to the existing Parent-visible-notes review rule, docs/13 Decision 018).

### Confirmed single-source rule

The same Classroom Meal Record feeds both the authorized Parent view and LunchBox Connect Meal-performance analytics. It is never entered twice for the two purposes (docs/13 Decision 032, Decision 006).

### Exact fields

Confirmed field set — see docs/13 Decision 032 for the complete definition. Any field not listed there remains `NOT_YET_DEFINED`.

---

## 35. Meal Serving Status

### Entity / concept

`MealServingStatus`

Represents whether the relevant meal was actually served.

### Confirmed allowed values (docs/13 Decision 032)

- `SERVED`
- `NOT_SERVED`

### Confirmed rule

`NOT_SERVED` must never be treated as, or automatically converted into, 0% consumed. They are different facts and must remain distinguishable in every downstream view and analytic.

---

## 36. Meal Outcome / Consumption

### Entity / concept

Consumption and eating behavior recorded by authorized classroom users. Supersedes the earlier provisional `MealOutcome` value set (docs/13 Decision 032).

### Confirmed allowed values

- **Consumption** (only meaningful when `served_status = SERVED`): `0` / `25` / `50` / `75` / `100` (percent). No other value, and no free-text substitute, is authoritative.
- **Eating behavior**: `ATE_INDEPENDENTLY` / `NEEDED_ENCOURAGEMENT` / `REFUSED`.
- **Low-intake reason** (relevant at 0%/25%): `NOT_HUNGRY` / `DID_NOT_LIKE_IT` / `DISTRACTED` / `SLEEPING` / `ABSENT` / `UNWELL` / `OTHER`.
- **Concern flag**: `NO_CONCERN` / `CONCERN_OBSERVED`.

### Confirmed analytics-exclusion rule

`ABSENT`, `UNWELL`, `SLEEPING`, and `NOT_SERVED` must never count as Meal-preference rejection in Meal-performance analytics or Parent-facing summaries. Every consumption/preference metric is computed over the valid observation population only (docs/13 Decision 032 §42).

### Exact scoring system beyond the above

`NOT_YET_DEFINED`

---

## 36A. Student Photo

### Entity / concept

`StudentPhoto`

Optional operational-identification image on the Student profile (docs/13 Decision 032).

### Confirmed purpose

Fast visual identification of a child in a classroom roster. Not a general-purpose media/document store.

### Confirmed rules

- Optional — never required to create a Student.
- Governed by the same `app_can_see_student` visibility boundary as the rest of the Student record — never a public/unrestricted URL.
- Kitchen and Driver/Logistics do not receive Student photos merely because they perform Production or Delivery work (docs/13 Decision 011/012, unchanged).

### Exact fields / storage model

Stored as a private object reference (path), not inline binary data in the row. Exact retention/replacement rules beyond "optional, one current photo per Student" remain `NOT_YET_DEFINED`.

---

## 36B. Meal Performance Metrics

### Entity / concept

`MealPerformanceMetrics`

Aggregated, derived-only metrics per Meal (`menu_item_id`), computed from Classroom Meal Records — never a separately entered or independently editable data set (docs/13 Decision 032 Part on Meal Analytics).

### Confirmed relationships

Derives from Classroom Meal Records joined to the Meal (Menu row) they were recorded against. Excludes the non-preference population defined in §36's analytics-exclusion rule.

### Confirmed restriction

Metrics are decision-support evidence only. They must never automatically remove, substitute, or modify a Meal. Any classification (`KEEP` / `MONITOR` / `REVIEW_IMPROVE` / `CANDIDATE_FOR_REMOVAL`) is read by an authorized human, not applied by the software.

### Exact fields

`NOT_YET_DEFINED` beyond the metrics named in docs/13 Decision 032 (average consumption, per-bucket consumption share, refusal rate, encouragement rate, dislike rate).

---

## 37. Classroom Incident / Note

### Entity / concept

`ClassroomNote`

Represents a permitted classroom incident or note.

### Confirmed parent-visibility rule

Unrestricted free-text notes must not automatically become parent-visible.

Parent-visible notes must use:

- safe predefined status; or
- review before publication.

### Exact fields

`NOT_YET_DEFINED`

### Exact review structure

`NOT_YET_DEFINED`

---

# PART X — PARENT-VISIBLE DATA

## 38. Parent Visibility Is a View of Authoritative Data

Parent-visible child information must derive from authoritative system records.

The system must not maintain an independent parent-only copy of operational truth.

### Confirmed parent-visible data areas

Authorized parent-visible information may include:

- child menu;
- ingredients;
- allergens;
- nutrition information;
- meal information;
- permitted meal history / feedback;
- institution-related communication where defined.

---

## 39. Parent Payment Data

Direct LunchBox Connect parent-payment entities are excluded from the MVP.

The MVP data model must not require entities for:

- Parent Checkout;
- Parent Payment to LunchBox Connect;
- Parent LunchBox Connect Invoice;
- Parent LunchBox Connect Refund;
- Parent Direct Subscription Billing.

Any historical document implying these flows does not override this rule.

---

# PART XI — INSTITUTIONAL BILLING DATA

## 40. Institutional Billing Data

### Entity / concept

`InstitutionalBillingRecord`

Represents approved financial / enrollment information between the Institution and LunchBox Connect where required.

### Confirmed rule

The Institution pays LunchBox Connect.

### Confirmed relationship

Institutional billing information may affect Student operational eligibility.

### Exact fields

`NOT_YET_DEFINED`

### Exact billing-cycle model

`NOT_YET_DEFINED`

### Exact invoice model

`NOT_YET_DEFINED`

---

## 41. Commercial Configuration Data

### Entity / concept

`CommercialConfiguration`

Historical agreements contain values such as:

- pricing;
- minimum student counts;
- advance-payment periods;
- delivery-related terms.

These values must not be treated as permanent hard-coded application logic merely because they appear in reference documents.

### Exact software configuration model

`NOT_YET_DEFINED`

---

# PART XII — REPORTING DATA

## 42. Reporting

Reporting must derive from authoritative operational data.

Reporting may use information from:

- Institutions;
- Students;
- eligibility;
- Meals;
- Production;
- Dispatch;
- Delivery;
- Classroom Meal Records;
- institutional operations.

### Confirmed rule

Reporting must not create an independent competing version of operational facts.

### Exact report entities or materialized structures

`NOT_YET_DEFINED`

### Exact KPI definitions

`NOT_YET_DEFINED`

---

# PART XIII — AUDIT DATA

## 43. Audit Record

### Entity / concept

`AuditRecord`

Important administrative changes are intended to be auditable.

### Confirmed audit concepts

Audit information may include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

### Exact audited actions

`NOT_YET_DEFINED`

### Exact fields

`NOT_YET_DEFINED`

---

## 44. Override Record

### Entity / concept

`OverrideRecord`

Super Admin override authority exists.

Where an approved workflow requires explicit override tracking, the override must remain distinguishable from an ordinary edit.

### Exact structure

`NOT_YET_DEFINED`

---

# PART XIV — OPERATIONAL LOGS AND ISSUES

## 45. Operational Log

### Entity / concept

`OperationalLog`

Operations Manager access includes operational logs.

### Exact purpose, categories, and fields

`NOT_YET_DEFINED`

---

## 46. Operational Issue

### Entity / concept

`OperationalIssue`

Operations Manager access includes operational issues.

### Exact workflow, severity, ownership, and fields

`NOT_YET_DEFINED`

---

# PART XV — SYSTEM CONFIGURATION DATA

## 47. System Configuration

### Entity / concept

`SystemConfiguration`

Super Admin includes system configuration authority.

### Confirmed rule

Configurable business data must not automatically be hard-coded into application logic.

### Exact configuration records

`NOT_YET_DEFINED`

---

# PART XVI — CONFIRMED RELATIONSHIP MAP

## 48. High-Level Logical Relationship Map

The confirmed logical relationships are:

`Institution`
→ contains / relates to `Student`

`Institution`
→ contains / relates to `Class`

`Institution`
→ contains / relates to institution-scoped `User`

`Institution`
→ may contain `Branch`

`Student`
→ belongs to `Institution`

`Student`
→ may belong to `Class`

`Student`
→ relates to `Guardian`

`Student`
→ has `StudentOperationalStatus`

`Student`
→ may have `StudentAllergy`

`Student`
→ may have `StudentDietaryRestriction`

`Student`
→ may have `StudentMealAssignment`

`Student`
→ may have `StudentAbsence`

`Student`
→ may contribute to `ProductionDemand` when eligible

`Student`
→ may have `ClassroomMealRecord`

`Guardian`
→ may have Parent / Guardian `User`

`User`
→ has approved `Role`

`Teacher / Nurse / Classroom User`
→ relates to assigned `Class`

`Kitchen`
→ is a LunchBox Connect operational entity, not owned by any `Institution`

`Kitchen User`
→ associates with a `Kitchen` entity (not an Institution scope)

`Kitchen User`
→ accesses approved Production and allergy / dietary information

`ProductionDemand`
→ may relate to the responsible `Kitchen`

`ProductionRecord`
→ relates to the responsible `Kitchen`

`Driver User`
→ relates to assigned `Delivery`

`Menu`
→ contains / relates to `Meal`

`Meal`
→ may relate to `Ingredient`

`Meal`
→ may relate to `MealAllergen`

`Meal`
→ may relate to `NutritionInformation`

`Meal`
→ may relate to `PortionInformation`

`StudentMealAssignment`
→ relates Student to applicable Meal / Menu

`ProductionDemand`
→ derives from eligible Students and approved meal data

`ProductionRecord`
→ represents actual kitchen preparation against approved demand

`PackingRecord`
→ relates to Production where packing is used

`MealLabel`
→ relates to Production / Packing where labels are used

`Dispatch`
→ relates to prepared Production

`Delivery`
→ relates to Dispatch

`Delivery`
→ relates to destination Institution

`DriverAssignment`
→ relates Driver User to Delivery

`DeliveryIssue`
→ relates to Delivery

`DeliveryConfirmation`
→ relates to Delivery

`ClassroomMealRecord`
→ relates Student, Meal, Institution / Class, and service context

`InstitutionalBillingRecord`
→ relates Institution and approved billing information

`InstitutionalBillingEligibility`
→ affects Student operational eligibility

`AuditRecord`
→ relates to important administrative change where audited

`OverrideRecord`
→ relates to approved Super Admin override where required

---

# PART XVII — AUTHORITATIVE RECORD RULES

## 49. Authoritative Student Record

The `Student` record is the authoritative source for student identity and its approved relationships.

Portals must not create unrelated student copies.

---

## 50. Authoritative Eligibility

The approved student operational status is the authoritative source for operational eligibility.

Kitchen, delivery, and classroom operations must not maintain independent eligibility decisions.

---

## 51. Authoritative Allergy / Dietary Data

Approved Student Allergy and Dietary Restriction records are the authoritative source for those operational restrictions.

Kitchen and classroom views must use authorized projections of that data.

---

## 52. Authoritative Production Demand

Production demand must derive from approved upstream records.

It must not be replaced by a separate manually invented student-count database.

---

## 53. Authoritative Delivery Chain

Dispatch derives from Production.

Delivery derives from Dispatch.

Delivery records must not exist as an unrelated quantity system.

---

## 54. Authoritative Classroom Record

Classroom meal information must relate to the correct Student and Meal.

Parent-visible meal history / feedback, where permitted, must derive from approved underlying classroom / meal data rather than a separate conflicting parent copy.

---

# PART XVIII — DATA NOT APPROVED FOR MVP

## 55. Excluded Direct Parent Payment Entities

The following data entities are not required by the approved MVP:

- Parent Checkout Session;
- Parent Payment Transaction to LunchBox Connect;
- Parent Saved Payment Method for LunchBox Connect;
- Parent LunchBox Connect Invoice;
- Parent LunchBox Connect Refund;
- Parent Direct LunchBox Connect Subscription.

Claude Code must not add them merely because a payment library supports them.

---

## 56. Unapproved Additional Entity Domains

No entity is automatically approved for:

- loyalty;
- referrals;
- social features;
- gamification;
- AI features;
- consumer marketplace;
- native application-specific data;
- unapproved third-party integration data.

Any such entity is:

`NOT_YET_DEFINED`

unless explicitly approved later.

---

# PART XIX — UNDEFINED DATA MODEL ITEMS

## 57. Important Data Details Still Undefined

The following remain intentionally unresolved:

- physical database technology;
- primary-key format;
- timestamps;
- deletion / archive model;
- soft-delete rules;
- retention rules;
- institution exact fields;
- branch exact fields;
- student exact fields;
- class exact fields;
- guardian exact fields;
- user exact fields;
- authentication identifiers;
- account lifecycle fields;
- complete student status list;
- status-history model;
- institutional billing exact fields;
- billing-cycle structure;
- allergy taxonomy;
- allergy severity;
- allergy approval structure;
- dietary taxonomy;
- menu exact fields;
- meal exact fields;
- ingredients storage model;
- allergen taxonomy;
- nutrition exact fields;
- portion-unit model;
- meal-assignment logic;
- absence fields and effects;
- production calculation structure;
- production locking;
- special meal structure;
- packing-unit structure;
- label structure;
- dispatch states;
- delivery states;
- route structure;
- proof-of-delivery structure;
- classroom serving statuses;
- meal outcome values;
- classroom note types;
- note review fields;
- reporting storage model;
- audit-event list;
- override record structure;
- operations issue model;
- configuration model;
- integration data models;
- security metadata.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved in the relevant project specification.

---

# PART XX — DATA MODEL IMPLEMENTATION RULES

## 58. No Field Invention

Claude Code must not create permanent business fields simply because they are commonly used.

If implementation requires a field that is not yet defined, Claude must not present that field as approved business truth.

---

## 59. Technical Fields Versus Business Fields

Implementation may eventually require technical fields for database operation.

The exact technical architecture is not yet approved.

Therefore technical persistence details must follow the later approved architecture and security specifications.

This file does not approve a specific technical field design.

---

## 60. No Duplicate Business Truth

Claude Code must not create:

- a kitchen student table independent from the authoritative Student record;
- a parent student table independent from the authoritative Student record;
- a classroom student table independent from the authoritative Student record;
- a delivery quantity table that ignores Dispatch;
- a reporting eligibility value independent from authoritative status.

Views, derived records, caches, or technical projections may only be used later if the approved architecture preserves the authoritative relationship.

---

## 61. Traceability Requirement

Downstream operational records must retain enough approved relationship information to trace them to their business source.

Exact technical traceability fields are:

`NOT_YET_DEFINED`

The logical traceability requirement is confirmed.

---

## 62. Final Data Model Rule

The LunchBox Connect logical data model must preserve the confirmed chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The confirmed core entities / concepts are:

- Institution
- Branch where applicable
- Student
- Class
- Guardian
- User
- Role
- Student Operational Status
- Institutional Billing / Eligibility
- Student Allergy
- Student Dietary Restriction
- Kitchen (docs/13 Decision 031)
- Menu
- Meal
- Ingredient
- Meal Allergen
- Nutrition Information
- Portion Information
- Student Meal Assignment
- Student Absence
- Production Demand
- Production Record
- Special Meal / Modification
- Packing Record where defined
- Meal Label where defined
- Dispatch
- Delivery
- Driver Assignment
- Delivery Issue
- Delivery Confirmation
- Classroom Meal Record
- Meal Serving Status
- Meal Outcome / Consumption
- Student Photo (docs/13 Decision 032)
- Meal Performance Metrics (docs/13 Decision 032)
- Classroom Incident / Note
- Institutional Billing Record
- Commercial Configuration where defined
- Reporting derived from authoritative records
- Audit Record
- Override Record
- Operational Log
- Operational Issue
- System Configuration

Exact fields and technical storage details that have not yet been approved remain:

`NOT_YET_DEFINED`

Claude Code must implement the approved logical relationships without inventing unapproved business rules.

---

# PART VII — MEAL / ROTATION / CALENDAR / SERVICE PLAN (Decision 033)

Added by **Decision 033 — Master Operating Logic Lock**. These five concepts were
previously conflated into a single flat menu grid keyed by
`(week_number, weekday, period)` with the dish stored as free text. That model
could not express a reusable Meal, a Meal revision, a Rotation of variable
length, an Institution's actual service coverage, or a dated service — so none
of the operating chain's guarantees could hold.

## 26. Meal

A reusable food item in the Meal Library. **A Meal is not a date, a Menu, or a
Calendar.**

Relationships:

- a Meal has many Meal revisions;
- a Meal points at its *current* revision for future scheduling;
- a Meal is referenced by Rotation slots and by date overrides.

## 27. Meal revision

An **immutable** content snapshot: name, ingredients, allergens, nutrition,
portion, image, and nutrition provenance status.

Confirmed rules:

- editing a Meal **appends** a revision; it never rewrites one;
- a resolved Meal Service references a *revision*, not a Meal, which is what
  keeps January history showing January's recipe after March's improvement;
- revisions are append-only at the database level — no update or delete policy
  exists on the table, so historical content cannot be rewritten by any role.

## 28. Rotation and Rotation slot

A Rotation is a reusable arrangement of Meals across `week_number × weekday ×
Meal period`.

Confirmed rules:

- **Rotation length is data-driven** (`week_count`). Four weeks is the current
  business reference, never a hard-coded limit;
- weekday supports the full 0–6 range. Monday–Friday is the current operating
  pattern, not a permanent global assumption;
- clearing a slot removes the assignment only — it never deletes the Meal from
  the Meal Library.

## 29. Institution Service Plan

Defines **which Meal periods an Institution actually receives**, with effective
dates.

Confirmed rules:

- the master Rotation may contain four periods while an Institution receives
  three; the Institution must not receive the fourth;
- plans are effective-dated so a change never rewrites historical coverage;
- **absence of a plan means no coverage.** The system never assumes service;
- assignment is controlled by LunchBox Connect-side authorized users. An
  Institution may read its own plan but cannot change its contracted coverage.

## 30. Institution Rotation Assignment

Binds an Institution to a Rotation with an effective start date and an anchor
week.

Confirmed rule: rotation position is derived from **whole calendar weeks elapsed
since the anchor**, never from counting how many days actually had service. A
closure therefore cannot shift the Rotation forward.

## 31. Calendar Exception

One of three kinds: `closure`, `override`, `special_period`.

Confirmed rules:

- an override changes **only** the dates it names; the master Rotation is
  untouched and the next comparable weekday returns to normal;
- a special period may carry its own Rotation for a date range, after which the
  base Calendar resumes unchanged;
- a closure suppresses service without altering the Rotation.

## 32. Meal Service (the resolved dated fact)

`Institution + service date + Meal period + Meal revision`, plus the provenance
of how it was resolved and its published state.

This is the **shared operational anchor**. Production, Kitchen, Classroom, Parent
and Analytics all read this row rather than each independently re-deriving what
was served.

Confirmed rules:

- **draft is not operational** — unpublished services are visible only to Super
  Admin, which is what keeps an unfinished schedule away from Parent, Kitchen,
  Nursery and Classroom;
- publishing is idempotent and **never rewrites an already-published service**,
  including its Meal revision;
- a Classroom Meal Record references the Meal Service, so an observation is tied
  to the exact revision served rather than to loose text.

## 33. Resolution precedence (deterministic)

For any Institution / date / Meal period:

1. the Service Plan must include that period, otherwise nothing resolves;
2. explicit **closure** → no service;
3. explicit **date override** → use the override;
4. **special period** → use its Rotation;
5. otherwise the normal **Rotation assignment**;
6. nothing applicable → **no Meal is fabricated** (zero rows).

## 34. Expected vs actual

Expected demand, produced, packed, dispatched and received quantities are
**separate facts**. A shortfall never rewrites the expected figure; variance is
derived. Late classroom absence never retroactively reduces historical
production demand.

Quantity-stage fields beyond expected demand remain `NOT_YET_DEFINED` pending the
approved production and delivery state machines.
