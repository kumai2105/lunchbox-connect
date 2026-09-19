# 12_OUT_OF_SCOPE.md — LunchBox Connect

## 1. Purpose

This document defines what Claude Code must not add to the LunchBox Connect MVP without an explicit approved change.

Its purpose is scope control.

If a feature appears here, it is excluded even if:

- another SaaS product has it;
- a framework includes it;
- an AI considers it useful;
- it is easy to build;
- it seems like a normal industry feature.

---

## 2. Direct Parent Payment

Excluded from MVP:

- Parent checkout;
- Parent card payment to LunchBox Connect;
- Parent LunchBox Connect invoices;
- direct Parent subscription billing;
- Parent LunchBox Connect refunds;
- Parent saved payment methods for LunchBox Connect.

Current model:

- Parent pays Institution.
- Institution pays LunchBox Connect.

---

## 3. Consumer Food-Delivery Marketplace

Excluded:

- Deliveroo-style marketplace;
- Talabat-style marketplace;
- Careem-food-style consumer ordering;
- public restaurant discovery;
- consumer restaurant listings;
- on-demand Parent meal ordering;
- marketplace commissions;
- consumer courier marketplace behavior.

LunchBox Connect is an institutional operating system.

---

## 4. Live Chat

Excluded:

`LIVE_CHAT`

No role receives live-chat functionality in the MVP.

---

## 5. Loyalty

Excluded:

- loyalty points;
- rewards balance;
- loyalty tiers;
- stamp cards;
- points redemption.

---

## 6. Referrals

Excluded:

- referral codes;
- referral rewards;
- invite-and-earn;
- ambassador referral tracking.

---

## 7. Social Features

Excluded:

- social feed;
- likes;
- comments;
- followers;
- public profiles;
- social posting;
- Parent community feed.

---

## 8. Gamification

Excluded:

- badges;
- streaks;
- points;
- leaderboards;
- child eating-game mechanics.

---

## 9. AI Features

Excluded unless explicitly approved:

- AI assistant;
- AI nutrition recommendation;
- AI menu generation;
- AI allergy decision-making;
- AI child-health advice;
- AI operational decision automation;
- AI chatbot.

Claude Code itself may build the software, but the MVP product does not automatically contain AI functionality.

---

## 10. Native Mobile Apps

Native iOS application is not an approved MVP requirement.

Native Android application is not an approved MVP requirement.

Status:

`NOT_YET_DEFINED`

Claude Code must not expand MVP scope into native apps.

---

## 11. Unapproved Third-Party Integrations

Excluded until explicitly approved:

- payment provider;
- WhatsApp provider;
- SMS provider;
- email provider;
- authentication provider;
- analytics provider;
- mapping provider;
- route-optimization provider;
- external nutrition database;
- Nursery / School management system;
- accounting system;
- CRM;
- push-notification provider.

---

## 12. Unapproved Roles

Claude Code must not invent extra roles.

Approved role domains are:

- Super Admin;
- Nursery / School Admin;
- Operations Manager;
- Finance / Owner;
- Viewer;
- Parent / Guardian;
- Teacher / Nurse / Classroom Staff;
- Kitchen Operations;
- Driver / Logistics.

Any additional role requires explicit approval.

---

## 13. Unapproved Commercial Models

Excluded unless explicitly approved:

- direct Parent subscriptions to LunchBox Connect;
- Parent pay-per-meal;
- consumer ordering;
- marketplace seller accounts;
- franchise marketplace;
- commission-per-parent-order;
- loyalty-based pricing.

---

## 14. Unapproved Medical Logic

Claude Code must not invent:

- Allergy severity categories;
- clinical diagnoses;
- emergency medical rules;
- medical substitution policy;
- dietary clinical prescription;
- automatic health recommendations.

These require explicit approved rules.

---

## 15. Unapproved Workflow States

Claude Code must not invent permanent state machines.

Only confirmed operationally eligible status:

`ACTIVE_BILLABLE_TO_NURSERY`

All other exact state values remain:

`NOT_YET_DEFINED`

---

## 16. Unapproved Pricing Hard-Coding

Contract reference prices must not be permanently hard-coded merely because they appear in a current agreement.

Commercial configuration remains:

`NOT_YET_DEFINED`

---

## 17. Unapproved Contract Automation

The MVP does not automatically include:

- contract generation;
- e-signature;
- legal negotiation;
- automated legal notices;
- automated termination.

