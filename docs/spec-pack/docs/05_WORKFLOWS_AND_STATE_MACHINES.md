# 05_WORKFLOWS_AND_STATE_MACHINES.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed operational workflows and state relationships for the LunchBox Connect MVP.

It describes how records move through the approved business chain.

It does not define:

- database schema;
- UI layout;
- technical architecture;
- API implementation;
- infrastructure;
- exact permission enforcement code.

Anything not already confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not invent workflow states, transitions, cut-off times, approval rules, or exception behavior.

---

# PART I — GOVERNING WORKFLOW PRINCIPLE

## 2. Core End-to-End Workflow

The confirmed LunchBox Connect operating chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Each downstream stage must use authoritative upstream data.

A downstream stage must not create a separate business truth that conflicts with an upstream source.

---

## 3. Workflow Traceability

Each operational stage must remain traceable to the records that caused it.

Confirmed traceability relationships include:

- Student belongs to Institution.
- Student has approved operational eligibility.
- Production demand derives from eligible students and approved meal data.
- Dispatch derives from prepared production.
- Delivery derives from dispatch.
- Classroom serving records relate to the correct student and meal.
- Parent-visible meal information derives from authorized underlying records.
- Reporting derives from authoritative operational records.

Exact technical traceability fields are:

`NOT_YET_DEFINED`

---

# PART II — INSTITUTION ONBOARDING / OPERATING SCOPE

## 4. Institution Workflow

Confirmed institution-level flow:

1. Institution exists in LunchBox Connect.
2. Authorized institution users operate within that institution's approved scope.
3. Students are associated with the institution.
4. Classes may be associated with the institution.
5. Parents / guardians may be associated with students.
6. Student allergy / dietary information may be recorded.
7. Student operational / billing eligibility is managed.
8. Eligible students enter the meal-service workflow.

Exact institution onboarding states are:

`NOT_YET_DEFINED`

Exact institution activation / suspension / termination states are:

`NOT_YET_DEFINED`

---

## 5. Branch Workflow

Branches exist where applicable.

The exact workflow for:

- creating branches;
- assigning users to branches;
- assigning students to branches;
- moving students between branches;
- branch-level billing;
- branch-level reporting

is:

`NOT_YET_DEFINED`

---

# PART III — STUDENT ONBOARDING AND ELIGIBILITY

## 6. Student Onboarding Workflow

Confirmed logical flow:

1. A Student record is created within an Institution.
2. The Student is associated with the correct Institution.
3. The Student may be associated with a Class.
4. Parent / Guardian association may be created.
5. Allergy information may be attached to the authoritative Student record.
6. Dietary restriction information may be attached to the authoritative Student record.
7. Operational / enrollment status is assigned according to approved rules.
8. Only an eligible Student may enter standard production, delivery, and serving workflows.

Exact required onboarding fields are:

`NOT_YET_DEFINED`

Exact onboarding completion rule is:

`NOT_YET_DEFINED`

---

## 7. Student Eligibility State

The one confirmed operationally eligible status is:

`ACTIVE_BILLABLE_TO_NURSERY`

Confirmed effect:

When a Student is in the approved eligible state, that Student may enter the standard meal-service operational chain.

The full state machine is:

`NOT_YET_DEFINED`

---

## 8. Student Eligibility Transition Rules

The exact transitions into or out of:

`ACTIVE_BILLABLE_TO_NURSERY`

are:

`NOT_YET_DEFINED`

Claude Code must not invent intermediate states such as:

- pending;
- suspended;
- inactive;
- cancelled;
- expired;
- trial;
- unpaid;
- paused

unless explicitly approved later.

---

## 9. Eligibility Downstream Effect

Confirmed rule:

Eligibility controls whether a Student participates in standard:

- Production;
- Dispatch-related meal demand;
- Delivery-related meal demand;
- Serving workflow.

A Student must not be manually inserted downstream to bypass approved eligibility unless a later approved exception exists.

Exception logic is:

`NOT_YET_DEFINED`

---

# PART IV — ALLERGY / DIETARY WORKFLOW

## 10. Allergy Information Workflow

Confirmed logical flow:

