# 07_API_AND_INTEGRATIONS.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed API and integration requirements for the LunchBox Connect MVP.

It establishes:

- which system domains must exchange data;
- which data relationships must be preserved across interfaces;
- what external integrations are currently approved or not approved;
- what Claude Code must not assume.

This document does not define:

- programming language;
- framework;
- REST versus GraphQL;
- endpoint URLs;
- HTTP methods;
- payload schemas;
- authentication tokens;
- webhook formats;
- infrastructure provider;
- database technology.

Anything not previously confirmed is marked:

`NOT_YET_DEFINED`

Claude Code must not invent a permanent API architecture or third-party provider.

---

# PART I — GOVERNING API PRINCIPLES

## 2. One Connected System

LunchBox Connect must operate as one connected institutional child nutrition system.

The confirmed operational chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Any internal API or service boundary must preserve this chain.

---

## 3. Authoritative Data Rule

Internal interfaces must use authoritative underlying records.

An API must not create separate competing versions of:

- student identity;
- student eligibility;
- allergy information;
- dietary restriction information;
- production demand;
- dispatch quantities;
- delivery status;
- classroom meal records;
- parent-visible meal information.

---

## 4. Role Scope Must Survive API Boundaries

The approved permission model must be enforced even when data is accessed through an API or internal service.

Confirmed scope rules:

- Super Admin: system-wide.
- Nursery / School Admin: own institution.
- Parent / Guardian: own child / children.
- Teacher / Nurse / Classroom Staff: assigned class / classes.
- Kitchen Operations: production and required allergy / dietary information.
- Driver / Logistics: assigned deliveries.
- Finance / Owner: reports only.
- Viewer: read-only.
- Operations Manager: operational logs and issues; exact scope not yet defined.

Frontend visibility alone is not sufficient.

---

## 5. No API Permission Bypass

A role that cannot perform an action in the UI must not be able to perform the same action by:

- direct API request;
- direct URL;
- modified client state;
- manually crafted request.

Exact authorization implementation is:

`NOT_YET_DEFINED`

---

# PART II — INTERNAL DOMAIN INTERFACES

## 6. Institution Data Interface

The system must support authorized access to Institution data.

Confirmed consuming domains may include:

- Super Admin;
- Nursery / School Admin;
- Student management;
- Classes;
- Production;
- Delivery;
- Reporting.

Exact API operations are:

`NOT_YET_DEFINED`

---

## 7. Branch Data Interface

Branch data exists where applicable.

Exact branch API behavior is:

`NOT_YET_DEFINED`

because the branch business model is not fully approved.

---

## 8. Student Data Interface

The system must support authorized access to the authoritative Student record.

Confirmed related domains include:

- institution administration;
- class assignment;
- parent / guardian association;
- eligibility;
- allergy information;
- dietary restrictions;
- meal assignment;
- production;
- classroom operations;
- reporting.

Exact operations are:

`NOT_YET_DEFINED`

---

## 9. Class Data Interface

The system must support authorized Class data access.

Confirmed uses include:

- institution operations;
- Teacher / Nurse / Classroom assignment;
- Student grouping;
- Kitchen grouping where applicable;
- Reporting.

Exact API operations are:

`NOT_YET_DEFINED`

---

## 10. Guardian Data Interface

The system must support authorized Parent / Guardian relationships.

Confirmed rule:

A Parent / Guardian may access only their own authorized child / children.

Exact guardian API operations are:

`NOT_YET_DEFINED`

---

## 11. User / Role Data Interface

The system must support Users and approved Roles.

Confirmed role values:

- `SUPER_ADMIN`
- `NURSERY_SCHOOL_ADMIN`
- `OPERATIONS_MANAGER`
- `FINANCE_OWNER`
- `VIEWER`
- `PARENT_GUARDIAN`
- `TEACHER_NURSE_CLASSROOM`
- `KITCHEN_OPERATIONS`
- `DRIVER_LOGISTICS`

Exact user / role API contract is:

`NOT_YET_DEFINED`

---

# PART III — ELIGIBILITY INTERFACE

## 12. Student Eligibility Interface

The system must expose approved Student operational eligibility to downstream authorized domains.

Confirmed eligible status:

`ACTIVE_BILLABLE_TO_NURSERY`

Confirmed downstream consumers include:

- Production;
- Dispatch-related meal demand;
- Delivery-related operations;
- Classroom serving workflow;
- Reporting.

The full status API contract is:

`NOT_YET_DEFINED`

---

## 13. Institutional Billing-to-Eligibility Interface

Institutional billing / enrollment information affects Student operational eligibility.

Confirmed commercial rule:

- Institution pays LunchBox Connect.
- Parent does not pay LunchBox Connect directly.

Exact data exchange between billing and eligibility is:

`NOT_YET_DEFINED`

---

# PART IV — ALLERGY AND DIETARY INTERFACES

## 14. Allergy Data Interface

Approved Student Allergy data must be available to authorized domains that require it.

Confirmed consumers include:

- Super Admin;
- Nursery / School users where authorized;
- Kitchen Operations;
- Teacher / Nurse / Classroom Staff;
- Parent / Guardian for own child where authorized.

Exact fields exposed to each domain are:

`NOT_YET_DEFINED`

---

## 15. Dietary Restriction Interface

Approved Student Dietary Restriction data must be available to authorized domains that require it.

Confirmed consumers include:

- authorized administration;
- Kitchen Operations;
- other authorized child-specific views where defined.

Exact fields are:

`NOT_YET_DEFINED`

---

## 16. No Clinical Logic Invention

The API layer must not invent:

- allergy severity;
- substitution policy;
- clinical escalation;
- medical approval thresholds;
- dietary clinical rules.

Those remain:

`NOT_YET_DEFINED`

until approved.

---

# PART V — MENU AND NUTRITION INTERFACES

## 17. Menu Interface

The system must support structured Menu data as administratively manageable data.

Confirmed related information may include:

- Meals;
- Ingredients;
- Allergens;
- Nutrition information;
- Portion information.

Exact menu API contract is:

`NOT_YET_DEFINED`

---

## 18. Meal Interface

The system must support Meal data for authorized operational use.

Confirmed consumers may include:

- Super Admin;
- Parent / Guardian;
- Kitchen;
- Classroom;
- Reporting.

Exact fields and operations are:

`NOT_YET_DEFINED`

---

## 19. Nutrition Interface

Approved nutrition information may be exposed to authorized users.

Exact nutrition API structure is:

`NOT_YET_DEFINED`

---

# PART VI — MEAL ASSIGNMENT INTERFACE

## 20. Student Meal Assignment Interface

The system must support the approved relationship between Student and applicable Meal / Menu.

Confirmed inputs may include:

- Institution;
- Student;
- Class where applicable;
- eligibility;
- allergy information;
- dietary restriction information;
- approved menu data.

Exact assignment API contract is:

`NOT_YET_DEFINED`

---

# PART VII — ABSENCE INTERFACE

## 21. Student Absence Interface

The system may support Student Absence where applicable to meal operations.

Exact API operations and downstream production effect are:

`NOT_YET_DEFINED`

---

# PART VIII — PRODUCTION INTERFACES

## 22. Production Demand Interface

The system must make authoritative Production Demand available to Kitchen Operations.

Confirmed inputs include:

- eligible Students;
- Institution;
- approved Meal / Menu assignment;
- Allergy information where applicable;
- Dietary Restriction information where applicable.

Exact calculation endpoint or service design is:

`NOT_YET_DEFINED`

---

## 23. Production Record Interface

The system must support Kitchen Production operational records.

Confirmed related information includes:

- production quantities;
- meals by institution;
- meals by class where applicable;
- allergy / dietary modifications;
- special meal handling;
- preparation status;
- packing / labels where defined;
- dispatch readiness.

Exact contract is:

`NOT_YET_DEFINED`

---

## 24. No Independent Production API Truth

Kitchen-facing APIs must not accept manually invented Student totals as the authoritative demand source.

Production demand must remain tied to approved upstream data.

---

# PART IX — PACKING / LABEL INTERFACES

## 25. Packing Interface

Where Packing is implemented, its data must remain tied to Production.

Exact packing API operations are:

`NOT_YET_DEFINED`

---

## 26. Label Interface

Where Meal Labels are implemented, label data must derive from approved Production / Packing information.

Exact label-generation API is:

`NOT_YET_DEFINED`

---

# PART X — DISPATCH INTERFACE

## 27. Dispatch Interface

The system must support Dispatch linked to prepared Production.

Confirmed relationship:

`Production → Dispatch`

Exact dispatch API contract is:

`NOT_YET_DEFINED`

---

# PART XI — DELIVERY / LOGISTICS INTERFACES

## 28. Delivery Interface

The system must support Delivery linked to Dispatch and destination Institution.

Confirmed relationship:

`Dispatch → Delivery → Institution`

Confirmed data concepts may include:

- assigned Driver;
- dispatched quantities;
- delivery status;
- delivery timing;
- issues / shortages;
- confirmation / handover evidence where defined.

Exact API contract is:

`NOT_YET_DEFINED`

---

## 29. Driver Assignment Interface