No such module is approved by default.

---

## 18. Unapproved HR / Payroll

Excluded unless approved:

- employee payroll;
- staff payroll;
- HR leave;
- recruitment;
- performance reviews;
- payroll accounting.

---

## 19. Unapproved Inventory / Procurement

A full procurement or warehouse-management system has not been approved.

Claude Code must not automatically add:

- supplier marketplace;
- purchasing;
- purchase orders;
- ingredient inventory accounting;
- stock valuation;
- warehouse management.

Kitchen Production is approved; a full procurement suite is not.

---

## 20. Unapproved Accounting Suite

Institutional billing / eligibility administration is approved as a domain.

A full accounting package is not automatically approved.

Excluded unless specified:

- general ledger;
- balance sheet;
- bank reconciliation;
- VAT accounting workflow;
- payroll accounting.

---

## 21. Unapproved CRM / Sales Module

Sales and CRM functionality is not part of the confirmed operational MVP specification.

Existing sales scripts / playbooks are reference business material, not an approval for a CRM module.

---

## 22. Unapproved Marketing Website

A public marketing website is not part of the confirmed software MVP specification unless separately approved.

---

## 23. Unapproved Public Signup

Public self-service Institution signup is:

`NOT_YET_DEFINED`

Claude Code must not assume anyone can create an Institution account publicly.

---

## 24. Unapproved Parent Self-Enrollment

Parent self-enrollment directly into LunchBox Connect is:

`NOT_YET_DEFINED`

Claude Code must not create it by assumption.

---

## 25. Unapproved Daily Parent Meal Choice

A Parent daily meal-selection / customization system is:

`NOT_YET_DEFINED`

It must not be added by assumption.

---

## 26. Unapproved Free-Text Parent Publication

Unrestricted classroom free text must not automatically become Parent-visible.

Safe predefined status or review is required before Parent visibility according to the established rule.

---

## 27. Unapproved Data Access

Excluded:

- Parent access to unrelated children;
- Nursery access to unrelated Institutions;
- Classroom access to unassigned Classes;
- Driver access to unassigned Deliveries;
- Kitchen access to unnecessary Parent / finance information;
- Finance / Owner operational editing;
- Viewer write access.

---

## 28. Unapproved Technical Stack

No technical provider or framework is automatically in scope.

The technical stack remains:

`NOT_YET_DEFINED`

Claude Code must not copy The Eastern Charm stack by assumption.

---

## 29. Unapproved Production Claims

Claude Code must not claim:

- production-ready;
- secure;
- tested;
- deployed;
- verified;
- backed up;
- rollback-ready

without evidence.

---

## 30. Scope Change Rule

An excluded item may enter scope only after an explicit user decision changes the project truth.

When that happens:

1. update `00_SOURCE_OF_TRUTH.md` if necessary;
2. update affected specification files;
3. record the decision in `13_DECISION_LOG.md`;
4. update acceptance tests;
5. implement only after the specifications agree.

---

## 31. Final Out-of-Scope Rule

If a capability is not approved, Claude Code must not add it merely to make the product look more complete.

Undefined means:

`NOT_YET_DEFINED`

Excluded means:

`OUT_OF_SCOPE`

Neither means permission to invent.

---

## Still Out Of Scope After The 2026-08-23 Lifecycle Closure

Closing the lifecycle gaps did not widen the MVP. These remain out:

- **Permanent deletion of any core record.** Not deferred — refused by design
  (Decision 037). Accounts, Institutions and Classes are deactivated or
  archived; the record of meals served to children depends on all three
  continuing to exist.
- **Changing an email address.** Requires a synchronised Auth + profile change
  with confirmation of the new address; not built (Decision 038).
- **Changing a role or institution in place.** Would give a live session a
  reach it was not issued for; the supported path is a new account plus a
  deactivation.
- **Self-service password reset by email.** Accounts are administrator-issued
  by decision, and no email sending is configured on the domain. A signed-in
  person changing their own password is a different thing, and that IS built.
- **Nursery-side guardian revocation.** Who at an institution may end a
  guardian relationship, and on whose authority, remains `NOT_YET_DEFINED`
  (Decision 041). A Super Admin can do it.
- **Retention and purge policy.** How long archived records are kept, and
  whether anything is ever removed, is not decided. Archive is not retention.
- **Packing, Dispatch, Delivery, structured Allergy/Dietary, Parent chat, AI
  and procurement** — unchanged, still out.