1. Relevant allergy information is associated with the authoritative Student record.
2. Allergy information is centrally managed under approved authority.
3. Authorized Kitchen users receive required allergy information for meal preparation.
4. Authorized Teacher / Nurse / Classroom users receive required allergy awareness.
5. Allergy information may affect meal preparation / special meal handling.

Exact allergy submission workflow is:

`NOT_YET_DEFINED`

Exact allergy approval workflow is:

`NOT_YET_DEFINED`

Exact allergy change workflow is:

`NOT_YET_DEFINED`

Exact allergy escalation workflow is:

`NOT_YET_DEFINED`

---

## 11. Dietary Restriction Workflow

Confirmed logical flow:

1. Dietary restriction information is associated with the Student.
2. Authorized Kitchen users may use that information for meal preparation.
3. Dietary data may affect special meal handling.

Exact submission, approval, change, and escalation workflow is:

`NOT_YET_DEFINED`

---

# PART V — MENU WORKFLOW

## 12. Menu Management Workflow

Confirmed rules:

- Menus are managed system data.
- Menu data may include meals, ingredients, allergens, nutrition information, and portion information.
- Routine menu changes must not require changing application code.

Exact menu workflow states are:

`NOT_YET_DEFINED`

This includes any states such as:

- draft;
- review;
- approved;
- published;
- archived

which must not be assumed until explicitly approved.

---

## 13. Meal Assignment Workflow

Confirmed logical relationship:

A Student may receive an applicable Meal / Menu according to approved rules.

Meal assignment may depend on:

- Institution;
- Student;
- Class where applicable;
- eligibility;
- allergy information;
- dietary restriction information;
- approved menu data.

Exact assignment sequence is:

`NOT_YET_DEFINED`

Exact effective-date logic is:

`NOT_YET_DEFINED`

---

# PART VI — ABSENCE WORKFLOW

## 14. Student Absence Workflow

Absence is part of institution-side operations where applicable to meal service.

Confirmed rule:

Absence may affect meal operations according to approved rules.

The exact workflow for:

- recording absence;
- editing absence;
- same-day absence;
- late absence;
- absence cut-off;
- production removal;
- reactivation;
- financial effect

is:

`NOT_YET_DEFINED`

---

## 15. No Automatic Financial Outcome From Absence

Confirmed rule:

An absence must not automatically create:

- refund;
- credit;
- billing reduction;
- parent financial adjustment

unless an approved commercial rule defines that behavior.

Current financial effect of absence is:

`NOT_YET_DEFINED`

---

# PART VII — PRODUCTION WORKFLOW

## 16. Production Demand Workflow

Confirmed logical flow:

1. System identifies Students who are operationally eligible.
2. Approved meal assignments are applied.
3. Institution context is applied.
4. Class grouping may be applied where applicable.
5. Approved allergy / dietary information is considered where applicable.
6. Production demand is derived.
7. Kitchen Operations receives the required production demand.

Exact calculation timing is:

`NOT_YET_DEFINED`

Exact recalculation triggers are:

`NOT_YET_DEFINED`

Exact locking time is:

`NOT_YET_DEFINED`

---

## 17. Production Demand State Machine

Confirmed concept:

Production demand exists before or as part of Kitchen preparation.

Exact states are:

`NOT_YET_DEFINED`

Claude Code must not invent states such as:

- pending;
- generated;
- confirmed;
- locked;
- in preparation;
- completed

until approved.

---

## 18. Kitchen Preparation Workflow

Confirmed Kitchen operational sequence:

1. Kitchen receives authoritative production demand.
2. Kitchen prepares required meals.
3. Allergy / dietary modifications are handled where applicable.
4. Special meal handling occurs where required.
5. Preparation status may be recorded.
6. Packing / labels may occur where defined.
7. Production reaches dispatch readiness.

Exact preparation states and transitions are:

`NOT_YET_DEFINED`

---

## 19. Kitchen Cannot Bypass Demand

Kitchen must not create an independent student-count workflow.

Confirmed restriction:

Kitchen users may not change Student eligibility to alter production demand.

---

## 20. Special Meal Workflow

Confirmed concept:

Special meal handling may be required by approved Allergy or Dietary Restriction data.

Exact workflow is:

`NOT_YET_DEFINED`

This includes:

- who creates the modification;
- who approves it;
- who acknowledges it;
- whether it requires separate label handling;
- whether it requires separate packing.

---

# PART VIII — PACKING AND LABEL WORKFLOW

## 21. Packing Workflow

Where packing is used:

1. Packing must relate to actual Production.
2. Packed quantities must not become an unrelated quantity system.
3. Packing may feed Dispatch readiness.

Exact packing states are:

`NOT_YET_DEFINED`

Exact packing completion rule is:

`NOT_YET_DEFINED`

---

## 22. Label Workflow

Labels exist where defined.

Confirmed rule:

A label must relate to approved production / packing data.

Exact label-generation workflow is:

`NOT_YET_DEFINED`

Exact printing workflow is:

`NOT_YET_DEFINED`

---

# PART IX — DISPATCH WORKFLOW

## 23. Dispatch Workflow

Confirmed logical flow:

1. Production reaches approved readiness for dispatch.
2. Dispatch record relates to actual prepared Production.
3. Dispatch contains or references the quantity / meal information being handed to Logistics.
4. Dispatch feeds the Delivery workflow.

Exact dispatch states are:

`NOT_YET_DEFINED`

Exact dispatch confirmation user is:

`NOT_YET_DEFINED`

Exact dispatch lock rule is:

`NOT_YET_DEFINED`

---

## 24. Dispatch State Machine

No specific dispatch status values have been formally approved.

Therefore:

`DISPATCH_STATE_MACHINE = NOT_YET_DEFINED`

Claude Code must not treat common logistics states as approved unless later defined.

---

# PART X — DELIVERY WORKFLOW

## 25. Delivery Workflow

Confirmed logical flow:

1. Delivery is created from or linked to approved Dispatch.
2. Delivery identifies the destination Institution.
3. A Driver / Logistics user may be assigned.
4. Driver sees only assigned deliveries.
5. Delivery timing / status may be recorded.
6. Delivery issues / shortages may be recorded.
7. Delivery confirmation / handover evidence may be recorded where defined.
8. Delivery feeds downstream institution / serving operations.

Exact route generation is:

`NOT_YET_DEFINED`

Exact delivery window is:

`NOT_YET_DEFINED`

Exact proof-of-delivery method is:

`NOT_YET_DEFINED`

---

## 26. Delivery State Machine

No complete delivery state list has been formally approved.

Therefore:

`DELIVERY_STATE_MACHINE = NOT_YET_DEFINED`

Claude Code must not invent states such as:

- assigned;
- picked up;
- en route;
- arrived;
- delivered;
- failed;
- cancelled

unless explicitly approved.

---

## 27. Delivery Issue Workflow

Confirmed concept:

Delivery issues / shortages may be recorded.

Exact issue workflow is:

`NOT_YET_DEFINED`

This includes:

- issue categories;
- severity;
- assignee;
- escalation;
- resolution;
- closure.

---

## 28. Delivery Handover Boundary

Current project agreements establish the operational boundary:

- LunchBox Connect handles meal preparation, packaging, and delivery.
- The Nursery / School handles internal serving / feeding after delivery handover.

The exact system event that formally marks handover is:

`NOT_YET_DEFINED`

---

# PART XI — CLASSROOM / SERVING WORKFLOW

## 29. Classroom Daily Workflow

Confirmed classroom-side operational concepts include:

- Today / daily view;
- assigned-class students;
- allergy awareness;
- meal tracking;
- meal serving status;
- meal outcome / consumption;
- permitted notes / incidents.

Previously established meal-tracking categories include:

- breakfast;
- snack;
- lunch;
- afternoon snack.

Exact daily screen behavior is defined later in the UI specification.

---

## 30. Serving Workflow

Confirmed logical flow:

1. Authorized Teacher / Nurse / Classroom Staff views Students in assigned Class scope.
2. User sees required meal / allergy awareness information.
3. Meal serving status may be recorded.
4. Meal outcome / consumption may be recorded.
5. Permitted note / incident information may be recorded.
6. Authorized downstream Parent visibility and Reporting may use approved data.

Exact serving states are:

`NOT_YET_DEFINED`

---

