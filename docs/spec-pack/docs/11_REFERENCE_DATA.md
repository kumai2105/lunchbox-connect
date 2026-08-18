# 11_REFERENCE_DATA.md — LunchBox Connect

## 1. Purpose

This file separates three categories of project data:

1. **APPROVED_SOFTWARE_RULE** — confirmed active software truth.
2. **REFERENCE_ONLY** — factual information from current project documents that must not automatically become hard-coded software logic.
3. **NOT_YET_DEFINED** — not yet approved.

Claude Code must preserve these distinctions.

---

# PART I — APPROVED SOFTWARE VALUES

## 2. Project Name

Value:

`LunchBox Connect`

Status:

`APPROVED_SOFTWARE_RULE`

---

## 3. Product Type

Value:

`Institutional Child Nutrition Operating System`

Status:

`APPROVED_SOFTWARE_RULE`

LunchBox Connect is not defined as a consumer food-delivery marketplace.

---

## 4. Core Operating Chain

Value:

`Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting`

Status:

`APPROVED_SOFTWARE_RULE`

---

## 5. Commercial Relationship

Value:

`Parent / Guardian → Nursery / School → LunchBox Connect`

Meaning:

- Parent pays Nursery / School.
- Nursery / School pays LunchBox Connect.
- Parent does not pay LunchBox Connect directly in the MVP.

Status:

`APPROVED_SOFTWARE_RULE`

---

## 6. Confirmed Eligible Student Status

Value:

`ACTIVE_BILLABLE_TO_NURSERY`

Status:

`APPROVED_SOFTWARE_RULE`

Complete status list:

`NOT_YET_DEFINED`

---

## 7. Approved Role Identifiers

- `SUPER_ADMIN`
- `NURSERY_SCHOOL_ADMIN`
- `OPERATIONS_MANAGER`
- `FINANCE_OWNER`
- `VIEWER`
- `PARENT_GUARDIAN`
- `TEACHER_NURSE_CLASSROOM`
- `KITCHEN_OPERATIONS`
- `DRIVER_LOGISTICS`

Status:

`APPROVED_SOFTWARE_RULE`

---

## 8. Approved Role Scope Summary

- Super Admin — system-wide master control.
- Nursery / School Admin — own Institution.
- Operations Manager — Operational Logs and Operational Issues; exact organizational scope undefined.
- Finance / Owner — reports only.
- Viewer — read-only.
- Parent / Guardian — own child / children only.
- Teacher / Nurse / Classroom Staff — assigned Class / Classes only.
- Kitchen Operations — Production and required Allergy / Dietary information only.
- Driver / Logistics — assigned Deliveries only.

Status:

`APPROVED_SOFTWARE_RULE`

---

## 9. Confirmed Classroom Meal-Tracking Categories

Previously established categories:

- Breakfast
- Snack
- Lunch
- Afternoon Snack

Status:

`APPROVED_SOFTWARE_RULE`

Exact mapping to Menu structures:

`NOT_YET_DEFINED`

---

## 10. Confirmed Feature Exclusions

- direct Parent LunchBox Connect payment;
- live chat.

Status:

`APPROVED_SOFTWARE_RULE`

See `12_OUT_OF_SCOPE.md` for the complete scope-control list.

---

# PART II — CURRENT CONTRACT REFERENCE FACTS

## 11. Legal Contracting Entity

Current agreement identifies:

`Jazeel Restaurant`

as the legal contracting and signing party operating through the service brand LunchBox Connect.

Status:

`REFERENCE_ONLY` for software configuration until exact legal-entity fields are approved.

---

## 12. Current Agreement Service Definition

Current agreement defines Services as meal preparation, supply, packaging, and delivery.

It states that, unless otherwise agreed in writing, the Service Provider does not perform classroom serving, individual feeding supervision, or post-delivery food handling inside the Nursery.

Status:

`REFERENCE_ONLY`

The confirmed operational boundary is also reflected in the approved Business Rules.

---

## 13. Current Agreement Minimum Student Count

Current 12-month agreement reference:

`15 students`

Status:

`REFERENCE_ONLY`

This must not become a hard-coded software validation rule unless explicitly approved as current software logic.

---

## 14. Current Agreement Payment Basis

Current 12-month agreement reference:

`3 months in advance`

Status:

`REFERENCE_ONLY`

This must not become permanent software logic without explicit approval.

---

## 15. Current Agreement Standard Delivery Basis

Current agreement reference:

`One daily delivery unless otherwise agreed in writing`

Status:

`REFERENCE_ONLY`

Exact software delivery-frequency configuration remains:

`NOT_YET_DEFINED`

---

## 16. Current Agreement Package References

Current 12-month agreement Schedule A contains:

### Package 1 — Full Package

Includes:

- Breakfast
- Breakfast Snack
- Lunch
- Afternoon Snack

Reference price:
`AED 750 per student / month`

### Package 2 — Standard Package

Includes:

- Breakfast
- Breakfast Snack
- Lunch

Reference price:
`AED 675 per student / month`

Status:

`REFERENCE_ONLY`

These prices must not be hard-coded as permanent software truth.

---

## 17. Current Agreement Camp References

Current agreement Schedule B contains:

### Camp Package A

Morning Snack + Lunch

Reference price:

- AED 45 per day
- AED 225 for 5 days

### Camp Package B