The system must support Driver assignment to Delivery.

Confirmed access consequence:

Driver / Logistics users may access only assigned deliveries.

Exact assignment contract is:

`NOT_YET_DEFINED`

---

## 30. Delivery Issue Interface

The system may support delivery issue / shortage records.

Exact issue API is:

`NOT_YET_DEFINED`

---

## 31. Delivery Confirmation Interface

The system may support delivery confirmation / handover evidence where defined.

Exact evidence API is:

`NOT_YET_DEFINED`

---

# PART XII — CLASSROOM INTERFACES

## 32. Classroom Daily Data Interface

The system must support the confirmed Teacher / Nurse / Classroom daily / “Today” operational view.

Confirmed data concepts include:

- assigned-class Students;
- allergy awareness;
- breakfast tracking;
- snack tracking;
- lunch tracking;
- afternoon snack tracking;
- meal serving status;
- meal outcome / consumption;
- permitted notes / incidents.

Exact API contract is:

`NOT_YET_DEFINED`

---

## 33. Classroom Meal Record Interface

The system must support Classroom Meal Records tied to:

- correct Student;
- relevant Meal;
- Institution / Class context;
- service date / context.

Exact create / update rules are:

`NOT_YET_DEFINED`

---

## 34. Classroom Notes Interface

Parent-visible classroom notes must obey the approved safe-predefined-status or review rule.

The API must not automatically publish unrestricted free text to parents.

Exact note publication contract is:

`NOT_YET_DEFINED`

---

# PART XIII — PARENT-VISIBLE INTERFACES

## 35. Parent Child Data Interface

The system must expose only authorized child-specific information to Parent / Guardian users.

Confirmed scope:

**Own child / children only.**

---

## 36. Parent Menu / Meal Interface

Confirmed parent-visible information may include:

- child menu;
- ingredients;
- allergens;
- nutrition;
- meal information;
- permitted meal history / feedback;
- institution communication where defined.

Exact parent API contract is:

`NOT_YET_DEFINED`

---

## 37. No Parent Payment API

For the MVP, there must be no LunchBox Connect direct-parent-payment API for:

- checkout;
- card payment;
- direct subscription billing;
- parent invoice payment;
- parent refund.

---

# PART XIV — REPORTING INTERFACES

## 38. Reporting Interface

Reporting must derive from authoritative operational data.

Confirmed report source domains may include:

- Institutions;
- Students;
- eligibility;
- Meals;
- Production;
- Dispatch;
- Delivery;
- Classroom Meal Records;
- institutional operations.

Exact reporting API design is:

`NOT_YET_DEFINED`

---

## 39. Finance / Owner Reporting Access

Finance / Owner is a reports-only role.

Exact report API scope is:

`NOT_YET_DEFINED`

---

## 40. Viewer Read-Only Access

Viewer is read-only.

Any API exposed to Viewer must prohibit modification.

Exact Viewer read scope is:

`NOT_YET_DEFINED`

---

# PART XV — AUDIT / OVERRIDE INTERFACES

## 41. Audit Interface

Important administrative changes are intended to be auditable.

Confirmed audit concepts include:

- previous value;
- new value;
- responsible user;
- timestamp;
- reason where required.

Exact audit API operations are:

`NOT_YET_DEFINED`

---

## 42. Override Interface

Super Admin override authority exists.

Where override handling is required, the API must preserve the distinction between:

- ordinary edit;
- override action.

Exact contract is:

`NOT_YET_DEFINED`

---

# PART XVI — OPERATIONS LOG / ISSUE INTERFACES

## 43. Operational Logs Interface

Operations Manager access includes operational logs.

Exact API contract is:

`NOT_YET_DEFINED`

---

## 44. Operational Issues Interface

Operations Manager access includes operational issues.

Exact API contract is:

`NOT_YET_DEFINED`

---

# PART XVII — EXTERNAL INTEGRATION STATUS

## 45. Payment Gateway

Approved provider:

`NOT_YET_DEFINED`

For the MVP:

- no direct Parent / Guardian LunchBox Connect payment integration is required.

Any institution-side payment-provider integration is:

`NOT_YET_DEFINED`

---

## 46. WhatsApp Integration

Approved provider:

`NOT_YET_DEFINED`

No WhatsApp integration may be assumed.

---

## 47. SMS Integration

Approved provider:

`NOT_YET_DEFINED`

No SMS integration may be assumed.

---

## 48. Email Integration

Approved provider:

`NOT_YET_DEFINED`

No email service provider may be assumed.

---

## 49. Authentication Provider

Approved provider:

`NOT_YET_DEFINED`

