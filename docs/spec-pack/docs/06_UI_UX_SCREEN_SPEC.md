# 06_UI_UX_SCREEN_SPEC.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed user-interface and user-experience requirements for the LunchBox Connect MVP.

It specifies:

- which role-facing areas must exist;
- what confirmed information each area must support;
- which access boundaries affect the interface;
- which interaction behaviors are already established;
- which interface details remain undefined.

This document does not define:

- visual branding;
- exact colors;
- typography;
- component library;
- spacing system;
- technical frontend framework;
- backend authorization implementation;
- database schema;
- API contracts.

Anything not already confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not invent screens, tabs, controls, actions, or navigation merely because they are common in other software.

---

# PART I — GLOBAL UI PRINCIPLES

## 2. One Connected Product

LunchBox Connect must present different role-based interfaces over the same connected operational system.

The UI must not imply that each portal owns a separate version of operational truth.

Confirmed principle:

**One source of truth, multiple role-based views.**

---

## 3. Role-Based Visibility

Each user interface must respect the approved role scope.

Confirmed access boundaries:

- Super Admin: system-wide.
- Nursery / School Admin: own institution.
- Parent / Guardian: own child / children.
- Teacher / Nurse / Classroom Staff: assigned class / classes.
- Kitchen Operations: production and required allergy / dietary information.
- Driver / Logistics: assigned deliveries.
- Finance / Owner: reports only.
- Viewer: read-only.
- Operations Manager: operational logs and issues; exact organizational scope not yet defined.

The UI must not expose controls for actions the user is not authorized to perform.

Backend enforcement is required separately and is not replaced by hiding UI.

---

## 4. No Unnecessary Access

Confirmed rule:

**No unnecessary access.**

Screens must not show unrelated data merely because it is technically available.

Examples:

- Parent must not see unrelated children.
- Teacher must not see unrelated classes.
- Driver must not see unrelated deliveries.
- Kitchen must not see unnecessary parent or financial data.
- Nursery / School Admin must not see unrelated institutions.

---

## 5. No Live Chat

Confirmed MVP rule:

**No live chat.**

No portal should include live-chat functionality unless this rule is explicitly changed.

---

## 6. Parent Payment Exclusion

The Parent / Guardian interface must not include direct LunchBox Connect payment functionality.

The UI must not include:

- parent checkout;
- parent card payment to LunchBox Connect;
- parent LunchBox Connect invoices;
- parent LunchBox Connect refund controls;
- direct LunchBox Connect subscription billing.

---

# PART II — GLOBAL NAVIGATION

## 7. Global Navigation

Each role must have access only to navigation destinations appropriate to that role.

Exact navigation labels, grouping, hierarchy, and order are:

`NOT_YET_DEFINED`

Claude Code must not infer extra modules beyond the approved product domains.

---

## 8. Role-Specific Home / Landing Screen

Each role may have a role-appropriate landing or home area.

The exact home screen for each role is:

`NOT_YET_DEFINED`

Exception:

Teacher / Nurse / Classroom Staff previously established a role-based daily / “Today” operational view.

---

# PART III — SUPER ADMIN UI

## 9. Super Admin Command Center

The system must include a Super Admin interface with master-control visibility across approved LunchBox Connect domains.

Confirmed Super Admin areas include:

- institutions;
- branches where applicable;
- users;
- students;
- classes;
- parents / guardians;
- menus;
- allergies and dietary restrictions;
- institutional billing status / cycles;
- kitchen operations;
- deliveries;
- reporting;
- system configuration;
- audit information;
- overrides.

---

## 10. Super Admin Institutions Screen

The Super Admin UI must include an area for Institutions.

Confirmed purpose:

- view/manage institution records across the system.

Exact:

- table columns;
- filters;
- search;
- create form;
- edit form;
- detail-page layout;
- institution lifecycle actions

are:

`NOT_YET_DEFINED`

---

## 11. Super Admin Branches Screen

Branches are included where applicable.

A Super Admin branch-management area may be required.

Exact branch UI is:

`NOT_YET_DEFINED`

because the branch business model is not fully defined.

