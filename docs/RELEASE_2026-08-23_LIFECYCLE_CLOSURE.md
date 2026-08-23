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
| Migration ceiling in repo AFTER    | `0047_new_helpers_are_not_anon_reachable.sql`                     |
| Migration ceiling in production    | **`0047`** — applied 2026-08-23, see below.                       |
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

## DEPLOYED — 23 August 2026

**Migrations `0043` through `0047` are applied to `llnofriwvnerntrbpehc`.** The
two new Edge Functions are ACTIVE. The frontend was deployed last, from the
exact SHA this gate ran against.

### How the block was cleared

This environment cannot reach Supabase directly — `curl` to both the project
and `api.supabase.com` returns `CONNECT tunnel failed, response 403`, and there
is no CLI installed. `.github/workflows/prod-apply-migrations.yml` was written
to do the apply from GitHub Actions instead; it ran once and failed closed,
proving `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` were both absent.

The apply finally ran through the **Supabase connector**, from this session,
once the owner enabled it for the chat. I had said the connector needed an
interactive authorisation no background session could perform; that was wrong —
it was already authorised and merely toggled off. The correction is recorded in
`docs/OPEN_FINDINGS.md` finding 12 rather than quietly dropped.

The workflow is kept regardless: it is the path that does not depend on a chat
setting, and it still fails closed without both secrets.

### The order it was done in, and why that order

**The frontend could not go first.** The failure would have been silent rather
than loud: `app_users.active` and `institutions.active` do not exist at `0042`,
so `select *` returns rows without them, `undefined` is falsy, and **every
account would have rendered as "Deactivated" and every institution as
"Archived"** on the live site, while `meal_periods` 404s would have failed every
Meal save.

1. **Recovery point captured first** — `docs/recovery/2026-08-23-pre-0043.md`
   records the pre-change definition of all eleven authorization helpers `0044`
   reissues and of the 8-argument `save_meal` that `0043` drops. That is what
   makes the batch reversible without a data dump. Nothing in it drops a
   column, a table or a row.
2. **`0043`, `0044`, `0045`, `0046` applied**, in order.
3. **Edge Functions deployed** — `admin-set-password` and `admin-set-active`,
   both now `ACTIVE` at version 1 with `verify_jwt: false` (they authenticate
   themselves and must answer the CORS preflight, which carries no
   Authorization header). `admin-create-user` was deliberately **not**
   redeployed: it was already working in production and a release is not the
   time to reissue something that is not being changed.
4. **The security advisor was run** — and found a regression this closure had
   introduced: eight helper and trigger functions created by `0043`–`0046` had
   inherited PostgreSQL's default `EXECUTE` to `PUBLIC`, so `anon` could call
   them. That is `0047`, and it is written up in full as finding 14.
5. **`0047` applied**, and the advisors re-run: **0 ERROR**.
6. **Frontend deployed** with `BACKEND_READY_MIGRATION=0047`, from a tree
   proven byte-identical to the gated SHA — no `src`, `index.html`,
   `package.json`, Vite, Wrangler or Worker file differs.
7. **`prod-smoke` and `prod-browser-auth`** run against that same SHA, both
   green — run `32655450892` and run `32655454452`, each on `1626bba3`.
   `prod-smoke` is strictly read-only (every request a GET) and re-downloads
   the deployed bundle to check it targets the right Supabase project, ships no
   `service_role` material and carries none of the project's internal
   vocabulary. `prod-browser-auth` drives a real Chromium through sign-in and
   sign-out against `https://www.lunchboxconnect.com` and asserts a protected
   route is refused afterwards.

### Verified in production after the apply

| Check | Result |
| --- | --- |
| Migration ledger | `20260823173201 / 0047_new_helpers_are_not_anon_reachable` |
| Lifecycle columns | **11 added** by `0044` — 4 on `app_users` (`active`, `deactivated_*`), 4 on `institutions` and 3 on `classes` (`archived_*`). `classes.active` already existed and is untouched. |
| Authorization helpers gated on `active` | **10 of 10**, 0 ungated |
| New functions · triggers | 10 · 12 |
| `save_meal` overloads | exactly **1** (the 8-arg form is gone, so no ambiguity) |
| `meal_periods` backfill | 20 rows |
| Security advisors | **0 ERROR** |
| `anon` EXECUTE on this batch's 14 functions | **none** |
| `admin-set-password` · `admin-set-active` | both `ACTIVE`, version 1, `verify_jwt: false` |
| `admin-create-user` | `ACTIVE`, version 2 — **not** redeployed, unchanged by this release |
| Frontend deploy | run `32655321609`, all 13 steps green, backend gate `0047` |
| Live smoke · live browser auth | run `32655450892` · run `32655454452`, both green on `1626bba3` |

### Reported, not fixed

The advisors return **98 WARN and 0 ERROR**. The arithmetic closes exactly:
**47** `SECURITY DEFINER` functions were anon-executable before `0047`, **8** of
them were created by this batch, and `0047` revoked those 8 — leaving the **39**
`anon_security_definer_function_executable` warnings the advisor still reports.
**Not one of them is from this work.** Three functions (`app_is_api_client`,
`set_updated_at`, `touch_updated_at`) also carry `function_search_path_mutable`;
those predate this work too.

The remaining 56 warnings are `authenticated_security_definer_function_executable`,
and 10 of those **are** this batch's — every action RPC plus the four predicate
helpers. That is the intended design, not an oversight: an authenticated caller
must be able to invoke `set_user_active`, and the function decides for itself
whether that particular caller may proceed. Revoking it would remove the
feature. The four trigger functions are absent from this list, which is the
check that `0047`'s `revoke ... from authenticated` took effect.

The pre-existing items belong in a dedicated pass with its own evidence, not
folded into a release — see finding 14.

### The one thing not directly confirmed

`SUPABASE_SERVICE_ROLE_KEY` was not read back as a function secret — the
tooling available here lists Edge Functions but not their secrets, and this
environment cannot reach the project over the network to exercise them.

It is very probably present: Supabase injects it into Edge Functions as a
platform default, and `admin-create-user` reads the same variable and has been
working in production since before this release. But "very probably" is not
"verified", so it is written down here rather than counted as evidence.

**How to settle it in ten seconds:** sign in as a Super Admin, open Users, and
use Set password on a disposable account. If the key were missing the function
would answer `missing server env` with a 500. Any other outcome — success, or a
refusal naming an authorization rule — proves the key is there.
