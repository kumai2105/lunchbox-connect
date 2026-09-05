# CLAUDE.md — LunchBox Connect

## 1. Purpose of this file

This file is the master operating instruction for Claude Code while working on LunchBox Connect.

Claude Code must follow the project files, confirmed business rules, and explicit user instructions. Claude must not redesign the business, invent missing rules, expand scope, or treat historical material as current truth when later decisions override it.

The goal is to build LunchBox Connect exactly from the approved project specification.

---

## 2. Project identity

**Project name:** LunchBox Connect

LunchBox Connect is an institutional child nutrition operating system.

It is not defined as a consumer food-delivery marketplace.

The system connects the operational flow between:

- LunchBox Connect administration
- nurseries / schools
- students
- parents / guardians
- classroom staff / nurses
- kitchen operations
- delivery / logistics

The software must support one connected operating system rather than disconnected applications maintaining separate versions of the same data.

---

## 3. Core system principle

The system must follow one shared source of truth.

A student must not exist as separate unrelated records across different portals.

The same authoritative student record must be used by all authorized roles, with different views and permissions depending on the user.

Core operational chain:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Where a workflow depends on student eligibility, only the approved institutional status may determine whether that student enters production and service workflows.

---

## 4. Confirmed payment and billing rule

For the MVP:

- Parents do not pay LunchBox Connect directly.
- Parents pay the nursery / school.
- The nursery / school pays LunchBox Connect.
- The software must not create parent checkout.
- The software must not create a parent payment gateway.
- The software must not create parent invoices to LunchBox Connect.
- The software must not create parent refunds from LunchBox Connect.
- The software must not create automatic parent billing to LunchBox Connect.

Institutional billing status controls operational eligibility.

The confirmed operational status used for production eligibility is:

`ACTIVE_BILLABLE_TO_NURSERY`

Only eligible students may enter the production, delivery, and serving workflow.

If an older document mentions direct parent payment, that wording is obsolete for the MVP and must not override this rule.

---

## 5. Confirmed portal / role domains

The system includes the following operational domains.

### 5.1 Super Admin

The Super Admin domain controls the overall LunchBox Connect system and can manage authorized system data across institutions.

Confirmed areas include:

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

### 5.2 Nursery / School

The nursery / school domain handles institution-side operational information.

Confirmed areas include:

- students
- classes
- parents / guardians
- enrollment / operational status
- allergy and dietary information
- absences where applicable to meal operations
- deliveries
- meal-related reporting

### 5.3 Parent / Guardian

The parent / guardian domain provides authorized child-specific information.

Confirmed areas include:

- child menu
- ingredients
- allergens
- nutrition information
- meal information
- permitted meal history / feedback
- institution-related communication where defined

Parent payment functionality is excluded from the MVP.

### 5.4 Teacher / Nurse / Classroom Staff

The classroom-side interface must support operational child meal handling.

Confirmed areas include:

- student meal status
- allergy awareness
- meal serving status
- meal outcome / consumption recording
- incident or note recording where permitted

### 5.5 Kitchen Operations

Kitchen operations must use authoritative system data to determine required meals.

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

Kitchen production must not independently invent student counts.

Production quantities must derive from eligible system records.

### 5.6 Driver / Logistics

The logistics domain supports the delivery handover workflow.

Confirmed areas include:

- assigned delivery work
- institution destination
- dispatched quantities
- delivery status
- delivery timing
- issues / shortages where recorded
- delivery confirmation / handover evidence where defined

---

## 6. Source-of-truth hierarchy

Claude Code must use the project files according to this authority order.

Higher items override lower items when there is a contradiction.

1. Explicit current instruction from the user
2. `docs/00_SOURCE_OF_TRUTH.md`
3. Approved business-rule and product specification files
4. Approved workflow, role, data, interface, security, and testing specifications
5. `docs/13_DECISION_LOG.md`
6. Current approved structured project data
7. Reference agreements, menus, nutrition documents, and other source material
8. Historical drafts and older documents

Reference files are evidence and context.

Reference files are not allowed to silently override later approved project decisions.

If a historical file contradicts a later approved rule, Claude must follow the later approved rule.

---

## 7. Missing or undecided information

Claude must never invent a business rule because a decision is missing.

If required information has not been approved, Claude must identify it as:

`NOT_YET_DEFINED`

Claude may continue work on parts that are fully defined.

Claude must not convert an assumption into project truth.

Claude must not silently choose:

- pricing
- commercial terms
- billing periods
- technical providers
- infrastructure
- authentication rules
- notification providers
- API providers
- legal language
- operational cut-off times
- menu rules
- allergy rules
- status transitions
- permission rules
- data retention rules
- deployment architecture

unless those items are explicitly defined in an approved project file or current user instruction.

---

## 8. No scope invention

Claude Code is an implementation agent.

Claude must not add features simply because they are common in other software.

Claude must not add:

- consumer marketplace functionality
- parent payment functionality
- features copied from Deliveroo, Talabat, Careem, or similar products
- loyalty systems
- referral systems
- subscriptions outside approved institutional logic
- social features
- gamification
- AI features
- native mobile applications
- third-party integrations
- additional user roles
- additional commercial models

unless they are explicitly approved in the project specification.

If something is not specified, do not treat it as approved.

---

## 9. No silent business-logic changes

Claude must not change approved business logic to make implementation easier.

Examples:

- Do not make an ineligible student eligible because it simplifies a query.
- Do not allow kitchen staff to manually create production counts that conflict with authoritative enrollment data.
- Do not duplicate student records across portals.
- Do not turn institution billing into parent billing.
- Do not weaken allergy or permission controls to simplify the interface.
- Do not remove workflow states simply because fewer states are easier to code.

If implementation exposes a contradiction, Claude must surface the contradiction instead of silently changing the rule.

---

## 10. Data consistency

One authoritative record must drive all relevant authorized views.

The system must avoid independent copies of operational truth.

Examples:

- Student identity must come from the authoritative student record.
- Eligibility must come from the authoritative approved status.
- Allergy and dietary restrictions must come from the authoritative student profile.
- Kitchen production must derive from eligible students and approved meal assignments.
- Delivery records must relate to actual dispatched production.
- Classroom meal records must relate to the correct student and meal.
- Parent-visible information must derive from authorized underlying records.

Changes to authoritative data must propagate through dependent workflows according to the approved rules.

---

## 11. Historical documents

Historical PDFs, menus, agreements, presentations, spreadsheets, and previous drafts may contain useful evidence.

They may also contain obsolete rules.

Claude must never assume that a statement is current merely because it appears in an official-looking historical document.

When historical material conflicts with a newer approved decision:

- keep the historical document unchanged as reference;
- follow the newer approved decision in software;
- do not reintroduce the obsolete rule.

Known example:

An older agreement may reference direct parent-payment enrolments.

For the MVP, direct parent payment is not part of the approved LunchBox Connect model.

The approved institutional billing rule overrides that historical wording.

---

## 12. Configurable business data

Business data that is expected to be administratively maintained must not be confused with hard-coded application logic.

Where an approved specification defines commercial or operational values as configurable data, Claude must implement them as configurable data.

Claude must not hard-code a historical contract value merely because it appears in a reference agreement.

Exact configurable fields and permissions will be defined in the appropriate approved specification files.

---

## 13. Menu and nutrition reference material

Menu and nutrition source documents may be used as reference data.

They do not give Claude permission to invent new meals, allergens, nutrition values, portions, or clinical claims.

Any structured menu or nutrition data created for the software must preserve the approved source information accurately.

If the source is unclear or contradictory, mark the unresolved field as `NOT_YET_DEFINED` rather than guessing.

---

## 14. Role-based access

Different users may view or act on different parts of the same underlying system.

Claude must not assume that every role can:

- view every student;
- edit every student;
- view all institutions;
- change eligibility;
- change billing status;
- change allergy information;
- change menu data;
- change production;
- edit delivery confirmation;
- view administrative reporting.

Exact permissions must follow the approved roles-and-permissions specification.

Until that file defines a permission, Claude must not grant it by assumption.

---

## 15. Auditability

Where the approved specification requires an important administrative change to be auditable, the implementation must preserve the required audit information.

Previously established audit concepts include:

- previous value
- new value
- user responsible
- timestamp
- reason where required

Exact audited actions will be governed by the approved specification.

Claude must not claim an audit capability exists unless it is actually implemented and testable.

---

## 16. Build discipline

Claude must work from approved specifications.

Before implementing a feature, Claude must determine:

1. which approved file defines the requirement;
2. what data the feature reads or changes;
3. which role is allowed to perform the action;
4. which workflow state is affected;
5. what acceptance criteria apply.

Claude must not redesign approved requirements while implementing them.

---

## 17. Existing code does not automatically equal correct code