---

## 12. Super Admin Users Screen

The Super Admin UI must include a system-user management area.

Confirmed purpose:

- manage users across approved role domains.

Exact:

- account fields;
- invite flow;
- deactivate flow;
- reset flow;
- role-assignment UI;
- scope-assignment UI

are:

`NOT_YET_DEFINED`

---

## 13. Super Admin Students Screen

The Super Admin UI must include system-wide Student visibility and management according to approved permissions.

Confirmed Student-related concepts include:

- identity;
- institution;
- class;
- parent / guardian association;
- allergy information;
- dietary restriction information;
- operational / enrollment status;
- meal-related information.

Exact student list columns and detail layout are:

`NOT_YET_DEFINED`

---

## 14. Super Admin Classes Screen

The Super Admin UI must include a Classes area.

Confirmed purpose:

- system-wide authorized class management.

Exact class screen behavior is:

`NOT_YET_DEFINED`

---

## 15. Super Admin Parents / Guardians Screen

The Super Admin UI includes Parent / Guardian administration as an approved domain.

Exact guardian list, detail, edit, invitation, association, and removal interfaces are:

`NOT_YET_DEFINED`

---

## 16. Super Admin Allergy / Dietary Screen

The Super Admin UI must support centrally managed allergy approval and allergy / dietary administration.

Confirmed purpose:

- view approved allergy / dietary information;
- support centrally managed allergy authority.

Exact:

- approval queue;
- review layout;
- severity display;
- evidence fields;
- change history;
- action buttons

are:

`NOT_YET_DEFINED`

---

## 17. Super Admin Status / Eligibility Screen

The Super Admin UI must support operational-status administration.

Confirmed eligible status:

`ACTIVE_BILLABLE_TO_NURSERY`

Exact:

- full status list;
- transition controls;
- eligibility override flow;
- bulk changes;
- validation messaging

are:

`NOT_YET_DEFINED`

---

## 18. Super Admin Institutional Billing Screen

The Super Admin UI must support institutional billing / eligibility administration.

Confirmed rule:

- Institution pays LunchBox Connect.
- Parents do not pay LunchBox Connect directly.

Exact billing-screen fields and actions are:

`NOT_YET_DEFINED`

---

## 19. Super Admin Menus Screen

The Super Admin UI must include menu administration.

Confirmed data concepts may include:

- meal;
- ingredients;
- allergens;
- nutrition information;
- portion information.

Exact menu-screen structure and publication workflow are:

`NOT_YET_DEFINED`

---

## 20. Super Admin Kitchen Operations Screen

The Super Admin UI must include authorized visibility into Kitchen Operations.

Confirmed operational areas include:

- production quantities;
- meals by institution;
- meals by class where applicable;
- allergy / dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

Exact controls are:

`NOT_YET_DEFINED`

---

## 21. Super Admin Deliveries Screen

The Super Admin UI must include Delivery / Logistics visibility.

Confirmed data concepts include:

- destination institution;
- dispatched quantities;
- delivery status;
- delivery timing;
- issues / shortages where recorded;
- delivery confirmation / handover evidence where defined;
- assigned Driver where applicable.

Exact screen layout and actions are:

`NOT_YET_DEFINED`

---

## 22. Super Admin Reporting Screen

The Super Admin UI must include Reporting.

Confirmed report source domains may include:

- institutions;
- students;
- eligibility;
- meals;
- production;
- dispatch;
- delivery;
- classroom meal records;
- institutional operations.

Exact dashboards, charts, KPIs, filters, and exports are:

`NOT_YET_DEFINED`

---

## 23. Super Admin System Configuration Screen

The Super Admin UI includes system configuration.

Exact configuration areas are:

`NOT_YET_DEFINED`

---

## 24. Super Admin Audit Screen

The Super Admin UI includes audit information.

Confirmed audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

Exact audit list, filters, detail view, and retention display are:

`NOT_YET_DEFINED`

---

## 25. Super Admin Override UI

Super Admin has override authority.

The UI must not make an override appear as an ordinary edit when the approved workflow requires explicit override handling.

