# 13_DECISION_LOG.md — LunchBox Connect

## 1. Purpose

This document records confirmed LunchBox Connect decisions and known superseded rules.

It is not a brainstorming log.

Only confirmed decisions belong here.

Where the exact original decision date was not recovered, the date field is marked:

`DATE_NOT_RECOVERED`

This file was compiled into the software specification pack on:

`2026-08-14`

---

## Decision 001 — Product Positioning

**Date:** `DATE_NOT_RECOVERED`

**Decision:** LunchBox Connect is an institutional child nutrition operating system / Institutional Nutrition System, not merely a catering company and not a consumer food-delivery marketplace.

**Status:** ACTIVE

---

## Decision 002 — Connected System Principle

**Date:** `DATE_NOT_RECOVERED`

**Decision:** LunchBox Connect must operate as one connected system using authoritative shared data rather than separate portal-specific truths.

Confirmed chain:

`Institution → Student → Eligibility → Production → Dispatch → Delivery → Serving → Parent Visibility → Reporting`

**Status:** ACTIVE

---

## Decision 003 — Commercial Counterparty

**Date:** `DATE_NOT_RECOVERED`

**Decision:** The Institution is the commercial customer in the MVP.

Parents pay the Nursery / School.

Nursery / School pays LunchBox Connect.

**Status:** ACTIVE

---

## Decision 004 — Direct Parent Payment Removed From MVP

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Direct Parent payment to LunchBox Connect is not part of the MVP.

Excluded:

- Parent checkout;
- Parent payment gateway;
- Parent LunchBox Connect invoices;
- Parent LunchBox Connect refunds;
- direct Parent LunchBox Connect subscription billing.

**Supersedes:** Historical agreement wording referring to direct Parent-payment enrolments.

**Status:** ACTIVE

---

## Decision 005 — Confirmed Operational Eligibility Value

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Confirmed eligible Student status:

`ACTIVE_BILLABLE_TO_NURSERY`

Only eligible Students may enter the standard Production, Delivery, and Serving chain.

Full status state machine remains undefined.

**Status:** ACTIVE

---

## Decision 006 — One Authoritative Student Record

**Date:** `DATE_NOT_RECOVERED`

**Decision:** The same Student must not exist as disconnected independent records in Parent, Nursery, Classroom, Kitchen, and Logistics portals.

**Status:** ACTIVE

---

## Decision 007 — Super Admin

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Super Admin is the system-wide master-control role.

Confirmed domains include Institutions, Users, Students, Classes, Guardians, Menus, Allergy approvals, operational statuses, billing cycles, Kitchen, Deliveries, Reporting, system configuration, audit information, and overrides.

**Status:** ACTIVE

---

## Decision 008 — Nursery / School Admin Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Nursery / School Admin is limited to its own Institution.

**Status:** ACTIVE

---

## Decision 009 — Parent Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Parent / Guardian access is limited to own authorized child / children.

**Status:** ACTIVE

---

## Decision 010 — Classroom Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Teacher / Nurse / Classroom Staff access is limited to assigned Class / Classes.

**Status:** ACTIVE

---

## Decision 011 — Kitchen Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Kitchen Operations receives Production and required Allergy / Dietary information only and must not receive unnecessary Parent / finance data.

Kitchen must not independently invent Student counts.

**Status:** ACTIVE

---

## Decision 012 — Driver Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Driver / Logistics access is limited to assigned Deliveries.

**Status:** ACTIVE

---

## Decision 013 — Finance / Owner Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Finance / Owner is reports only.

**Status:** ACTIVE

---

## Decision 014 — Viewer Scope

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Viewer is read-only.

**Status:** ACTIVE

---

## Decision 015 — Operations Manager

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Operations Manager has Operational Logs and Operational Issues.

Exact organizational scope remains:

`NOT_YET_DEFINED`

**Status:** ACTIVE / PARTIALLY DEFINED

---

## Decision 016 — No Live Chat

**Date:** `DATE_NOT_RECOVERED`

**Decision:** No live chat in MVP.

**Status:** ACTIVE

---

