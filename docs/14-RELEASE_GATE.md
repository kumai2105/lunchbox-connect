# Release gate (docs/14) — independent verification

This build does not self-certify. Before the platform is used with real
institutions, an independent verifier must confirm the evidence below. All
items must be reproduced against a **live Supabase project**, not trusted from
this repository alone.

## Required evidence

1. **Static checks (runbook step 5)**
   - `pnpm typecheck` — clean
   - `pnpm lint` — clean
   - `pnpm test:unit` — RBAC matrix and eligibility transitions pass

2. **Live boundary tests (runbook step 9)**
   - `pnpm test:e2e` with seeded accounts — AT-030/031 specs pass:
     - a parent cannot navigate to staff pages (routing + RLS)
     - a super admin opens the command center and users screen
     - the serving screen lists only the caller's scoped classes
   - `tests/sql/notes_safety.sql` run against the live database:
     - parent sees only published notes for own children (1 row)
     - parent sees zero rows for other children
     - staff of the institution sees both published and unpublished notes

3. **RLS audit**
   - `select * from v_rls_audit;` — every table listed with `rls_enabled = t`
     and the expected policy counts.

## Declared out of scope (spec gaps)

Kitchen production math, dispatch/delivery states, report KPIs, the eligibility
determination formula, and document file storage are NOT_YET_DEFINED in the
spec pack and are delivered as isolated shells. They are not verified because
they are not specified.

## Sign-off

| Verifier        | Date | Result | Evidence ref |
| --------------- | ---- | ------ | ------------ |
| _(independent)_ |      |        |              |