Exact override modal, reason field, warning, and confirmation behavior are:

`NOT_YET_DEFINED`

---

# PART IV — NURSERY / SCHOOL ADMIN UI

## 26. Nursery / School Portal

The system must include an institution-scoped Nursery / School Admin interface.

Confirmed scope:

- own institution only.

Confirmed areas include:

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

---

## 27. Nursery Students Screen

The Nursery / School UI must include institution-scoped Student management / visibility.

Exact create, edit, archive, and detail controls are:

`NOT_YET_DEFINED`

---

## 28. Nursery Classes Screen

The Nursery / School UI must include institution-scoped Classes.

Exact class management behavior is:

`NOT_YET_DEFINED`

---

## 29. Nursery Parents / Guardians Screen

The Nursery / School UI must support institution-scoped Parent / Guardian relationships where authorized.

Exact actions are:

`NOT_YET_DEFINED`

---

## 30. Nursery Staff Screen

Institution staff is an approved institution-side area.

Exact staff-management UI and whether Nursery Admin may create / edit assignments are:

`NOT_YET_DEFINED`

---

## 31. Nursery Allergy / Dietary Screen

The Nursery / School interface must support authorized visibility / interaction with Student allergy and dietary information.

Exact edit / submit / approval request behavior is:

`NOT_YET_DEFINED`

---

## 32. Nursery Absence Screen

Absence is part of institution-side operations where applicable.

The UI must be capable of representing absence information once the business rules are approved.

Exact:

- entry screen;
- cutoff warning;
- edit behavior;
- production-impact display

are:

`NOT_YET_DEFINED`

---

## 33. Nursery Deliveries Screen

The Nursery / School interface includes Delivery visibility.

Exact:

- current delivery view;
- history;
- issue reporting;
- confirmation action

are:

`NOT_YET_DEFINED`

---

## 34. Nursery Reporting Screen

The Nursery / School interface includes meal-related reporting for its own institution.

Exact reports, charts, filters, and exports are:

`NOT_YET_DEFINED`

---

## 35. Nursery Completion Monitoring

Previously established:

Nursery Admins can monitor:

- class completion;
- staff completion;
- daily operational progress.

The UI must support this concept.

Exact progress indicators and completion calculations are:

`NOT_YET_DEFINED`

---

# PART V — PARENT / GUARDIAN UI

## 36. Parent Portal

The system must include a Parent / Guardian interface.

Confirmed scope:

**Own child / children only.**

---

## 37. Parent Child Selector

Where a Parent / Guardian is associated with more than one child, the interface may require child selection.

The exact child-selection UX is:

`NOT_YET_DEFINED`

The access rule remains:

- only authorized own child / children.

---

## 38. Parent Menu View

The Parent interface must support authorized child-specific Menu information.

Confirmed possible information includes:

- meal;
- ingredients;
- allergens;
- nutrition information;
- portion information where approved.

Exact presentation is:

`NOT_YET_DEFINED`

---

## 39. Parent Meal Information View

The Parent interface must support approved child-specific meal information.

Exact daily / weekly / historical presentation is:

`NOT_YET_DEFINED`

---

## 40. Parent Meal History / Feedback View

The Parent interface may show permitted meal history / feedback.

Exact:

- history period;
- outcome values;
- note visibility;
- timing of publication

are:

`NOT_YET_DEFINED`

---

## 41. Parent Allergy / Nutrition Visibility

The Parent interface may display authorized:

- allergen information;
- nutrition information.

Exact data fields and warnings are:

`NOT_YET_DEFINED`

---

## 42. Parent Institution Communication

Institution-related communication is included where defined.

Exact:

- announcement format;
- delivery mechanism;
- read status;
- history

are:

`NOT_YET_DEFINED`

There is no live chat.

---

## 43. Parent Payment UI Exclusion

The Parent portal must not include:

- LunchBox Connect payment checkout;
- LunchBox Connect invoice payment;
- stored payment method for LunchBox Connect;
- refund interface;
- direct LunchBox Connect subscription billing.

---

# PART VI — TEACHER / NURSE / CLASSROOM UI

