# 08_SECURITY_PRIVACY_AUDIT.md — LunchBox Connect

## 1. Purpose

This document defines the confirmed security, privacy, access-control, and audit requirements for the LunchBox Connect MVP.

It records only requirements already established by the project.

It does not invent:

- an authentication provider;
- password policy;
- encryption standard;
- hosting provider;
- retention period;
- backup frequency;
- privacy-law interpretation;
- incident-response timing;
- security certification.

Anything not already confirmed is marked:

`NOT_YET_DEFINED`

---

## 2. Data Sensitivity

LunchBox Connect handles child-related operational information.

Confirmed sensitive operational information includes:

- Student identity;
- Institution and Class association;
- Parent / Guardian association;
- Allergy information;
- Dietary restriction information;
- meal-related information;
- serving / consumption information;
- permitted incidents / notes;
- institutional billing / eligibility information;
- operational logs and audit information.

Access to this information must follow approved role scope.

---

## 3. Governing Access Principle

Confirmed rule:

**No unnecessary access.**

A user must only access information required by the user's approved role and scope.

The interface and backend must both enforce the approved access model.

Hiding a button is not sufficient access control.

---

## 4. Confirmed Access Boundaries

### Super Admin

System-wide authorized access.

### Nursery / School Admin

Own Institution only.

### Parent / Guardian

Own authorized child / children only.

### Teacher / Nurse / Classroom Staff

Assigned Class / Classes only.

### Kitchen Operations

Production information and required Allergy / Dietary information only.

### Driver / Logistics

Assigned Deliveries only.

### Finance / Owner

Reports only.

### Viewer

Read-only.

### Operations Manager

Operational Logs and Operational Issues; exact organizational scope remains:

`NOT_YET_DEFINED`

---

## 5. Cross-Institution Isolation

Nursery / School Admin users must not access unrelated Institutions.

They must not access unrelated:

- Students;
- Classes;
- Guardians;
- Staff;
- institution-specific reports;
- institution-specific operational records.

Exact technical tenant-isolation method is:

`NOT_YET_DEFINED`

The isolation requirement itself is confirmed.

---

## 6. Parent Data Isolation

A Parent / Guardian must not access another family's child.

Parent access must be restricted to approved own-child relationships.

A Parent must not access another child's:

- profile;
- Allergy information;
- Dietary Restriction information;
- meal history;
- classroom meal records;
- Guardian information.

Exact Guardian-association verification method is:

`NOT_YET_DEFINED`

---

## 7. Classroom Data Isolation

Teacher / Nurse / Classroom Staff access is restricted to assigned Class / Classes.

Classroom users must not automatically receive Institution-wide Student access.

Exact assignment enforcement mechanism is:

`NOT_YET_DEFINED`

---

## 8. Kitchen Data Minimization

Kitchen users must receive only the information required for approved meal production and safe meal handling.

Kitchen access may include:

- Production Demand;
- Meal / Menu information;
- Institution grouping;
- Class grouping where applicable;
- required Allergy information;
- required Dietary Restriction information;
- Special Meal information;
- Packing / Label information where defined;
- Dispatch readiness.

Kitchen must not automatically receive:

- full Parent / Guardian records;
- unrelated Student profile information;
- institutional financial reporting;
- Parent payment information;
- system configuration.

Exact Kitchen-visible Student-identifying fields are:

`NOT_YET_DEFINED`

---

## 9. Driver Data Minimization

Drivers may access only assigned Deliveries.

Driver access may include the information required to complete an assigned Delivery.

Drivers must not automatically receive:

- complete Student records;
- Parent / Guardian records;
- unrelated Deliveries;
- institutional billing information;
- Menu administration;
- Allergy approval controls;
- system configuration.

Exact Driver-visible Student information, if any, is:

`NOT_YET_DEFINED`

---

## 10. Finance / Owner Restriction

Finance / Owner is a reports-only role.

This role must not gain operational editing rights through reporting access.

---

## 11. Viewer Restriction

Viewer is read-only.

Viewer must not be able to:

- create;
- edit;
- delete;
- approve;
- override;
- publish;
- change status;
- change billing eligibility.