Morning Snack + Lunch + Afternoon Snack

Reference price:

- AED 55 per day
- AED 275 for 5 days

Camp / holiday minimum enrollment reference:
`15 students`

Status:

`REFERENCE_ONLY`

Camp software behavior is not otherwise approved.

---

## 18. Current Agreement Student Information Rule

Current agreement states that the Nursery provides reasonably required Student information for safe and proper meal planning, including:

- Allergy information;
- Dietary Restrictions;
- other material child-specific requirements communicated through the Nursery.

Status:

`REFERENCE_ONLY` and consistent with approved operational requirements.

---

## 19. Current Agreement Special Meal Request Rule

Current agreement states that a requested child-specific menu change, substitution, removal, or adjustment must be communicated in writing through the Nursery and implemented only if approved by the Service Provider and confirmed in writing by the Nursery.

Status:

`REFERENCE_ONLY`

Exact software workflow remains:

`NOT_YET_DEFINED`

---

## 20. Current Agreement Delivery Handover Rule

Current agreement states that responsibility for internal supervision, handling, reheating if any, and distribution of meals transfers to the Nursery upon completed delivery at the agreed delivery point.

Status:

`REFERENCE_ONLY` and consistent with the approved operational boundary.

---

## 21. Historical Contract Conflict

An older/current contract text also contains wording referring to:

`direct parent-payment enrolments`

For MVP software purposes this wording is:

`SUPERSEDED_FOR_MVP`

Current approved software rule:

- Institution pays LunchBox Connect.
- Parent does not pay LunchBox Connect directly.

---

# PART III — MENU / NUTRITION REFERENCE STATUS

## 22. Latest Located Menu Reference

Reference file:

`LBC_Final_4_Week_Menu_Demo_Nurse_Review_FINAL.pdf`

The document identifies itself as:

`LunchBox Connect - 4-Week Nursery Menu Demo | Nurse Review Draft`

Status:

`REFERENCE_ONLY`

---

## 23. Menu Review Status

The menu document states:

- final approval is subject to Nursery Nurse / authorized review;
- nutrition values are approximate and must be verified before official submission.

Therefore:

`PRODUCTION_MENU_APPROVAL = NOT_CONFIRMED`

Claude Code must not present the reference menu as medically or operationally final.

---

## 24. Current Demo Menu Controls

The latest located Nurse Review Draft states:

- no fish;
- no tomato soup;
- no mini savoury egg bites;
- no vegetarian-option column.

Status:

`REFERENCE_ONLY_CURRENT_MENU_DRAFT`

These are facts about the located draft, not universal permanent software rules.

---

## 25. Current Demo Preparation Controls

The located draft states:

- baked / grilled / steamed methods where applicable;
- low added sugar;
- controlled salt / oil;
- child portions calibrated for nurse review.

Status:

`REFERENCE_ONLY_CURRENT_MENU_DRAFT`

---

## 26. Menu Information Types Present in Source

The current Nurse Review Draft contains:

- Meal name;
- Portion;
- Inside / ingredient composition;
- calories;
- protein;
- carbohydrates;
- fat;
- sugar;
- nutrients;
- allergens;
- daily totals.

Status:

`REFERENCE_SCHEMA_EVIDENCE`

Exact approved production Menu schema remains:

`NOT_YET_DEFINED`

---

## 27. Menu Seed File

File:

`seed/menu-data.json`

Status:

`REFERENCE_ONLY_NURSE_REVIEW_DRAFT`

The seed must not be treated as final production Menu data without authorized approval.

---

# PART IV — NUTRITION FACTS PACK

## 28. Nutrition Facts Pack Status

Reference file:

`LunchBox_Connect_Menu_Facts_Pack.pdf`

The file states that values are approximate Menu values prepared for Nursery presentation and preliminary Nutrition review.

It states final operational values remain subject to:

- recipe validation;
- ingredient specifications;
- production consistency.

Status:

`REFERENCE_ONLY`

---

## 29. Nutrition Columns Observed

The Nutrition Facts Pack contains:

- serving weight;
- kcal;
- protein;
- carbohydrates;
- total fat;
- saturated fat;
- fiber;
- sugars;
- sodium.

Status:

`REFERENCE_SCHEMA_EVIDENCE`

Exact production Nutrition schema remains:

`NOT_YET_DEFINED`

---

# PART V — VALUES NOT YET APPROVED

## 30. Still Undefined

The following do not yet have approved production reference values / enums:

- complete Student status list;
- Delivery status list;
- Dispatch status list;
- Kitchen Preparation status list;
- Serving status list;
- Meal Outcome values;
- Allergy taxonomy;
- Allergy severity;
- Dietary Restriction taxonomy;
- Incident categories;
- Operational Issue categories;
- Institution lifecycle values;
- User lifecycle values;
- Menu lifecycle values;
- commercial software configuration;
- production cut-off times;
- absence cut-off times;
- delivery windows;
- report KPIs.

Each remains:

`NOT_YET_DEFINED`

---

## 31. Final Reference Rule

Reference documents may provide accurate facts about current contracts, drafts, and source material.

They do not automatically become software truth.

Only values explicitly marked:

`APPROVED_SOFTWARE_RULE`

may be treated as active permanent project rules.

Values marked:

`REFERENCE_ONLY`

must remain configurable, contextual, or inactive until separately approved.