## 44. Classroom Interface

The system must include a Teacher / Nurse / Classroom Staff interface.

Confirmed access scope:

**Assigned class / classes only.**

---

## 45. Classroom “Today” View

A role-based daily / “Today” operational view was previously established.

Confirmed purpose:

- show the classroom user's current assigned operational meal work.

Confirmed layout (docs/13 Decision 032): a tablet-optimized workflow — select the Meal period once, then move through the Class roster without re-selecting Institution, Class, date, period, or Meal per Student. Fast Previous/Next Student navigation and a "next unrecorded Student" shortcut are required. A visible `X / Y completed` progress indicator for the selected period is required.

---

## 46. Classroom Student List

The classroom interface must show Students within the user's assigned class scope.

Confirmed related information includes:

- an optional Student photo, falling back to initials when no photo exists (docs/13 Decision 032 §5-6);
- student meal status;
- allergy awareness;
- current meal-tracking needs;
- per-Student completion / exception state (recorded, low intake, refusal, concern, absence, not-served), so Staff never have to open every record to see who needs attention.

Confirmed exclusions: billing, contracts, Parent finances, database IDs, Production quantities, unrelated administration, and long Nutrition tables do not belong on this screen.

Exact list columns / cards beyond the above are:

`NOT_YET_DEFINED`

---

## 47. Classroom Allergy Awareness

The classroom interface must surface required allergy awareness for authorized assigned Students.

Exact:

- warning style;
- fields;
- priority order;
- acknowledgment action

are:

`NOT_YET_DEFINED`

---

## 48. Classroom Meal Tracking

Previously established meal-tracking categories include:

- breakfast;
- snack;
- lunch;
- afternoon snack.

The classroom interface must support approved tracking for applicable meal periods.

Exact tracking behavior is:

`NOT_YET_DEFINED`

---

## 49. Meal Serving Control

The classroom interface must support recording approved meal serving status.

Confirmed serving states (docs/13 Decision 032): `SERVED` / `NOT_SERVED`. `NOT_SERVED` must not be visually or functionally equated with 0% consumed.

---

## 50. Meal Outcome / Consumption Control

The classroom interface must support meal outcome / consumption recording.

Confirmed control (docs/13 Decision 032): a large four-quarter visual Meal/plate control (empty / ¼ / ½ / ¾ / full, tap-only, no typed percentage), paired with a single-tap eating-behavior selection (`ATE_INDEPENDENTLY` / `NEEDED_ENCOURAGEMENT` / `REFUSED`). A functionally equivalent accessible control may be supplied alongside the visual where needed.

Confirmed exception-first rule: a low-intake reason selector and the concern-note field appear only when triggered (low consumption, or `CONCERN_OBSERVED`) — not shown for every Student by default.

---

## 51. Classroom Note / Incident Control

The classroom interface may support permitted notes / incidents.

Confirmed restriction:

Unrestricted free-text notes must not automatically become parent-visible.

Parent-visible information must use:

- safe predefined status; or
- review before publication.

Exact note form and review indicator are:

`NOT_YET_DEFINED`

---

## 52. Classroom Daily Completion

The system must support daily operational completion concepts for Nursery Admin monitoring.

Exact teacher / nurse completion indicator and criteria are:

`NOT_YET_DEFINED`

---

# PART VII — KITCHEN OPERATIONS UI

## 53. Kitchen Operations Portal

The system must include a Kitchen Operations interface.

Confirmed scope:

- production and required allergy / dietary information only.

Kitchen must not receive unnecessary parent, financial, or institution-admin data.

Kitchen is a LunchBox Connect operational entity, not an Institution — the portal must show demand across the Kitchen's responsibility, not scope it to one Institution (docs/13 Decision 031).

---

## 54. Kitchen Production View

The Kitchen interface must support:

- production quantities;
- meals by institution;
- meals by class where applicable;
- approved Meal / Menu assignment;
- allergy / dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

Exact table / board / grouping presentation is:

`NOT_YET_DEFINED`

---

## 55. Kitchen Demand Source Visibility

