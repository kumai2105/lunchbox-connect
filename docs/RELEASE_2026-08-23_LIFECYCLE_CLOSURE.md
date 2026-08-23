# Core operability closure — 23 August 2026

The platform could create everything and end nothing. This release closes that,
and closes the two things that followed from it: a password nobody could ever
change, and a specification that described lifecycle rules the database had no
columns to hold.

## Release identity

|                                    |                                                                   |
| ---------------------------------- | ----------------------------------------------------------------- |
| Branch                             | `claude/new-session-k5dd5u`                                       |
| Baseline this closure started from | `6f94b017db9f3388e0386c9f4318cc133625804b`                        |
| Migration ceiling in repo BEFORE   | `0043_meal_period_tags.sql`                                       |
| Migration ceiling in repo AFTER    | `0046_an_archived_institution_gains_no_people.sql`                |
| Migration ceiling in production    | **`0042`** — unchanged. `0043`–`0046` are **PENDING**, see below. |
| Production Supabase                | `llnofriwvnerntrbpehc`                                            |

## What was actually wrong

Not defects in what the product did. Defects in what it could not do at all.

| Gap                                                                                                                                                         | Layer                                                           | Closed by                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| No account could be deactivated. The only lifecycle was "leave it there forever"                                                                            | DATABASE — `app_users` had no state to deactivate into          | `0044`; `admin-set-active`                          |
| No Institution could be archived, though the spec said in three places that they are "archived, never destroyed"                                            | DATABASE — `institutions` had four columns and no archive state | `0044`                                              |
| No Class could be archived                                                                                                                                  | DATABASE                                                        | `0044`                                              |
| No guardian relationship could be ended, though the RBAC matrix advertised the authority                                                                    | DATABASE — nothing served the `delete`                          | `0044`; Guardians screen                            |
| No password could ever be changed, by anyone, after creation. The operating guide told administrators to keep a written record of every password they typed | PRODUCT — no path existed                                       | `admin-set-password`; per-role account screen       |
| A child's name, ID or grade could not be corrected in the product                                                                                           | PRODUCT                                                         | Student profile → Edit details                      |
| Tagging a Meal for another sitting minted a duplicate `meal_revisions` row                                                                                  | DATABASE — `save_meal` appended unconditionally                 | `0045`                                              |
| An Institution Admin's Students and Classes screens asked which institution they meant, and offered two routes to a page their role cannot open             | PRODUCT                                                         | scope derived from the account, not the URL         |
| "Active — billable to nursery" was shown to school administrators about their own pupils                                                                    | PRODUCT (wording only; the stored value is unchanged)           | `statusLabel()`                                     |
| Four roles with no built screen were offered in the account-creation picker                                                                                 | PRODUCT                                                         | `provisionableRoles()`, derived from the navigation |
| A deactivated account with a live session landed in an empty Parent portal                                                                                  | PRODUCT                                                         | the application boundary now recognises it          |

## The security shape of deactivation

Deactivation is not a hidden row. `app_current_role()`,
`app_current_institution_id()` and `app_current_kitchen_id()` — the three
helpers every RLS policy in the schema is built on — resolve to NULL for an
inactive account, and the seven predicate helpers that read `app_users`
directly carry the same condition. A token issued a moment before the change
reads nothing and writes nothing from the next statement onward; the account
cannot see even its own `app_users` row.

The Supabase Auth account is banned in the same action, so ordinarily no such
token is ever issued. **That is defence in depth. RLS is the boundary**, and it
is the half that is tested against a live token.

`admin-set-active` calls `set_user_active` **with the caller's own JWT**, not
with the service role. The authorization decision, the audit row and the
class-assignment cleanup all happen once, in the database, inside one
transaction. The Edge Function adds only the Auth half, which needs a key the
browser must never hold. Re-deciding the rule in TypeScript would have created
a second, weaker copy that could drift from the real one.

## Passwords

- **No password value is retrievable by anybody.** Supabase stores a bcrypt
  hash; nothing in this product reads, returns, echoes or logs one. The
  interface says so where an administrator might otherwise go looking.