## Decision 017 — Classroom Daily View

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Teacher / Nurse / Classroom Staff has a role-based daily / “Today” operational concept.

Previously established meal-tracking categories:

- Breakfast;
- Snack;
- Lunch;
- Afternoon Snack.

**Status:** ACTIVE

---

## Decision 018 — Parent-Visible Notes Protection

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Unrestricted classroom free-text notes do not automatically become Parent-visible.

Parent-visible notes must use:

- safe predefined status; or
- review before publication.

Exact review flow remains:

`NOT_YET_DEFINED`

**Status:** ACTIVE

---

## Decision 019 — Kitchen Production Source

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Kitchen Production Demand derives from authoritative eligible Student data and approved Meal information.

Kitchen cannot create an independent authoritative Student-count system.

**Status:** ACTIVE

---

## Decision 020 — Dispatch / Delivery Chain

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Dispatch relates to actual Production, and Delivery relates to Dispatch.

**Status:** ACTIVE

---

## Decision 021 — Responsibility After Handover

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Current service model places internal serving / feeding responsibility with the Nursery / School after completed Delivery handover.

**Source alignment:** Current Nursery agreements.

**Status:** ACTIVE

---

## Decision 022 — Historical Contract Commercial Values Are Not Permanent Software Logic

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Contract prices, minimum Student counts, prepayment periods, and delivery terms are reference data unless explicitly approved as software configuration rules.

**Status:** ACTIVE

---

## Decision 023 — Menu / Nutrition Source Status

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Existing Menu and Nutrition documents may be used as reference / seed evidence, but approximate Nutrition values and Nurse Review Draft content must not be presented as final operationally approved Nutrition truth.

**Status:** ACTIVE

---

## Decision 024 — Technical Stack Not Yet Approved

**Date:** `DATE_NOT_RECOVERED`

**Decision:**

`TECHNICAL_STACK = NOT_YET_DEFINED`

LunchBox Connect must not inherit another project's stack by assumption.

**Status:** ACTIVE

---

## Decision 025 — No Automatic Native App Requirement

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Native iOS and Android are not confirmed MVP requirements.

**Status:** ACTIVE / NOT YET DEFINED FOR FUTURE

---

## Decision 026 — No External Provider Approved Yet

**Date:** `DATE_NOT_RECOVERED`

**Decision:** No specific provider is currently approved for payment, WhatsApp, SMS, email, authentication, analytics, maps/routing, external Nutrition data, or School/Nursery management integration.

**Status:** ACTIVE

---

## Decision 027 — No Unsupported Completion Claims

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Code existence, a successful build, or a rendered UI is not sufficient proof of completion.

Completion requires evidence against approved acceptance criteria.

**Status:** ACTIVE

---

## Decision 028 — Independent Verification and Release Gate

**Date:** `DATE_NOT_RECOVERED`

**Decision:** Implementation must be independently verified and subject to a release gate that can block unsupported approval.

**Status:** ACTIVE

---

## Decision 029 — Undefined Means Undefined

**Date:** `DATE_NOT_RECOVERED`

**Decision:** When a project rule has not been approved, Claude Code must mark it:

`NOT_YET_DEFINED`

rather than invent it.

**Status:** ACTIVE

---

## Decision 030 — Specification Pack Governance

**Date:** `2026-08-14`

**Decision:** The LunchBox Connect software build is governed by `CLAUDE.md` and the numbered specification pack. Files are built from confirmed facts, with unresolved items explicitly left undefined.

**Status:** ACTIVE

---

## Superseded Rule Register

### S-001 — Direct Parent-Payment Enrolment

Historical source wording:

- direct Parent-payment enrolments.

Current status:

`SUPERSEDED_FOR_MVP`

Replacement:

- Parent pays Institution.
- Institution pays LunchBox Connect.

---

## Change-Control Rule

When the user explicitly changes an active decision:

1. preserve the historical entry;
2. mark the old decision `SUPERSEDED`;
3. add the new decision;
4. update `00_SOURCE_OF_TRUTH.md`;
5. update every affected specification;
6. update acceptance tests;
7. do not leave contradictory active rules.