Production quantities must derive from authoritative approved operational data.

The UI must not present an independent editable student total as the source of truth.

Exact drill-down to supporting Student demand is:

`NOT_YET_DEFINED`

---

## 56. Kitchen Allergy / Dietary View

The Kitchen interface must surface the approved allergy / dietary information needed for safe preparation.

Exact identifying fields and warning presentation are:

`NOT_YET_DEFINED`

---

## 57. Kitchen Special Meal View

The Kitchen interface must support special meal handling where required.

Exact special-meal screen behavior is:

`NOT_YET_DEFINED`

---

## 58. Kitchen Preparation Status Controls

Preparation status is part of the confirmed Kitchen domain.

Exact status controls are:

`NOT_YET_DEFINED`

---

## 59. Kitchen Packing / Labels UI

Packing / labels exist where defined.

Exact:

- packing screen;
- label preview;
- label print action;
- quantity confirmation

are:

`NOT_YET_DEFINED`

---

## 60. Kitchen Dispatch Readiness

Dispatch readiness is part of the confirmed Kitchen domain.

Exact readiness control and validation are:

`NOT_YET_DEFINED`

---

# PART VIII — DRIVER / LOGISTICS UI

## 61. Driver / Logistics Portal

The system must include a Driver / Logistics interface.

Confirmed scope:

**Assigned deliveries only.**

---

## 62. Assigned Deliveries View

The Driver interface must show assigned Delivery work.

Confirmed information may include:

- destination institution;
- dispatched quantities;
- delivery status;
- delivery timing;
- delivery issues / shortages where recorded;
- delivery confirmation / handover evidence where defined.

Exact list / card structure is:

`NOT_YET_DEFINED`

---

## 63. Delivery Detail View

The Driver interface must allow authorized access to the details required to complete an assigned delivery.

Exact detail fields are:

`NOT_YET_DEFINED`

---

## 64. Delivery Status Control

Delivery status may be recorded.

Exact status buttons / states are:

`NOT_YET_DEFINED`

---

## 65. Delivery Issue / Shortage UI

The Driver interface may support recording delivery issues / shortages.

Exact issue form and categories are:

`NOT_YET_DEFINED`

---

## 66. Delivery Confirmation / Handover UI

The Driver interface may support delivery confirmation / handover evidence where defined.

Exact:

- confirmation action;
- evidence capture;
- signature;
- photo;
- name;
- timestamp display

are:

`NOT_YET_DEFINED`

No proof type may be assumed until approved.

---

# PART IX — OPERATIONS MANAGER UI

## 67. Operations Manager Interface

The system includes an Operations Manager access domain.

Confirmed areas:

- operational logs;
- operational issues.

Exact navigation and screen design are:

`NOT_YET_DEFINED`

---

## 68. Operational Logs Screen

The interface must support authorized visibility / handling of operational logs.

Exact:

- columns;
- categories;
- filters;
- create / edit controls;
- resolution behavior

are:

`NOT_YET_DEFINED`

---

## 69. Operational Issues Screen

The interface must support authorized visibility / handling of operational issues.

Exact:

- issue states;
- severity;
- assignment;
- escalation;
- closure

are:

`NOT_YET_DEFINED`

---

# PART X — FINANCE / OWNER UI

## 70. Finance / Owner Interface

The Finance / Owner role is confirmed as:

**Reports only.**

The UI must not expose operational edit controls to this role.

---

## 71. Finance / Owner Reporting Screen

The interface must provide authorized reporting access.

Exact report scope and visualizations are:

`NOT_YET_DEFINED`

---

# PART XI — VIEWER UI

## 72. Viewer Interface

The Viewer role is:

**Read-only.**

The UI must not expose functional create, edit, delete, approve, publish, override, or status-change actions.

Exact read scope is:

`NOT_YET_DEFINED`

---

# PART XII — SEARCH, FILTERS, SORTING, EXPORTS

## 73. Search

Search behavior for any module is:

`NOT_YET_DEFINED`

Claude Code must not assume global search exists unless later approved.

---

## 74. Filters

Exact filters for all lists are:

`NOT_YET_DEFINED`

---

## 75. Sorting

Exact sorting behavior is:

`NOT_YET_DEFINED`

---

## 76. Export / Download

Exact export / download rights and formats are:

`NOT_YET_DEFINED`

---

# PART XIII — FORMS AND VALIDATION

## 77. Form Fields

Exact form fields belong to the approved data model once defined.

This UI specification must not invent business fields that are still undefined.

---

## 78. Required Fields

Exact required fields for:

- institution;
- student;
- guardian;
- class;
- allergy;
- dietary restriction;
- menu;
- billing;
- delivery;
- classroom records

are:

`NOT_YET_DEFINED`

---

## 79. Validation Messaging

The UI must not present a failed or incomplete action as successful.

Exact validation copy and placement are:

`NOT_YET_DEFINED`

---

## 80. Success States

A success message may only appear after the relevant action actually succeeds.

Exact success-message design is:

`NOT_YET_DEFINED`

---

## 81. Error States

The UI must distinguish:

- failed action;
- incomplete action;
- blocked action;
- missing required data.

Exact error-screen and inline-error design are:

`NOT_YET_DEFINED`

---

# PART XIV — AUDIT / HISTORY UI

## 82. Audit Visibility

Super Admin includes audit visibility.

Exact UI for:

- change history;
- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required

is:

`NOT_YET_DEFINED`

---

## 83. History Within Records

Whether individual record detail pages show embedded history is:

`NOT_YET_DEFINED`

---

# PART XV — RESPONSIVE AND DEVICE BEHAVIOR

## 84. Mobile Use

Operational users may access LunchBox Connect from mobile devices.

Teacher / Nurse / Classroom and Driver / Logistics interfaces are especially operational in nature.

Exact responsive breakpoints, layouts, and mobile interaction rules are:

`NOT_YET_DEFINED`

---

## 85. Native Applications

Native iOS:

`NOT_YET_DEFINED`

Native Android:

`NOT_YET_DEFINED`

Native applications are not a confirmed MVP requirement.

---

# PART XVI — ACCESSIBILITY

## 86. Accessibility Requirements

Exact accessibility standard and implementation requirements are:

`NOT_YET_DEFINED`

Claude Code must not claim compliance with a specific accessibility standard until one is approved and verified.

---

# PART XVII — BRAND / VISUAL DESIGN

## 87. Visual Identity

The exact LunchBox Connect software visual design system is:

`NOT_YET_DEFINED`

This includes:

- logo placement;
- colors;
- typography;
- iconography;
- spacing;
- border radius;
- illustration style;
- chart style.

Claude Code must not invent a permanent brand system within this specification.

---

# PART XVIII — CONFIRMED SCREEN INVENTORY

## 88. Confirmed Screen / Area Inventory

The following screens or functional areas are confirmed at the logical level.

### Super Admin

- Institutions
- Branches where applicable
- Users
- Students
- Classes
- Parents / Guardians
- Allergy / Dietary Administration
- Operational Status / Eligibility
- Institutional Billing
- Menus
- Kitchen Operations
- Deliveries
- Reporting
- System Configuration
- Audit
- Override handling where required

### Nursery / School Admin

- Students
- Classes
- Parents / Guardians
- Institution Staff
- Enrollment / Operational Status
- Allergy / Dietary Information
- Absences where applicable
- Deliveries
- Meal-related Reporting
- Class / Staff Completion Monitoring

### Parent / Guardian

- Own Child / Children
- Menu
- Ingredients
- Allergens
- Nutrition
- Meal Information
- Permitted Meal History / Feedback
- Institution Communication where defined

### Teacher / Nurse / Classroom Staff

- Today / Daily View
- Assigned-Class Students
- Allergy Awareness
- Breakfast Tracking
- Snack Tracking
- Lunch Tracking
- Afternoon Snack Tracking
- Meal Serving
- Meal Outcome / Consumption
- Permitted Notes / Incidents
- Daily Completion

### Kitchen Operations

- Production Demand
- Meals by Institution
- Meals by Class where applicable
- Allergy / Dietary Modifications
- Special Meal Handling
- Preparation Status
- Packing / Labels where defined
- Dispatch Readiness

