# 10_DEPLOYMENT_RUNBOOK.md — LunchBox Connect

## 1. Purpose

This document defines the current approved deployment and release operating rules for LunchBox Connect.

The technical stack has not yet been approved.

Therefore this runbook intentionally does not choose:

- hosting provider;
- database provider;
- object storage provider;
- frontend host;
- backend host;
- CI/CD provider;
- domain/DNS provider;
- secrets provider;
- monitoring provider.

All such decisions remain:

`NOT_YET_DEFINED`

---

## 2. Current Technical Status

Confirmed current state:

- LunchBox Connect does not yet have an approved completed production software system.
- No authoritative production repository has been established as current project truth.
- No approved physical database schema exists.
- No approved migration system exists.
- No approved authentication implementation exists.
- No approved API architecture exists.
- No approved deployment architecture exists.
- No approved hosting provider exists.
- No approved production environment exists.
- No approved CI/CD pipeline exists.

---

## 3. Technical Stack

**SUPERSEDED — APPROVED. See Decision 034 in `13_DECISION_LOG.md`.** The stack is
TypeScript · React 18 + Vite (SPA) · Supabase (PostgreSQL, Auth, Storage, Edge
Functions) · Row Level Security · Supabase CLI migrations
(`supabase/migrations/0001`–`0031`) · Cloudflare Workers deploy · pnpm · Vitest ·
Playwright. Operational timezone (MVP): Asia/Dubai. The current, authoritative
production apply order is `scripts/PRODUCTION_APPLY.md` in the repo root.

> _Historical (superseded):_ `TECHNICAL_STACK = NOT_YET_DEFINED`.

---

## 4. Environment Model

Development environment:

`NOT_YET_DEFINED`

Testing environment:

`NOT_YET_DEFINED`

Staging environment:

`NOT_YET_DEFINED`

Production environment:

`NOT_YET_DEFINED`

No environment may be represented as officially approved until defined.

---

## 5. Repository

Repository provider:

`NOT_YET_DEFINED`

Repository URL:

`NOT_YET_DEFINED`

Default branch:

`NOT_YET_DEFINED`

Release branch model:

`NOT_YET_DEFINED`

---

## 6. Domain

Production domain:

`NOT_YET_DEFINED`

Admin / portal domains:

`NOT_YET_DEFINED`

DNS provider:

`NOT_YET_DEFINED`

---

## 7. Build System

Package manager:

`NOT_YET_DEFINED`

Runtime:

`NOT_YET_DEFINED`

Build command:

`NOT_YET_DEFINED`

Test command:

`NOT_YET_DEFINED`

Lint command:

`NOT_YET_DEFINED`

Type-check command:

`NOT_YET_DEFINED`

---

## 8. Database

Database technology:

`NOT_YET_DEFINED`

Migration tool:

`NOT_YET_DEFINED`

Migration command:

`NOT_YET_DEFINED`

Database environment separation:

`NOT_YET_DEFINED`

Production backup method:

`NOT_YET_DEFINED`

Restore method:

`NOT_YET_DEFINED`

---

## 9. Storage

File / image storage:

`NOT_YET_DEFINED`

Private/public access model:

`NOT_YET_DEFINED`

---

## 10. Authentication

Authentication provider / implementation:

`NOT_YET_DEFINED`

Production credentials:

`NOT_YET_DEFINED`

---

## 11. External Integrations

No external integration provider has yet been approved.

This includes:

- payment;
- WhatsApp;
- SMS;
- email;
- authentication;
- analytics;
- maps / routing;
- nutrition database;
- school-management integration.

Any integration credentials are therefore:

`NOT_YET_DEFINED`

---

# PART I — RELEASE PRECONDITIONS

## 12. Source-of-Truth Compliance

Before any release can be approved, implementation must not contradict:

- `CLAUDE.md`
- `00_SOURCE_OF_TRUTH.md`
- approved requirement files;
- approved roles and permissions;
- approved business rules;
- approved workflows;
- approved data model;
- approved UI scope;
- approved API / integration rules;
- approved security requirements;
- acceptance tests.