No external authentication provider may be assumed.

---

## 50. Analytics Provider

Approved provider:

`NOT_YET_DEFINED`

No analytics provider may be assumed.

---

## 51. Mapping / Routing Provider

Approved provider:

`NOT_YET_DEFINED`

No mapping, GPS, geocoding, or route-optimization provider may be assumed.

---

## 52. External Nutrition Database

Approved provider:

`NOT_YET_DEFINED`

Existing project nutrition documents are reference data.

The system must not automatically fetch or replace nutrition data from an external source unless explicitly approved.

---

## 53. School / Nursery Management System Integration

Approved integration:

`NOT_YET_DEFINED`

No external nursery / school management platform may be assumed.

---

## 54. Accounting Integration

Approved provider:

`NOT_YET_DEFINED`

No accounting-system integration may be assumed.

---

## 55. Push Notification Provider

Approved provider:

`NOT_YET_DEFINED`

Native applications are not a confirmed MVP requirement.

---

# PART XVIII — WEBHOOKS

## 56. Webhook Architecture

Webhook use is:

`NOT_YET_DEFINED`

Claude Code must not create external webhooks as a permanent integration contract unless approved.

---

# PART XIX — INTERNAL API STYLE

## 57. API Style

The following are not yet approved:

- REST;
- GraphQL;
- RPC;
- server actions;
- direct database access pattern;
- event-driven service interfaces.

Status:

`NOT_YET_DEFINED`

---

## 58. API Versioning

API versioning strategy is:

`NOT_YET_DEFINED`

---

## 59. Pagination

API pagination strategy is:

`NOT_YET_DEFINED`

---

## 60. Filtering

API filtering convention is:

`NOT_YET_DEFINED`

---

## 61. Sorting

API sorting convention is:

`NOT_YET_DEFINED`

---

## 62. Idempotency

Idempotency requirements are:

`NOT_YET_DEFINED`

---

## 63. Rate Limiting

Rate-limiting rules are:

`NOT_YET_DEFINED`

---

# PART XX — API ERROR BEHAVIOR

## 64. Failed Actions

Confirmed rule:

A failed operation must not be represented as successful.

API behavior must distinguish between:

- success;
- failure;
- blocked action;
- invalid request;
- missing required data;
- unauthorized action.

Exact error schema is:

`NOT_YET_DEFINED`

---

## 65. Unauthorized Access

An API request outside a user's approved role scope must not return or modify unauthorized business data.

Exact status-code convention is:

`NOT_YET_DEFINED`

---

# PART XXI — DATA CONSISTENCY ACROSS INTERFACES

## 66. Student Consistency

All interfaces must refer to the same authoritative Student record.

---

## 67. Eligibility Consistency

All downstream domains must use the authoritative Student eligibility state.

---

## 68. Allergy Consistency

Kitchen, Classroom, Parent, and Admin views must derive permitted allergy information from authoritative Student Allergy data.

---

## 69. Production Consistency

Production APIs must derive demand from authoritative upstream business records.

---

## 70. Dispatch Consistency

Dispatch must relate to actual Production.

---

## 71. Delivery Consistency

Delivery must relate to Dispatch.

---

## 72. Classroom Consistency

Classroom Meal Records must relate to the correct Student and Meal.

---

## 73. Parent Consistency

Parent-visible data must derive from approved underlying operational data.

---

## 74. Reporting Consistency

Reporting must derive from authoritative operational records.

---

# PART XXII — API SECURITY BOUNDARIES

## 75. Parent Boundary

Parent / Guardian API access is limited to own child / children.

---

## 76. Nursery Boundary

Nursery / School Admin API access is limited to own Institution.

---

## 77. Classroom Boundary

Teacher / Nurse / Classroom API access is limited to assigned Class / Classes.

---

## 78. Kitchen Boundary

Kitchen API access is limited to production and required allergy / dietary data.

---

## 79. Driver Boundary

Driver API access is limited to assigned Deliveries.

---

## 80. Finance Boundary

Finance / Owner API access is reports only.

---

## 81. Viewer Boundary

Viewer API access is read-only.

---

# PART XXIII — EXCLUDED INTEGRATIONS / CONTRACTS

## 82. Not Approved for MVP

The following integration domains are not automatically approved:

- parent payment gateway;
- consumer marketplace integrations;
- loyalty providers;
- referral providers;
- social-network integrations;
- AI provider integration;
- native-app push infrastructure;
- unapproved CRM integrations;
- unapproved accounting integrations;
- unapproved logistics integrations;
- unapproved medical systems.

Each remains:

`NOT_YET_DEFINED`

unless explicitly approved later.

---