## 31. Meal Outcome Workflow

Confirmed concept:

Authorized classroom users may record meal outcome / consumption.

Exact values are:

`NOT_YET_DEFINED`

Exact edit window is:

`NOT_YET_DEFINED`

Exact correction workflow is:

`NOT_YET_DEFINED`

---

## 32. Classroom Note Workflow

Confirmed rule:

Unrestricted free-text classroom notes must not automatically become parent-visible.

Parent-visible classroom information must use:

- safe predefined status; or
- review before publication.

Exact note states are:

`NOT_YET_DEFINED`

Exact reviewer is:

`NOT_YET_DEFINED`

Exact publication workflow is:

`NOT_YET_DEFINED`

---

# PART XII — PARENT VISIBILITY WORKFLOW

## 33. Parent Visibility Workflow

Confirmed logical flow:

1. Parent / Guardian account is associated with authorized Student / Students.
2. Parent may access only their own authorized child / children.
3. Parent-visible information is derived from approved underlying records.
4. Parent may view approved child-specific menu, ingredients, allergens, nutrition, meal information, and permitted history / feedback.
5. Parent does not receive direct LunchBox Connect payment workflow in the MVP.

Exact timing of when meal outcomes become visible is:

`NOT_YET_DEFINED`

Exact visibility rules for notes / incidents are:

`NOT_YET_DEFINED`

---

## 34. Parent Payment Workflow

For the MVP:

`NO_DIRECT_PARENT_PAYMENT_WORKFLOW`

This means no workflow for:

- parent checkout;
- parent payment to LunchBox Connect;
- parent payment confirmation;
- parent refund;
- direct parent subscription billing.

---

# PART XIII — INSTITUTIONAL BILLING WORKFLOW

## 35. Institutional Billing Workflow

Confirmed commercial relationship:

**Institution pays LunchBox Connect.**

Institutional billing / enrollment information affects Student operational eligibility.

Exact workflow for:

- invoice creation;
- billing cycle opening;
- billing cycle closing;
- institution payment receipt;
- student activation;
- student deactivation;
- overdue institution handling;
- credits;
- adjustments

is:

`NOT_YET_DEFINED`

---

## 36. Billing-to-Eligibility Link

Confirmed rule:

Institutional billing / enrollment status controls operational Student eligibility.

The exact transition from billing information to:

`ACTIVE_BILLABLE_TO_NURSERY`

is:

`NOT_YET_DEFINED`

---

# PART XIV — REPORTING WORKFLOW

## 37. Reporting Workflow

Confirmed logical flow:

1. Operational records are created through approved workflows.
2. Reports read authoritative operational records.
3. Reports must not create independent business truth.
4. Authorized users see reporting according to role scope.

Possible confirmed source domains include:

- Institutions;
- Students;
- eligibility;
- Meals;
- Production;
- Dispatch;
- Delivery;
- Classroom Meal Records;
- institutional operations.

Exact report-generation timing is:

`NOT_YET_DEFINED`

Exact KPI logic is:

`NOT_YET_DEFINED`

---

# PART XV — AUDIT AND OVERRIDE WORKFLOW

## 38. Audit Workflow

Important administrative changes are intended to be auditable.

Confirmed audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

Exact actions that create an audit record are:

`NOT_YET_DEFINED`

---

## 39. Super Admin Override Workflow

Confirmed concept:

Super Admin has override authority.

Where an override is required by an approved workflow, it must remain distinguishable from an ordinary edit.

Exact override sequence is:

`NOT_YET_DEFINED`

Exact reason requirement is:

`NOT_YET_DEFINED`

---

# PART XVI — USER / ACCESS WORKFLOWS

## 40. User Access Scope

Confirmed access scopes:

- Super Admin: system-wide.
- Nursery / School Admin: own institution.
- Parent / Guardian: own child / children.
- Teacher / Nurse / Classroom Staff: assigned class / classes.
- Kitchen Operations: production and required allergy / dietary information.
- Driver / Logistics: assigned deliveries.
- Finance / Owner: reports only.
- Viewer: read-only.
- Operations Manager: operational logs and issues; exact scope not yet defined.

Exact account lifecycle is:

`NOT_YET_DEFINED`