- **An administrator issues a replacement** through `admin-set-password` — a
  Super Admin for anyone, an Institution Admin only for their own classroom
  staff. The audit records that it happened, by whom, for whom and why, and
  **never the value**; there is no column in that write which could carry one.
- **Any signed-in person changes their own** from their own account screen,
  every role including Parents. No privileged key, and it grants authority over
  nobody else.
- There is still **no "forgot password" email**. Accounts are
  administrator-issued by decision.

## What the gate caught, which is the point of having one

Four failures were found by running this, and the split matters.

**Three were mine** — assertions and locators written against copy this same
closure had changed:

- run `32640684885`: "how you sign in" versus "what this person signs in with";
  and an eligibility control located by an option this closure had renamed.
- run `32642338782`: the end-to-end chain located the institution invite
  modal's password field by a label the reveal-control conversion had renamed.
  That one exposed a real drift — three provisioning screens had three
  different labels for the same field — so they now share one.

**One was the product** (run `32641054574`, 97/98): a Parent with no linked
child could not reach their own profile, so they could not change their
password and **could not sign out**. Two ordinary people are in that state: one
whose account was created before their child was linked, which is the normal
provisioning order, and one whose guardian link has just been revoked. No
previous test had ever created it; this closure's lifecycle spec makes a Parent
account and then uses it, which is how it surfaced. Corrected in the product,
and the assertion now requires the way out to be present.

## Gate, dynamically derived

Every number below was produced by executing the thing, not by reading a
previous document.

| Gate                 | Result                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Browser E2E          | **100 / 100** — 0 failed, 0 skipped, 0 flaky (run `32643257414`, on `c0a77d44b720f5b0cb85d051de041ab9784a8377`) |
| SQL suites           | **23 suites, 280 named assertions**, 0 failures, replayed from nothing on a throwaway PostgreSQL 16             |
| Authorization matrix | **520 checks**, all pass                                                                                        |
| Unit tests           | **125**, 13 files                                                                                               |
| TypeScript           | app + node + e2e, all pass                                                                                      |
| ESLint               | pass, 0 warnings                                                                                                |
| Production build     | pass                                                                                                            |

Suite growth this closure: 85 → 100 browser tests, 22 → 23 SQL suites,
237 → 280 assertions, 122 → 125 unit tests.

### New this closure

- `tests/sql/verify_lifecycle_security.sql` — 35 assertions across accounts
  (a1–a10), classes (c1–c4), institutions (i1–i5), guardian links (g1–g5) and
  audit (x1–x2). Proves deactivation against a **live token**, proves
  reactivation does **not** restore class assignments, proves the last active
  Super Admin cannot be deactivated, proves archival refuses over a live
  commitment and preserves every historical row, proves guardian revocation is
  immediate and narrow, and proves the audit trail carries no password
  material.
- `tests/e2e/lifecycle.spec.ts` — the same actions driven by a person, using
  disposable fixtures it creates and cleans up. Includes proving a deactivated
  account cannot get in **from a fresh browser context**, that a reissued
  password works while the old one is refused, and that a Parent can change
  their own password.

## PENDING — this release is NOT deployed, and deliberately so

**Migrations `0043` through `0046` have NOT been applied to production.**

This environment cannot reach Supabase at all — `curl` to both the project and
`api.supabase.com` returns `CONNECT tunnel failed, response 403`, there is no
CLI installed, and the Supabase connector needs an interactive authorisation a
background session cannot perform. Checked, not assumed.

GitHub Actions **can** reach Supabase, so
`.github/workflows/prod-apply-migrations.yml` now does the apply there, with a
recovery point captured before anything changes. It was run once and failed
closed: both `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` are absent.
Adding those two repository secrets and dispatching the workflow is the whole
remaining action — see `docs/GO_LIVE_0046.md`.

**The frontend must NOT be deployed ahead of them.** The failure would be
silent rather than loud: `app_users.active` and `institutions.active` do not
exist at `0042`, so `select *` returns rows without them, `undefined` is falsy,
and **every account would render as "Deactivated" and every institution as
"Archived"** on the live site. `meal_periods` would 404 and Meal saves would
fail.

### The go-live sequence, in this order

