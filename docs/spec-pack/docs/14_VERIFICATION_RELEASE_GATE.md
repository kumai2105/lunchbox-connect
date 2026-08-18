# 14_VERIFICATION_RELEASE_GATE.md — LunchBox Connect

## 1. Purpose

This document defines the independent technical verification and final release-gate process for LunchBox Connect.

Its purpose is to prevent:

- unsupported completion claims;
- hidden failures;
- specification drift;
- untested workflows;
- permission leaks;
- destructive release mistakes;
- approval based only on the implementation agent's own statement.

---

## 2. Separation of Responsibilities

The build process uses two distinct technical functions:

### A. Independent Technical Verification Engineer

Execution and evidence layer.

Responsibilities:

- inspect actual code and configuration;
- run actual builds;
- run actual tests;
- inspect migrations;
- inspect relevant data state;
- test permissions;
- test workflows;
- verify deployment where applicable;
- produce evidence;
- identify failures and unresolved items.

### B. Independent Technical Assurance & Release Director

Final release gate with veto authority.

Responsibilities:

- evaluate the verifier's evidence;
- compare implementation against approved specification;
- reject unsupported claims;
- block incomplete or unsafe release;
- approve only when required evidence is sufficient.

The implementation agent does not grant itself final approval.

---

## 3. Source of Truth for Verification

Verification must use:

- `CLAUDE.md`;
- `00_SOURCE_OF_TRUTH.md`;
- `01_PRODUCT_REQUIREMENTS.md`;
- `02_ROLES_AND_PERMISSIONS.md`;
- `03_BUSINESS_RULES.md`;
- `04_DATA_MODEL.md`;
- `05_WORKFLOWS_AND_STATE_MACHINES.md`;
- `06_UI_UX_SCREEN_SPEC.md`;
- `07_API_AND_INTEGRATIONS.md`;
- `08_SECURITY_PRIVACY_AUDIT.md`;
- `09_ACCEPTANCE_TESTS.md`;
- `10_DEPLOYMENT_RUNBOOK.md`;
- `11_REFERENCE_DATA.md`;
- `12_OUT_OF_SCOPE.md`;
- `13_DECISION_LOG.md`.

Reference PDFs do not override the approved specification hierarchy.

---

## 4. Verifier Independence Rule

The verifier must not accept statements such as:

- “I fixed it”;
- “this should work”;
- “the build is clean”;
- “permissions are secure”;
- “production-ready”;

without independent evidence.

---

## 5. Verifier Must Use Actual Tools

Where the environment provides tooling, the verifier must use it.

Examples, once the stack exists:

- inspect files;
- inspect dependency definitions;
- run build;
- run tests;
- run type checks;
- run migrations against approved test environment;
- make authenticated role requests;
- inspect actual returned data;
- inspect actual deployed environment;
- inspect logs where required.

Exact commands remain:

`NOT_YET_DEFINED`

until the technical stack is approved.

---

## 6. Specification Drift Check

Before release approval, verifier must compare implementation against approved scope.

Verifier must identify:

- missing approved requirements;
- unapproved added features;
- invented business rules;
- obsolete historical rules reintroduced into code;
- mismatches between role permissions and implementation.

---

## 7. Parent-Payment Gate

Automatic failure if the MVP includes unapproved direct Parent LunchBox Connect:

- checkout;
- payment;
- invoices;
- refunds;
- direct subscription billing.

Current required commercial model:

**Institution pays LunchBox Connect.**

---

## 8. Role-Isolation Gate

Verifier must prove at minimum:

### Nursery Isolation

Nursery Admin A cannot access Institution B.

### Parent Isolation

Parent A cannot access unrelated Student B.

### Classroom Isolation

Classroom User A cannot access an unassigned Class.

### Driver Isolation

Driver A cannot access an unassigned Delivery.

### Kitchen Minimization

Kitchen cannot access unnecessary Parent / financial data.

### Finance Restriction

Finance / Owner cannot perform operational writes.

### Viewer Restriction

Viewer cannot perform writes.

These checks must include backend/direct-request attempts, not only visual UI inspection.

---

## 9. Eligibility Gate

Verifier must confirm implementation respects:

`ACTIVE_BILLABLE_TO_NURSERY`

as an approved eligible state.

Exact full status transitions remain:

`NOT_YET_DEFINED`

until approved.

Verifier must reject any implementation that invents a permanent status model and presents it as approved.

---

## 10. Production Gate

Verifier must prove:

- Production Demand uses authoritative upstream data;
- Kitchen cannot independently invent authoritative Student totals;
- Kitchen cannot change Student eligibility merely to alter Production;
- Production remains traceable to approved inputs.

Exact Production formula may remain `BLOCKED_BY_SPEC` until defined.

---

## 11. Dispatch Gate

Verifier must prove Dispatch relates to actual Production.

Exact Dispatch state machine remains:

`NOT_YET_DEFINED`

until approved.

---

## 12. Delivery Gate

Verifier must prove:

- Delivery relates to Dispatch;
- Delivery identifies the correct Institution;
- Driver access is assignment-scoped;
- Delivery does not become an unrelated quantity truth.

Exact Delivery state machine remains undefined until approved.

---

## 13. Classroom Gate

Verifier must prove:

- Classroom user is Class-scoped;
- meal records relate to correct Student and Meal;
- approved meal-period concepts can be represented;
- unauthorized users cannot alter classroom records.

Exact Meal Outcome values remain:

`NOT_YET_DEFINED`

---

## 14. Parent Visibility Gate

Verifier must prove:

- Parent sees only own child / children;
- Parent-visible operational information comes from authoritative records;
- unrestricted classroom free text does not automatically become Parent-visible;
- no direct Parent LunchBox Connect payment flow exists.

---

## 15. Allergy / Dietary Gate

Verifier must prove:

- Allergy / Dietary data uses authoritative Student relationship;
- Kitchen receives required permitted information;
- Classroom receives required permitted awareness;
- unauthorized roles cannot use Super Admin approval authority.

Exact field-level visibility may remain `BLOCKED_BY_SPEC` until defined.

---

## 16. Reporting Gate

Verifier must prove reports derive from authoritative operational data rather than a separate independent truth.

Exact KPIs remain:

`NOT_YET_DEFINED`

until approved.

---

## 17. Audit Gate

For actions later defined as auditable, verifier must prove required Audit concepts are captured:

- previous value;
- new value;
- responsible User;
- timestamp;
- reason where required.

Exact event list remains:

`NOT_YET_DEFINED`

---

## 18. Failure-Handling Gate

Verifier must intentionally exercise failure paths.

At minimum, verify:

- unauthorized write does not save;
- failed write does not show success;
- invalid transition does not silently complete where transition rules exist;
- missing required data is not silently treated as complete where required fields are defined.

---

## 19. Data-Safety Gate

Verifier must identify destructive behavior including:

- database resets;
- destructive migrations;
- automatic data deletion;
- test cleanup touching production;
- Audit Record removal;
- unsafe seed behavior.

Any unapproved destructive production behavior blocks release.

---

## 20. Demo / Reference Data Gate

Verifier must ensure:

- test data is not represented as real production data;
- `seed/menu-data.json` is not treated as final approved production Menu data;
- approximate Nurse Review Draft Nutrition values are not represented as officially validated Nutrition values.

---

## 21. Build Gate

Once stack exists:

Required build command:

`NOT_YET_DEFINED`

The verifier must execute the actual build.

A release with a failing required build is:

`REJECTED`

---

## 22. Automated Test Gate

Test framework / command:

`NOT_YET_DEFINED`

Once approved, required automated tests must be executed.

A required failing test is:

`REJECTED`

---

## 23. Migration Gate

Migration system:

`NOT_YET_DEFINED`

Once approved, the verifier must inspect and execute migrations in the appropriate approved environment before production approval.

Known migration failure blocks release.

---

## 24. Deployment Gate

Production environment:

`NOT_YET_DEFINED`

Once approved, verifier must prove that the intended version is actually deployed to the intended environment.

Local code does not prove deployment.

---

## 25. Live Verification Gate

Once production exists, verifier must test the live deployment rather than infer live behavior from local code.

Exact live test method depends on approved architecture.

---

## 26. Acceptance-Test Mapping

The verifier must use `09_ACCEPTANCE_TESTS.md`.

Every required applicable acceptance test must have one result:

- `PASS`
- `FAIL`
- `BLOCKED_BY_SPEC`
- `BLOCKED_BY_ENVIRONMENT`
- `NOT_RUN`

No missing test may be silently treated as passed.

---

## 27. Evidence Record

For each verified claim, record:

- requirement / test ID;
- action performed;
- environment;
- evidence;
- actual result;
- expected result;
- status;
- defect reference if failed.

Exact report format may be adapted to the future tool environment.

---

## 28. Release Director Decision Values

The Release Director may issue:

### `APPROVED`

All required applicable gates pass with sufficient evidence.

### `REJECTED`

One or more required gates fail or evidence contradicts approval.

### `BLOCKED_BY_SPEC`

A required business decision is undefined and prevents correct final verification.

### `BLOCKED_BY_ENVIRONMENT`

Required environment/tool/service prevents verification.

The Director must not convert a blocker into approval merely to finish the task.

---

## 29. Release Director Veto

The Independent Technical Assurance & Release Director has veto authority over release when:

- evidence is missing;
- evidence is contradictory;
- a required test failed;
- source of truth was violated;
- permissions are insecure;
- undefined rules were invented;
- destructive behavior is unresolved;
- deployment is not actually verified.

---

## 30. No Self-Certification

The implementation agent's claim of completion is evidence of what it says, not evidence that the system works.

Independent verification is required.

---

## 31. Automatic Rejection Conditions

Release must be rejected if any of the following is confirmed:

- cross-Institution access leak;
- cross-child Parent access leak;
- cross-Class classroom access leak;
- cross-Delivery Driver access leak;
- Kitchen can modify Student eligibility;
- direct Parent LunchBox Connect payment exists without approved scope change;
- failed actions are shown as successful;
- reference/demo Menu data is presented as approved production truth;
- required applicable acceptance test fails;
- actual deployed version cannot be proven where deployment is claimed;
- known destructive data behavior remains unresolved;
- implementation contradicts current Source of Truth.

---

## 32. Undefined Requirements

A specification gap is not permission to improvise.

If required behavior is genuinely undefined:

- verifier records `BLOCKED_BY_SPEC`;
- Release Director does not approve that unresolved portion;
- Claude Code does not invent a rule.

---

## 33. Final Release Rule

LunchBox Connect is ready for release only when the implementation is proven against the approved project truth.

The sequence is:

**Implementation → Independent Verification → Evidence → Release Director Review → Approval or Veto**

No shortcut replaces evidence.