---

## 41. User Creation / Invitation Workflow

The exact workflow for:

- creating user;
- inviting user;
- accepting invitation;
- setting password;
- deactivating user;
- reactivating user;
- recovering account

is:

`NOT_YET_DEFINED`

---

# PART XVII — OPERATIONS LOG / ISSUE WORKFLOW

## 42. Operational Log Workflow

Operations Manager has confirmed access to operational logs.

Exact log creation, ownership, edit, and closure workflow is:

`NOT_YET_DEFINED`

---

## 43. Operational Issue Workflow

Operations Manager has confirmed access to operational issues.

Exact issue lifecycle is:

`NOT_YET_DEFINED`

---

# PART XVIII — CONFIRMED STATE MACHINES

## 44. Confirmed Student Eligibility State

At present, only one explicit Student operational state has been approved:

`ACTIVE_BILLABLE_TO_NURSERY`

Its confirmed meaning:

The Student is operationally eligible to enter the standard LunchBox Connect meal-service workflow.

No complete state machine is yet approved.

---

## 45. Confirmed Parent Payment State Machine

There is no direct parent payment state machine in the MVP.

State:

`EXCLUDED_FROM_MVP`

---

## 46. Other State Machines

The following state machines remain:

`NOT_YET_DEFINED`

- Institution lifecycle;
- Branch lifecycle;
- Student lifecycle;
- full Student eligibility lifecycle;
- Allergy submission / approval;
- Dietary restriction approval;
- Menu lifecycle;
- Meal assignment lifecycle;
- Absence lifecycle;
- Production demand lifecycle;
- Kitchen preparation lifecycle;
- Special meal lifecycle;
- Packing lifecycle;
- Dispatch lifecycle;
- Delivery lifecycle;
- Delivery issue lifecycle;
- Classroom serving lifecycle;
- Meal outcome lifecycle;
- Classroom note review lifecycle;
- Institutional billing lifecycle;
- User account lifecycle;
- Operational issue lifecycle.

Claude Code must not invent these states.

---

# PART XIX — CONFIRMED WORKFLOW RESTRICTIONS

## 47. No Eligibility Bypass

A downstream workflow must not manually add an ineligible Student to standard production, delivery, or serving operations unless an approved exception rule exists.

Current exception rule:

`NOT_YET_DEFINED`

---

## 48. No Kitchen Eligibility Editing

Kitchen must not change Student eligibility.

---

## 49. No Independent Production Truth

Kitchen must not create student demand independently from authoritative eligibility and approved meal data.

---

## 50. No Independent Delivery Truth

Delivery records must relate to Dispatch.

Delivery must not become an unrelated quantity system.

---

## 51. No Independent Parent Truth

Parent-visible information must derive from authoritative underlying records.

---

## 52. No Cross-Scope Classroom Workflow

Teacher / Nurse / Classroom Staff must not operate on unrelated classes.

---

## 53. No Cross-Scope Driver Workflow

Driver / Logistics users must not operate on unrelated deliveries.

---

## 54. No Direct Parent Payment Workflow

The MVP must not introduce parent payment workflow at any stage.

---

## 55. No Live Chat Workflow

Confirmed rule:

`NO_LIVE_CHAT`

---

# PART XX — END-TO-END REFERENCE FLOW

## 56. Confirmed Reference Flow

The following is the confirmed logical operational flow using only approved project facts:

1. An Institution exists in LunchBox Connect.
2. A Student is associated with that Institution.
3. The Student may be associated with a Class.
4. Parent / Guardian association may exist.
5. Allergy / Dietary Restriction information may be associated with the Student.
6. Institutional billing / enrollment information determines operational eligibility according to approved rules.
7. When eligible, the Student may hold status:
   `ACTIVE_BILLABLE_TO_NURSERY`