1. Apply `0043`, `0044`, `0045`, `0046` to `llnofriwvnerntrbpehc`.
2. Capture a recovery point first, as was done for `0042` in
   `docs/recovery/2026-08-22-pre-0042.md`. `0044` is additive (new nullable
   columns, new functions, new triggers), `0045` replaces `save_meal` and
   `0046` adds one trigger — all reversible, but the point is to have checked
   rather than to assume.
3. `pnpm functions:deploy` — **all three** Edge Functions
   (`admin-create-user`, `admin-set-password`, `admin-set-active`). Each needs
   `SUPABASE_SERVICE_ROLE_KEY` set as a function secret. Without
   `admin-set-active`, deactivation fails in the browser with a 404 that looks
   like a product bug.
4. Set `BACKEND_READY_MIGRATION` to `0046`.
5. Deploy the frontend at the **exact SHA this gate ran against**.
6. Run `prod-smoke` and `prod-browser-auth` against that same SHA.

### The commands, in order

```bash
# 1 · schema — from a checkout of the verified SHA
supabase link --project-ref llnofriwvnerntrbpehc
supabase db push                      # applies 0043, 0044, 0045, 0046

# 2 · confirm the ledger actually moved
#     (four new rows; the newest name should be 0046_an_archived_institution…)

# 3 · the three privileged functions — all of them, or deactivation 404s
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...   # if not already set
pnpm functions:deploy

# 4 · attest the backend, then deploy the frontend at the SAME SHA
#     BACKEND_READY_MIGRATION=0046  (repository variable, or the
#     workflow_dispatch input on Deploy to Cloudflare)

# 5 · prove it against the live origin
#     dispatch prod-smoke and prod-browser-auth on that SHA
```

A recovery point for `0044` would record, at minimum: the current
`institutions`, `classes` and `app_users` column lists, and the definitions of
the eleven authorization helpers it replaces (`pg_get_functiondef`). `0044`
reissues those helpers with one added condition each; keeping the previous
definitions is what makes the change reversible without a dump.

Until step 1 is done, `0042` remains the truth in production and the currently
deployed frontend (`2793a90c`) remains correct for it. Nothing in this release
has changed the live site.

## Meal Period tags: derived, and left alone

Migration `0043` (already in the repository at the start of this closure) tags
every existing Meal from **where it was actually used on menus** — evidence,
not a guess — and tags a never-used Meal for all four sittings so it stays
visible everywhere until somebody narrows it deliberately.

Those tags are **derived, not operator-confirmed**, and this closure does not
pretend otherwise and does not "clean" them. There is no way to tell, after the
fact, which tag an operator meant and which the bootstrap supplied, so nothing
rewrites them. The operating guide now says this to the person who will read
it, and points out that changing a tag costs nothing: `0045` makes a
sittings-only edit append no revision, so correcting one leaves no false entry
in the Meal's history.

## Decisions recorded

`docs/spec-pack/docs/13_DECISION_LOG.md` gains 037–042: records are
deactivated or archived and never destroyed; email is an authentication
identity; an existing password is never retrievable and a signed-in person may
change their own; a role is offered for provisioning only when it has a screen;
guardian access is ended by a Super Admin with a reason; a tag-only Meal edit
is not a new revision. Each is propagated into the requirement, rule,
permission, data-model, workflow, screen, API, security and acceptance
documents, and sixteen acceptance tests (AT-150–AT-165) each name the
assertion that proves them.

## Explicitly not done, and why

- **Packing, Dispatch, Delivery, structured Allergy/Dietary, Parent chat, AI
  and procurement** — out of scope for this task by instruction, and still out
  of scope for the MVP.
- **Permanent deletion of any core record** — refused by design, not deferred.
- **Changing an email address** — needs a synchronised Auth + profile change
  with confirmation. Not built; the field is immutable and says why.
- **Changing a role in place** — would give a live session a reach it was not
  issued for. The supported path is a new account plus a deactivation.
- **Nursery-side guardian revocation** — `NOT_YET_DEFINED`.
- **Retention and purge policy** — `NOT_YET_DEFINED`. Archive is not retention.