### Driver / Logistics

- Assigned Deliveries
- Delivery Detail
- Delivery Status
- Delivery Issues / Shortages
- Delivery Confirmation / Handover where defined

### Operations Manager

- Operational Logs
- Operational Issues

### Finance / Owner

- Reports

### Viewer

- Read-only authorized views

No additional screen is automatically approved.

---

# PART XIX — EXPLICIT UI EXCLUSIONS

## 89. Excluded UI in the MVP

The following are not approved:

- parent checkout;
- parent LunchBox Connect payment screens;
- parent LunchBox Connect invoice payment;
- parent LunchBox Connect refund screens;
- live chat;
- loyalty UI;
- referral UI;
- social feed;
- gamification;
- AI assistant UI;
- consumer food-delivery marketplace UI;
- unapproved native-app-only screens;
- unapproved third-party integration screens.

---

# PART XX — UNDEFINED UI DETAILS

## 90. Important UI Details Still Undefined

The following remain intentionally unresolved:

- global navigation labels;
- navigation hierarchy;
- role home screens except established classroom “Today” concept;
- exact page routes;
- exact screen titles;
- dashboard composition;
- card design;
- table design;
- search;
- filters;
- sorting;
- pagination;
- bulk actions;
- exports;
- form fields;
- required fields;
- date pickers;
- time pickers;
- status control designs;
- confirmation dialogs;
- destructive-action dialogs;
- empty states;
- loading states;
- skeleton states;
- error-copy wording;
- success-copy wording;
- responsive breakpoints;
- mobile navigation;
- accessibility standard;
- visual branding;
- iconography;
- notification UI;
- announcement UI;
- attachment UI;
- image upload UI;
- print UI;
- label print UI;
- proof-of-delivery UI;
- audit-detail UI;
- history UI;
- report chart types;
- report export formats.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

# PART XXI — IMPLEMENTATION RULES

## 91. No Screen Invention

Claude Code must not create extra modules or screens simply because they are common in SaaS products.

If a screen is not in this approved inventory or required by another approved specification, it is not approved.

---

## 92. No Unauthorized Controls

The UI must not display actionable controls to roles that are not authorized for those actions.

Exact controls must follow `02_ROLES_AND_PERMISSIONS.md`.

---

## 93. UI Does Not Replace Authorization

A hidden button is not sufficient access control.

Backend authorization must independently enforce permissions.

This file governs interface behavior only.

---

## 94. No Fake Success

The UI must not display success when the underlying action failed, was blocked, or was not saved.

---

## 95. No Fake Data

Claude Code must not populate production screens with invented operational data and present it as real.

Test / demo data must remain clearly separated from production truth.

---

## 96. Undefined UX Must Remain Undefined

When a business or workflow rule is still `NOT_YET_DEFINED`, the UI must not silently hard-code a final interpretation of that rule.

---

## 97. Final UI / UX Rule

LunchBox Connect must present role-specific interfaces over one connected operational system.

Confirmed interface principles are:

- Super Admin has master-control areas.
- Nursery / School Admin is limited to its own institution.
- Parent / Guardian is limited to own child / children.
- Teacher / Nurse / Classroom Staff is limited to assigned class / classes.
- Kitchen is limited to production and required allergy / dietary information.
- Driver is limited to assigned deliveries.
- Finance / Owner is reports only.
- Viewer is read-only.
- Operations Manager has operational logs and issues.
- No live chat.
- No direct parent LunchBox Connect payment UI.
- Classroom users have a daily / “Today” operating concept.
- Classroom meal tracking includes breakfast, snack, lunch, and afternoon snack as previously established.
- Parent-visible free-text classroom notes must not bypass the approved predefined / review rule.
- Screens must use authoritative underlying data rather than independent portal copies.
- Exact layout and unresolved interaction details remain `NOT_YET_DEFINED`.

This document defines the confirmed UI / UX scope only.

It does not authorize Claude Code to invent unapproved screens, actions, navigation, visual design, or business behavior.