8. Eligible Student data contributes to approved Meal / Menu assignment.
9. Approved Student / Meal data contributes to Production Demand.
10. Kitchen Operations receives authoritative Production Demand.
11. Kitchen prepares the required Meals.
12. Allergy / Dietary modifications are applied where required.
13. Packing / labels may occur where defined.
14. Production becomes ready for Dispatch according to the future approved state rules.
15. Dispatch is linked to actual Production.
16. Delivery is linked to Dispatch and destination Institution.
17. Assigned Driver / Logistics user handles the Delivery within authorized scope.
18. Delivery reaches the Institution.
19. After handover, internal serving / feeding is the Institution's responsibility under the current service model.
20. Authorized Teacher / Nurse / Classroom Staff records permitted meal-service information for assigned Students.
21. Parent / Guardian may see authorized child-specific information derived from approved underlying records.
22. Reporting uses authoritative operational records.

Any transition detail not explicitly defined above remains:

`NOT_YET_DEFINED`

---

# PART XXI — IMPLEMENTATION RULES

## 57. Workflow Implementation Must Follow Approved States

Claude Code must not hard-code a workflow state that has not been approved.

If implementation reaches an undefined state requirement, it must identify it as:

`NOT_YET_DEFINED`

---

## 58. No Silent State Creation

Claude Code must not create status values merely because a framework or component expects them.

Examples of unapproved state names must not be treated as project truth.

---

## 59. No Silent Transition Creation

Claude Code must not decide:

- who may move a record between states;
- when a transition happens;
- whether a transition is automatic;
- whether a transition is reversible;
- whether a reason is required

unless approved.

---

## 60. Workflow Failures Must Remain Failures

A failed transition must not be displayed or stored as completed.

Examples:

- failed eligibility transition must not result in active operational status;
- failed dispatch must not result in delivered state;
- failed delivery confirmation must not be shown as confirmed;
- failed meal record save must not appear recorded.

Exact technical error handling is defined elsewhere.

---

## 61. State Changes Must Respect Role Scope

Any future approved state transition must also respect the approved roles-and-permissions file.

A valid business transition is not automatically available to every role.

---

## 62. Final Workflow Rule

LunchBox Connect must preserve this confirmed chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

At present, the only explicitly approved operational status value is:

`ACTIVE_BILLABLE_TO_NURSERY`

All other exact state names and transition rules remain:

`NOT_YET_DEFINED`

The software must preserve the confirmed workflow relationships without inventing missing states, shortcuts, exception rules, or transition authority.

---

## Lifecycle State Machines (added 2026-08-23)

### Account

```
                  deactivate (reason)
   ACTIVE  ─────────────────────────────►  DEACTIVATED
      ▲   · ends current class assignments      │
      │   · bans the Auth account               │
      │   · identity helpers return NULL        │
      └───────────────────────────────────◄─────┘
                  reactivate
        · role scope returns
        · class assignments do NOT return
```

**Refused transitions:** deactivating yourself; deactivating the last active
Super Admin. Neither has a fallback — the action fails and says why.

**Terminal states:** none. There is no DELETED state for an account.

### Institution

```
                   archive (reason)
   OPERATING  ───────────────────────────►  ARCHIVED
       ▲    refused while meal service is        │
       │    published for today or later         │
       └────────────────────────────────────◄────┘
                   reactivate
```

While ARCHIVED: no new class, student, service plan, rotation assignment,
calendar exception, publication or classroom record. Everything already
recorded remains readable, including through the Parent portal.

**Terminal states:** none.

### Class

```
                   archive (reason)
   RUNNING  ─────────────────────────────►  ARCHIVED
      ▲     refused while any student or          │
      │     staff member is still assigned        │
      └─────────────────────────────────────◄─────┘
                   reactivate
```

While ARCHIVED: takes no student, no `class_staff` row, no `serving_records`
row. Stops being offered as a destination in every class picker, except as the
current class of a child who is already in it — so the interface never
misreports that child as unassigned.

**Terminal states:** none.

### Guardian link

```
   LINKED  ──── revoke (reason REQUIRED, Super Admin) ────►  (row deleted)
```

The link row is the only thing removed. The Parent account, the child and all
meal history survive. The link can be made again at any time — this is the one
lifecycle in the product that IS a row deletion, and it is safe precisely
because the row carries no history of its own.

### Password

```
   issued at creation ──► administrator issues a replacement ──► ...
                     └──► the person changes it themselves ────► ...
```

At no point is any value readable. There is no "forgot password" email path.
An audit row records each administrative issuance, never a value.