# PART XXIV — UNDEFINED API DETAILS

## 83. Important API Details Still Undefined

The following remain intentionally unresolved:

- API architectural style;
- transport protocol;
- endpoint naming;
- request payloads;
- response payloads;
- authentication mechanism;
- token format;
- session handling;
- API versioning;
- rate limits;
- pagination;
- filtering;
- sorting;
- idempotency;
- retries;
- webhook design;
- event bus;
- queue provider;
- background job provider;
- integration credentials;
- external providers;
- API logging;
- observability;
- API documentation format;
- schema-generation tooling;
- error-code catalog;
- file-upload API;
- image-upload API;
- label-print integration;
- proof-of-delivery upload contract;
- export API;
- notification API.

Each remains:

`NOT_YET_DEFINED`

until explicitly approved.

---

# PART XXV — IMPLEMENTATION RULES

## 84. No Provider Invention

Claude Code must not choose a third-party provider merely because it is common, inexpensive, or convenient.

If a provider is not approved, it remains:

`NOT_YET_DEFINED`

---

## 85. No Hidden Integration

Claude Code must not add external integrations without explicit approval.

---

## 86. No Parent Payment Integration

Claude Code must not add direct Parent / Guardian payment APIs to LunchBox Connect in the MVP.

---

## 87. No API Scope Expansion

Claude Code must not expose data to a role merely because that data is already returned by another internal service.

The response must be scoped to approved permissions.

---

## 88. No Business Rule Invention in API Layer

The API layer must not silently create business behavior that is absent from approved specifications.

---

## 89. Final API / Integration Rule

LunchBox Connect internal interfaces must preserve the confirmed operating chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Confirmed integration facts are:

- no external provider has yet been approved;
- no direct Parent / Guardian LunchBox Connect payment integration exists in the MVP;
- APIs must respect role scope;
- APIs must use authoritative records;
- Production derives from approved upstream data;
- Dispatch derives from Production;
- Delivery derives from Dispatch;
- Classroom records relate to the correct Student and Meal;
- Parent-visible information derives from authorized underlying data;
- Reporting derives from authoritative operational records.

All exact API design choices and external provider decisions remain:

`NOT_YET_DEFINED`

This document does not authorize Claude Code to invent permanent API architecture or third-party integrations.

---

## Lifecycle Functions and Privileged Endpoints (added 2026-08-23)

### Database functions (`security definer`, executable by `authenticated`)

| function | authority | refuses |
|---|---|---|
| `set_user_active(p_user, p_active, p_reason)` | `app_may_manage_account()` | deactivating yourself; deactivating the last active Super Admin |
| `update_user_profile(p_user, p_full_name, p_phone)` | your own row while active, or `app_may_manage_account()` | an empty name; a deactivated caller; another person's row |
| `set_institution_active(p_inst, p_active, p_reason)` | Super Admin only | archiving over meal service published for today or later |
| `set_class_active(p_class, p_active, p_reason)` | `app_can_manage_institution()` of the class's institution | archiving while students or staff remain |
| `revoke_guardian_access(p_student, p_user, p_reason)` | Super Admin only | a missing reason; a link that does not exist |

Each writes its own `audit_log` row inside the same transaction as the change
it describes. `update_user_profile` deliberately takes **no email argument**
(Decision 038).

### Edge Functions

All three hold the service-role key inside the Deno environment and **never**
expose it to a browser.

| function | what it does | how it authorises |
|---|---|---|
| `admin-create-user` | creates the Auth user and the `app_users` row atomically | reads the caller's JWT; Super Admin any role, Institution Admin only `classroom_staff` of their own institution |
| `admin-set-password` | `auth.admin.updateUserById({ password })`, then an audit row recording that it happened | same rule, re-expressed; refuses a deactivated caller |
| `admin-set-active` | calls `set_user_active` **with the caller's own JWT**, then bans or unbans the Auth account | the DATABASE decides; the function only adds the Auth half |

`admin-set-active` is the pattern to follow for any future privileged action:
the authorization decision, the audit row and the transactional cleanup all
stay in the database, where they are tested. Re-deciding the rule in TypeScript
would create a second, weaker copy that could drift from the real one.

A non-2xx from any of them carries the human-readable refusal in the RESPONSE
BODY. supabase-js reports only "Edge Function returned a non-2xx status code"
in `error.message`, so the client reads the body (`invokeFunction` in
`src/lib/api.ts`) or every server-side refusal reaches the operator as that one
useless sentence.

### Client self-service

Changing your own password is `supabase.auth.updateUser({ password })` on the
caller's own session. No privileged key, no Edge Function, available to every
role.