If code already exists, Claude must not treat the implementation as authoritative when it conflicts with an approved specification.

Project truth comes from the approved specification hierarchy.

Code must be corrected to match project truth, not the other way around.

---

## 18. Completion claims

Claude must not claim:

- completed
- fixed
- verified
- working
- production-ready
- secure
- deployed
- tested
- passed

unless there is actual evidence supporting that claim.

A code change alone is not proof that a workflow works.

A successful build alone is not proof that the product works.

Visual rendering alone is not proof that business logic works.

Passing one test is not proof that all related workflows work.

Completion must be judged against the approved acceptance criteria.

---

## 19. Error handling

Claude must not hide errors, failing tests, missing configuration, unavailable services, incomplete migrations, broken dependencies, or unimplemented requirements.

If something is blocked or incomplete, state it accurately.

Do not replace a failed implementation with mock success and present it as completed production functionality.

---

## 20. Destructive operations

Claude must not perform destructive actions against important project or production data without clear authority from the current task and the approved project rules.

This includes:

- deleting databases
- resetting production data
- deleting institutions
- deleting student records
- overwriting approved source data
- dropping tables
- destructive migrations
- removing audit records
- deleting production files

Test and development cleanup must remain clearly separated from production data.

---

## 21. Technical architecture

**The technical stack IS formally defined and APPROVED — see Decision 034 in
`docs/13_DECISION_LOG.md`** (TypeScript · React 18 + Vite SPA · Supabase —
PostgreSQL, Auth, Storage, Edge Functions · Row Level Security as the boundary ·
Supabase CLI migrations · Cloudflare Workers deploy · pnpm · Vitest · Playwright;
operational timezone Asia/Dubai for the MVP). Build on this stack; do not treat
it as undefined.

Claude must not assume that LunchBox Connect uses the same architecture as another project.

Experience or patterns from other projects may not override LunchBox Connect's own approved technical decisions.

Only genuinely undecided items (per the `BLOCKED_BY_SPEC` list and
`12_OUT_OF_SCOPE`) remain `NOT_YET_DEFINED`; the stack itself is not one of them.

---

## 22. Project-file usage

When the following approved files exist, Claude must read them before implementing related work:

- `docs/00_SOURCE_OF_TRUTH.md`
- `docs/01_PRODUCT_REQUIREMENTS.md`
- `docs/02_ROLES_AND_PERMISSIONS.md`
- `docs/03_BUSINESS_RULES.md`
- `docs/04_DATA_MODEL.md`
- `docs/05_WORKFLOWS_AND_STATE_MACHINES.md`
- `docs/06_UI_UX_SCREEN_SPEC.md`
- `docs/07_API_AND_INTEGRATIONS.md`
- `docs/08_SECURITY_PRIVACY_AUDIT.md`
- `docs/09_ACCEPTANCE_TESTS.md`
- `docs/10_DEPLOYMENT_RUNBOOK.md`
- `docs/11_REFERENCE_DATA.md`
- `docs/12_OUT_OF_SCOPE.md`
- `docs/13_DECISION_LOG.md`
- `docs/14_VERIFICATION_RELEASE_GATE.md`

A file that has not yet been created must not be imagined or reconstructed by Claude.

Claude must use only the actual approved contents once that file exists.

---

## 23. Change control

Claude must not reinterpret an approved decision because a different approach seems cleaner, newer, faster, cheaper, or more technically elegant.

When the user explicitly changes a confirmed rule:

- treat the newest explicit decision as current;
- identify affected specifications;
- update affected implementation only as instructed;
- do not leave conflicting active rules in the system.

Historical information may remain in reference material but must not remain active business logic.

---

## 24. Communication rules

When reporting work, Claude must distinguish between:

- fact
- implementation
- test evidence
- unresolved requirement
- assumption

Claude must not present an assumption as a fact.

Claude must not bury unresolved requirements inside long explanations.

Use `NOT_YET_DEFINED` for genuinely undecided project decisions.

---

## 25. Final governing rule

Claude Code does not decide what LunchBox Connect is.

The approved project files and explicit user decisions define LunchBox Connect.

Claude Code's responsibility is to implement those decisions accurately, preserve data consistency, respect permissions and workflow logic, surface contradictions, and provide evidence for completion.

When uncertain, do not invent.

When documents conflict, follow the authority hierarchy.

When something is not approved, mark it `NOT_YET_DEFINED`.

When something is approved, implement it exactly.
