# LunchBox Connect — Software Specification Pack

## Purpose

This repository pack is the authoritative specification set for building the LunchBox Connect MVP.

Claude Code must read `CLAUDE.md` first and then follow the authority hierarchy defined there.

The files do not authorize Claude Code to invent unresolved business rules.

Any unresolved decision remains:

`NOT_YET_DEFINED`

---

## Core Product Rule

LunchBox Connect is an institutional child nutrition operating system.

The confirmed operating chain is:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

The system must use one connected source of operational truth.

---

## Confirmed MVP Commercial Model

- The Institution is the commercial customer.
- Parents pay the Nursery / School.
- The Nursery / School pays LunchBox Connect.
- Parents do not pay LunchBox Connect directly in the MVP.
- Direct Parent checkout, Parent payment gateway, Parent LunchBox Connect invoices, Parent refunds, and direct Parent subscription billing are excluded.

The confirmed operationally eligible Student status is:

`ACTIVE_BILLABLE_TO_NURSERY`

---

## Specification Files

### Root

- `CLAUDE.md` — master instructions for Claude Code.
- `README.md` — this file.

### `/docs`

- `00_SOURCE_OF_TRUTH.md` — highest-authority factual project record after current explicit user instructions.
- `01_PRODUCT_REQUIREMENTS.md` — confirmed MVP product requirements.
- `02_ROLES_AND_PERMISSIONS.md` — approved access domains and permission boundaries.
- `03_BUSINESS_RULES.md` — confirmed operational and commercial rules.
- `04_DATA_MODEL.md` — logical entities, authoritative records, and relationships.
- `05_WORKFLOWS_AND_STATE_MACHINES.md` — confirmed end-to-end workflows and state constraints.
- `06_UI_UX_SCREEN_SPEC.md` — confirmed role-facing screens and interface boundaries.
- `07_API_AND_INTEGRATIONS.md` — confirmed internal interface rules and integration status.
- `08_SECURITY_PRIVACY_AUDIT.md` — confirmed privacy, access-control, audit, and security requirements.
- `09_ACCEPTANCE_TESTS.md` — acceptance tests derived from approved requirements.
- `10_DEPLOYMENT_RUNBOOK.md` — deployment rules; technical stack remains undefined until approved.
- `11_REFERENCE_DATA.md` — approved enums plus reference-only commercial/menu facts and source status.
- `12_OUT_OF_SCOPE.md` — explicit exclusions and prohibited scope expansion.
- `13_DECISION_LOG.md` — record of confirmed project decisions and superseded rules.
- `14_VERIFICATION_RELEASE_GATE.md` — independent verification and release-approval requirements.

### `/seed`

- `menu-data.json` — reference/demo seed extracted from the Nurse Review Draft. It is not approved production menu data.

---

## Authority Hierarchy

When information conflicts, follow:

1. Current explicit user instruction
2. `docs/00_SOURCE_OF_TRUTH.md`
3. Approved requirements, roles, business rules, workflows, data, UI, API, security, testing, and deployment specifications
4. `docs/13_DECISION_LOG.md`
5. Approved structured project data
6. Reference agreements, menus, nutrition documents, and other source material
7. Historical drafts

Historical material does not override later confirmed decisions.

---

## Important Historical Conflict

Older agreement wording may mention direct Parent-payment enrolments.

For the MVP, that wording is obsolete.

Current rule:

**Institution pays LunchBox Connect. Parent does not pay LunchBox Connect directly.**

---

## Current Technical Status

The LunchBox Connect technical stack remains:

`NOT_YET_DEFINED`

The pack does not currently approve:

- hosting provider;
- database provider;
- frontend framework;
- backend framework;
- authentication provider;
- deployment provider;
- CI/CD system;
- payment provider;
- WhatsApp provider;
- SMS provider;
- email provider;
- routing provider;
- analytics provider.

Claude Code must not inherit the architecture of another project by assumption.

---

## Release Rule

The application is not complete merely because:

- code exists;
- a screen renders;
- the build passes;
- an AI says it works.

Applicable acceptance tests must pass with evidence, and the independent release gate must approve the release.

If a required business rule is unresolved, it remains:

`NOT_YET_DEFINED`

or, in testing:

`BLOCKED_BY_SPEC`