Exact Viewer data scope remains:

`NOT_YET_DEFINED`

---

## 12. Backend Authorization Requirement

Permission enforcement must exist beyond the frontend.

Unauthorized actions must remain blocked when attempted through:

- direct request;
- direct URL;
- manipulated browser state;
- manually crafted API request.

Exact backend authorization implementation is:

`NOT_YET_DEFINED`

---

## 13. Authentication

The authentication method is:

`NOT_YET_DEFINED`

No provider is approved.

The following remain undefined:

- login identifier;
- password requirements;
- password recovery;
- MFA;
- session duration;
- session renewal;
- account lockout;
- invitation flow;
- authentication provider.

Claude Code must not present any of these as approved policy until defined.

---

## 14. User Lifecycle

The exact lifecycle for:

- account creation;
- invitation;
- activation;
- deactivation;
- reactivation;
- account recovery;
- role change;
- scope change

is:

`NOT_YET_DEFINED`

---

## 15. Allergy / Dietary Data Protection

Allergy and Dietary Restriction information is operationally significant.

Confirmed rules:

- it belongs to the authoritative Student profile;
- only authorized roles may access it;
- Kitchen receives required information for meal preparation;
- Classroom users receive required awareness for assigned Students;
- Allergy approvals are centrally managed under Super Admin authority.

Exact approval security controls are:

`NOT_YET_DEFINED`

---

## 16. Parent-Visible Classroom Notes

Confirmed protection rule:

Unrestricted free-text classroom notes must not automatically become Parent-visible.

Parent-visible notes must use either:

- safe predefined status; or
- review before publication.

Exact reviewer and publication security workflow are:

`NOT_YET_DEFINED`

---

## 17. Direct Parent Payment Data

The MVP has no direct Parent payment to LunchBox Connect.

Therefore the MVP must not require LunchBox Connect to store direct Parent payment data for:

- Parent checkout;
- Parent saved card;
- Parent payment transaction;
- Parent refund;
- Parent direct subscription billing.

Any future institution-side payment integration remains:

`NOT_YET_DEFINED`

---

## 18. Auditability

Important administrative changes are intended to be auditable.

Confirmed audit concepts include:

- previous value;
- new value;
- responsible User;
- timestamp;
- reason where required.

Exact actions that create audit records are:

`NOT_YET_DEFINED`

---

## 19. Super Admin Overrides

Super Admin has override authority.

Where an approved workflow requires an override to be tracked, the override must not be recorded as a normal silent edit.

Exact override permissions, reason requirements, and evidence requirements are:

`NOT_YET_DEFINED`

---

## 20. Audit Record Integrity

The exact technical protection against alteration or deletion of Audit Records is:

`NOT_YET_DEFINED`

The system must not claim tamper-proof auditing until such protection is defined and verified.

---

## 21. Confidentiality Reference

Existing LunchBox Connect nursery agreements state that non-public commercial, operational, financial, nutritional, and administrative information received in connection with the agreement is confidential, except where disclosure is required by law or necessary for legitimate performance.

The software must not interpret that contract language as a complete technical privacy policy.

Detailed technical privacy controls remain governed by this project specification and future approved rules.

---

## 22. Applicable-Law Reference

Existing current agreement material is governed by the laws of the United Arab Emirates and uses Dubai as the stated court jurisdiction unless otherwise agreed.

This document does not independently define legal compliance requirements beyond the confirmed project documents.

Exact software privacy-law obligations are:

`NOT_YET_DEFINED`

---

## 23. Data Retention

Retention periods for:

- Student records;
- Guardian records;
- Allergy records;
- Meal records;
- Delivery records;
- Audit Records;
- Operational Logs;
- reports;
- deleted accounts

are:

`NOT_YET_DEFINED`

---

## 24. Deletion and Archiving

The exact rules for:

- hard deletion;
- soft deletion;
- archiving;
- restoration;
- anonymization;
- record closure

are:

`NOT_YET_DEFINED`

---

## 25. Production Data Protection

Claude Code must not perform destructive operations against important or production data without clear authority from the approved task and project rules.