---

## 13. Undefined Decisions

A release must not silently hard-code a permanent interpretation of a required business rule that remains:

`NOT_YET_DEFINED`

If a required decision blocks correct implementation, release status must identify the block.

---

## 14. Acceptance Tests

Required applicable tests from `09_ACCEPTANCE_TESTS.md` must have evidence.

A required test marked `FAIL` blocks release.

A test marked `BLOCKED_BY_SPEC` identifies an unresolved specification dependency.

---

## 15. Security Boundaries

Before release, applicable evidence must prove:

- Institution isolation;
- Parent own-child isolation;
- Classroom assigned-Class isolation;
- Driver assigned-Delivery isolation;
- Kitchen data minimization;
- Finance / Owner reports-only restriction;
- Viewer read-only restriction;
- backend authorization enforcement.

---

## 16. Parent Payment Exclusion

Release must be blocked if direct Parent LunchBox Connect payment functionality has been added to the MVP without an explicit approved source-of-truth change.

---

## 17. Build Status

Production build requirement:

`NOT_YET_DEFINED`

Once the stack is approved, release requires successful build evidence.

---

## 18. Test Status

Automated test framework:

`NOT_YET_DEFINED`

Once approved, required tests must pass.

---

## 19. Migration Status

Migration process:

`NOT_YET_DEFINED`

No production migration may be claimed as verified until an approved migration mechanism exists and evidence is available.

---

# PART II — DATA SAFETY

## 20. No Destructive Production Action Without Authority

Claude Code must not perform destructive actions against important or production data without clear authority from the current task and approved project rules.

Examples:

- drop database;
- reset production data;
- delete Institution;
- delete Student;
- delete Audit Records;
- overwrite approved source data;
- destructive migration.

---

## 21. Test Data Separation

Test / demo data must remain distinguishable from production operational data.

Exact technical separation is:

`NOT_YET_DEFINED`

---

## 22. Backup Before Risky Production Change

Exact backup policy is:

`NOT_YET_DEFINED`

No backup claim may be made until backup and restore are actually implemented and verified.

---

# PART III — DEPLOYMENT PROCESS

## 23. Deployment Command

`NOT_YET_DEFINED`

---

## 24. Deployment Credentials

`NOT_YET_DEFINED`

---

## 25. Production Configuration

`NOT_YET_DEFINED`

---

## 26. Secrets Injection

`NOT_YET_DEFINED`

---

## 27. Database Migration Step

`NOT_YET_DEFINED`

---

## 28. Asset / Storage Deployment Step

`NOT_YET_DEFINED`

---

## 29. Domain / DNS Step

`NOT_YET_DEFINED`

---

## 30. Post-Deploy Health Check

Exact health-check endpoint or process:

`NOT_YET_DEFINED`

Once architecture exists, successful deployment must be verified in the actual target environment.

---

# PART IV — POST-DEPLOY VERIFICATION

## 31. Live Authentication Verification

`BLOCKED_BY_SPEC`

until authentication and environment are defined.

---

## 32. Live Role Isolation Verification

Once deployed, verify authorized role scope in the actual environment.

Required logical checks:

- Parent cannot access unrelated child.
- Nursery cannot access unrelated Institution.
- Classroom user cannot access unassigned Class.
- Driver cannot access unassigned Delivery.
- Kitchen cannot access unnecessary Parent / financial data.
- Finance / Owner cannot perform operational writes.
- Viewer cannot perform writes.

---

## 33. Live Core Workflow Verification

Once relevant business states are defined and implemented, verify:

**Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting**

Exact test fixture and steps remain dependent on unresolved specifications.

---

## 34. Live Parent-Payment Exclusion Verification

Verify no direct Parent LunchBox Connect payment flow exists in the MVP.

---

## 35. Live Failure Verification

Verify failed write operations do not appear successful.

---

# PART V — ROLLBACK

## 36. Rollback Strategy

Application rollback:

`NOT_YET_DEFINED`

Database rollback:

`NOT_YET_DEFINED`

Data restore:

`NOT_YET_DEFINED`

Rollback authority:

`NOT_YET_DEFINED`

No rollback capability may be claimed until defined and tested.

---

# PART VI — RELEASE RECORD

## 37. Required Release Record Concepts

Once the deployment system exists, each approved production release must record enough evidence to identify:

- version / commit;
- release date/time;
- target environment;
- build result;
- test result;
- migration result where applicable;
- verification result;
- known unresolved items;
- final release decision.

Exact format is:

`NOT_YET_DEFINED`

---

# PART VII — RELEASE STATUS LANGUAGE

## 38. Prohibited Unsupported Claims

Claude Code must not say:

- deployed;
- production-ready;
- verified;
- secure;
- migration complete;
- rollback ready;
- backup verified

without evidence.

---

## 39. Allowed Statuses

Release reporting may distinguish:

- implemented;
- build passed;
- tests passed;
- deployed;
- live verified;
- blocked;
- partially verified.

Each status must be supported by actual evidence appropriate to that claim.

---

# PART VIII — RELEASE GATE

## 40. Independent Verification

The approved project workflow includes independent verification before release approval.

The exact release-gate responsibilities are defined in:

`14_VERIFICATION_RELEASE_GATE.md`

Implementation and verification must not be treated as the same thing merely because the same AI generated both statements.

---

## 41. Automatic Release Blockers

Release is blocked by:

- failed required acceptance test;
- broken role isolation;
- source-of-truth contradiction;
- direct Parent payment functionality added without approval;
- unresolved required business rule silently invented;
- known failed migration;
- known deployment failure;
- known unauthorized access;
- test data presented as real production data;
- unsupported completion claim.

---

## 42. Current Deployment Readiness

At the current source-of-truth state:

`DEPLOYMENT_ARCHITECTURE = NOT_YET_DEFINED`

Therefore this file does not authorize a production deployment yet.

It defines the rules that the future approved deployment process must obey.

---

## 43. Final Deployment Rule

LunchBox Connect must not inherit a stack by accident.

The technical architecture, environment model, commands, providers, credentials, backups, migrations, rollback process, and production domain remain:

`NOT_YET_DEFINED`

until explicitly approved.

Once they are defined, this runbook must be updated before production release.

---

## Edge Functions In The Go-Live Sequence (updated 2026-08-23)

Three Edge Functions must be deployed alongside the schema, or the actions
that depend on them fail in the browser with a 404 that looks like a product
bug:

```
pnpm functions:deploy
```

which is `supabase functions deploy admin-create-user && supabase functions
deploy admin-set-password && supabase functions deploy admin-set-active`.

Each needs `SUPABASE_SERVICE_ROLE_KEY` set as a function secret
(`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`). That key is a full
bypass of every RLS policy in the project and must exist **only** in the Deno
environment — never in the frontend build, never in a repository variable that
reaches a bundle.

| Function             | Breaks if not deployed                               |
| -------------------- | ---------------------------------------------------- |
| `admin-create-user`  | no account can be created from any screen            |
| `admin-set-password` | an administrator cannot issue a replacement password |
| `admin-set-active`   | no account can be deactivated or reactivated         |

Changing your own password needs none of them — it goes through Supabase Auth
on the caller's own session.

## Schema-before-frontend, and why it is not negotiable

The frontend deploy workflow refuses to run until `BACKEND_READY_MIGRATION`
attests the highest migration applied to production. That gate exists because
the frontend reads columns and calls functions that a lagging backend does not
have, and the failure is **silent and wrong** rather than loud: a missing
`active` column reads back as `undefined`, which is falsy, so every account
would render as "Deactivated" and every institution as "Archived" on a live
site.

Order, always: **migrations → Edge Functions → frontend.**