This includes:

- dropping data;
- resetting production records;
- deleting Institutions;
- deleting Students;
- removing Audit Records;
- overwriting approved source data;
- destructive migrations.

Exact production change-control procedure is defined later in the Deployment Runbook once the technical architecture exists.

---

## 26. Encryption

Encryption at rest:

`NOT_YET_DEFINED`

Encryption in transit:

`NOT_YET_DEFINED`

Key-management provider:

`NOT_YET_DEFINED`

Claude Code must not claim a specific security posture until the architecture defines and verifies it.

---

## 27. Secrets

Secret-storage mechanism:

`NOT_YET_DEFINED`

No secret-management provider has been approved.

Secrets must not be represented as ordinary public configuration.

Exact implementation is deferred until the technical stack is approved.

---

## 28. Backups

Backup technology:

`NOT_YET_DEFINED`

Backup frequency:

`NOT_YET_DEFINED`

Restore procedure:

`NOT_YET_DEFINED`

Recovery targets:

`NOT_YET_DEFINED`

No backup capability may be claimed until implemented and tested.

---

## 29. Logging

Security / application logging architecture:

`NOT_YET_DEFINED`

Logs must not automatically expose unnecessary child or Guardian information.

Exact redaction rules are:

`NOT_YET_DEFINED`

---

## 30. Security Incident Handling

Security incident process:

`NOT_YET_DEFINED`

This includes:

- detection;
- classification;
- escalation;
- response ownership;
- notification;
- evidence preservation;
- closure.

---

## 31. File / Image Security

Any future file-upload capability and its:

- allowed file types;
- malware scanning;
- maximum size;
- access control;
- retention;
- private/public storage behavior

are:

`NOT_YET_DEFINED`

---

## 32. Test Data Versus Production Data

Test / demo data must not be presented as production truth.

Exact environment separation is:

`NOT_YET_DEFINED`

The distinction between test data and real operational data is mandatory.

---

## 33. Security Acceptance Principle

Security is not considered complete because:

- a login page exists;
- a role label exists;
- buttons are hidden;
- a build passes.

Verification must demonstrate that unauthorized roles are actually blocked from restricted data and actions.

---

## 34. Required Access-Control Verification

At minimum, once implementation exists, verification must prove:

- Parent A cannot access Parent B's child.
- Nursery A cannot access Nursery B's Institution data.
- Classroom User A cannot access unassigned Classes.
- Driver A cannot access unassigned Deliveries.
- Kitchen cannot access unnecessary Parent / financial data.
- Finance / Owner cannot perform operational edits.
- Viewer cannot perform writes.
- direct Parent payment capability does not exist in MVP.
- unauthorized API requests are rejected.

Exact test implementation belongs in `09_ACCEPTANCE_TESTS.md`.

---

## 35. Security Items Still Undefined

The following remain:

`NOT_YET_DEFINED`

- authentication provider;
- MFA;
- password policy;
- session policy;
- tenant-isolation architecture;
- encryption;
- secret storage;
- backup architecture;
- retention;
- deletion rules;
- incident response;
- logging/redaction;
- file security;
- infrastructure security;
- vulnerability scanning;
- dependency scanning;
- security headers;
- rate limiting;
- CSRF strategy;
- CORS policy;
- abuse controls;
- monitoring;
- alerting;
- formal compliance framework.

---

## 36. Final Security Rule

LunchBox Connect must protect child-related operational information through approved role scope and authoritative relationships.

Confirmed security facts are:

- no unnecessary access;
- institution users are scoped to their Institution;
- Parents are scoped to own child / children;
- Classroom users are scoped to assigned Classes;
- Kitchen receives only required Production and Allergy / Dietary information;
- Drivers are scoped to assigned Deliveries;
- Finance / Owner is reports only;
- Viewer is read-only;
- backend authorization must prevent UI bypass;
- unrestricted classroom free text must not automatically become Parent-visible;
- important administrative changes are intended to be auditable;
- direct Parent LunchBox Connect payment data is excluded from the MVP.

All unapproved technical security details remain:

`NOT_YET_DEFINED`
