# Open findings — reported, not fixed

Things found during acceptance testing that are real, are **not** release
blocking, and were deliberately left alone because fixing them is a product
decision rather than a test repair.

---

## 1. Form inputs had no programmatic label — CLOSED

**Status:** closed 2026-08-22 · **Was:** open, minor · **Fixed in:** `src/components/ui.tsx`

`Field` rendered the caption as a `<label>` with no `htmlFor`, and the control
beside it as a SIBLING. HTML associates a label with a control by `htmlFor`/`id`
or by nesting, and by nothing else — so all 50 fields in this application were
unlabelled boxes to the accessibility tree. A screen-reader user opening Create
class heard "edit text" three times with no way to tell the name from the grade
from the institution, and voice control had nothing to address them by.

`Field` now generates an id with `useId()` and points the label at it. `useId()`
rather than a slug of the label text, because labels repeat across dialogs
("Name" appears in several) and duplicate ids would aim every one of them at
whichever control rendered first. A control that already carries its own id
keeps it and the label points at that.

**Evidence:** `acceptance.spec.ts` asserts the Create class and Meal editor
controls are reachable via `getByLabel`, which resolves through the
accessibility tree rather than the DOM — it can only find a control that is
genuinely associated with its label. The assertions fill the field and check the
value, so a label pointing at the wrong element cannot pass. Labels are read
from the pages, not guessed, and matched with `exact: true` because label
matching is substring by default.

---

## 2. Creating a Class through the UI — CLOSED, and it was a real product defect

**Status:** closed 2026-08-21 · **Severity:** was critical · **Fixed by:** `0040`

This entry recorded that the browser could not create a Class and that I could
not tell whether the fault was the test or the product. It was the product, and
the sentence in the old entry that read

> the RLS policy is unchanged
> (`classes_insert with check (app_can_manage_institution(institution_id))`),
> so there is no evidence of a production defect

was wrong in its conclusion. The INSERT policy was indeed fine. The refusal came
from the **SELECT** policy, which PostgreSQL also applies to the new row when a
statement carries `RETURNING` — and `createClass()` issues
`.insert(input).select().single()`, which is exactly that.

**What the evidence finally showed**

|                                   |                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Institution in the UI before Save | correct                                                                                             |
| POST body                         | correct `institution_id`                                                                            |
| PostgREST response                | `403 {"code":"42501","message":"new row violates row-level security policy for table \"classes\""}` |
| Rows written                      | none                                                                                                |

Reproduced on a from-scratch rebuild of every migration:

```
INSERT INTO classes (...) VALUES (...);              -> INSERT 0 1
INSERT INTO classes (...) VALUES (...) RETURNING *;  -> ERROR 42501
```

`classes_select USING (app_can_see_class(id))` re-reads `classes` by the id it
is handed. During the INSERT that row is not visible to the function's
snapshot, so the check fails and the statement rolls back — the same
self-referencing-policy defect `0015` fixed on the INSERT side and left on the
USING side. `students_select` had it too, which is why a Nursery Admin could
not create a Student.

**Why it took five rounds:** `err()` in `src/lib/api.ts` stringified every
PostgREST error to `[object Object]`, because PostgREST returns
`JSON.parse(body)` — a plain object, never an `Error`. The error was on screen
the whole time and unreadable. Fixed alongside, with
`src/lib/api.errors.test.ts` as the regression.

**Now proven interactively:** the acceptance test creates a Class through the
Classes screen and asserts the row lands in the right Institution, and
`tests/sql/verify_insert_returning.sql` asserts creation through the statement
the client actually issues, for both a Super Admin and a Nursery Admin, with
cross-tenant creation still refused.

---

## 3. The bare domain — CLOSED

**Status:** closed 2026-08-22 · verified from outside the network

`lunchboxconnect.com` and `www.lunchboxconnect.com` both resolve to the same
Cloudflare addresses and both serve the application. The read-only production
smoke suite passes against the bare domain, not only against `www`.

**What it was.** Two `A` records on the apex, `13.248.243.5` and
`76.223.105.230` — GoDaddy's website-builder servers, left over from before the
app existed. Cloudflare proxied them faithfully, so anyone typing the domain
without `www` was told "Launching Soon" while the live product sat at `www`.

**What fixed it.** Deleting those two A records, then attaching
`lunchboxconnect.com` to the Worker as a Custom Domain alongside `www`.

**Email was never touched** and is intact: MX to Microsoft 365, the
`secureserver.net` SPF include, DMARC, the Microsoft verification TXT, and the
`autodiscover` / `sip` / `lyncdiscover` / `msoid` / `email` CNAMEs.

**A note for the next person reading a Cloudflare API result here.** Through
this whole diagnosis, `GET /accounts/{id}/workers/domains` reported only
`www.lunchboxconnect.com` while the dashboard showed the apex attached as well.
The dashboard was right. That endpoint's output was treated as authoritative
and it should not have been — the screen under Workers → Settings lists Custom
Domains AND Routes together, and the API view of it proved incomplete against
the Workers-scoped token in use. Where the two disagree, check the dashboard
before concluding something is missing.

---

## 4. The pre-migration snapshot has no durable home

**Status:** open · **Severity:** moderate

`lunchbox-production-snapshot-pre-0016.json` (171,965 bytes, sha256
`f6ad6aae…896693`, 18 tables / 156 rows) is the only capture of production as it
stood before the `0016`–`0039` chain was applied.

It cannot be committed: **this repository is public**, and the file contains real
children's names. No private storage was available to write it to. It currently
exists only in an ephemeral session workspace and will be lost when that is
reclaimed. The Founder holds a copy; retention is on them.

Supabase Pro daily backups cover the project going forward, but that is a
different thing from this specific pre-migration point.

## 5. `app_users_select` carries the same self-referencing shape as the two policies 0040 fixed — CLOSED by finding 12

`app_users_select` is `using (app_can_see_user(user_id))`, and
`app_can_see_user()` re-reads `app_users` (`select institution_id from
app_users target where target.user_id = p_user`, and the linked-guardian
branch joins `app_users target` again). That is structurally the same defect
0040 corrected on `classes_select` and `students_select`: under
`INSERT ... RETURNING` the new row is not visible to the function's snapshot,
the SELECT check fails, and the whole statement is rolled back with
`42501 new row violates row-level security policy`.

**Not fixed, deliberately.** Nothing in the client inserts into `app_users` —
accounts are provisioned by the `admin-create-user` Edge Function under the
service role, which bypasses RLS entirely — so there is no reachable failure
and no reproduced defect to correct. 0040 changed only the two policies with a
demonstrated user-facing failure behind them.

**What would make this live:** any future code path that creates an
`app_users` row as `authenticated` with a readback (`.insert(...).select()`).
If that is ever added, this policy must be rewritten the same way first —
pass the row's own columns into a SECURITY DEFINER helper instead of
re-reading the row by id.

## 6. The onboarding grant depended on a platform default — CLOSED

**Status:** closed 2026-08-22 · `0041` applied to production
**Correction:** the earlier version of this entry overstated the defect

**What I claimed:** that a Super Admin could not create an Institution in
production, and every future nursery would need a developer.

**What is actually true.** Production already held the grant:

```
authenticated on institutions : INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
```

Hosted Supabase grants `ALL` on `public` tables to `authenticated` through the
platform's default privileges, so creating an Institution has always worked
there. The local CLI stack does not replicate those defaults, which is why the
same code refused the insert with `42501` on the E2E stack and the end-to-end
onboarding test could not get past step 1.

The defect was real where it was found. Generalising it to production without
checking production was my error — the same pattern as reading the Cloudflare
API instead of the dashboard earlier in the same session.

**Why 0041 still matters.** The product's permission model was resting on a
platform default rather than on anything this repository states. 0007 grants
only SELECT; 0033 adds insert/update policies that a grant must exist for. A
project restored from migrations alone, or a change to Supabase's defaults,
would silently lose the ability to onboard a nursery, and nothing in the
migration set would hint that it ever had it. 0041 states the grant explicitly:
a no-op on production today, and durable intent from here.

The boundary is unchanged — RLS still restricts both statements to
`app_is_super_admin()`, `verify_super_admin_onboarding.sql` proves a Nursery
Admin is still refused and that nobody may delete, and the E2E boundary step
fails the build if the grant ever regresses.

---

## 7. The Institution record itself could not be edited — CLOSED

**Status:** closed 2026-08-22 · UI only, no migration
**Classification:** PRODUCT OPERABILITY DEFECT

**What was wrong.** The Institution Detail Overview tab printed Name and Type
into a read-only table. There was no control anywhere in the application to
change either one. Renaming a nursery, or correcting one first recorded as a
school, therefore required a developer with database access — for one of the
most ordinary business changes there is.

The authority already existed and had for eight migrations: `0033` carries
`institutions_update` gated on `app_is_super_admin()`, and `0041` states the
matching `UPDATE` grant. Nothing in the product reached them.

**Fixed by** `updateInstitution()` and an **Edit institution** control on the
Overview tab, shown only to a Super Admin — the role the policy already names.
Deletion remains impossible for everyone, unchanged: history references
institutions, so they are archived, never destroyed.

**Proved by** the step-20 reconfiguration phase of `tests/e2e/operability.spec.ts`,
which renames the Institution and changes its type through the UI, reads both
back from the database, and puts them back.

---

## 8. A future-dated configuration change was reported as current — CLOSED

**Status:** closed 2026-08-22 · UI only, no migration
**Classification:** PRODUCT OPERABILITY DEFECT

**What was wrong.** `getInstitutionServiceConfig()` read the service plan and
the menu assignment as:

```
order by effective_from desc limit 1
```

with **no upper bound on the date**, and the Service tab printed the result as
`Current:`. The database resolver filters the same query to `effective_from <=
the date being resolved` (`resolve_rotation_week`, `service_plan_includes`, both
0016). So the moment anyone scheduled a change for a future date — the supported
way to change a package or switch menus — the screen claimed that change was
already live while the database went on resolving the older row. An operator
publishing a window on the strength of that screen would have been reading one
configuration and shipping another.

There was also no way to see, or to withdraw, a change that had been scheduled:
the tab showed one value and no history at all.

**Fixed by** replacing the single-row read with
`getInstitutionConfigTimeline()`, which returns every dated row, and
`configInEffectOn()`, the client-side mirror of the database's rule. The Service
tab now states what is **in effect today** and renders the full timeline with
each row marked **In effect**, **Scheduled** or **Superseded**. A scheduled row
can be withdrawn; a row that already governs real days cannot, and has no
control offered — withdrawing it would silently restate what those days were.

**Proved by** `src/lib/institutionConfig.test.ts` (six assertions on the
effective-dating rule, including that a future row is not in effect and that no
configuration resolves to nothing rather than to a guessed default), by
`tests/sql/verify_rotation_autoadvance.sql` sections b1–b3 at the database
boundary, and by the step-20 reconfiguration phase end to end.

---

## 9. Does the rotation anchor auto-advance? — INVESTIGATED, NOT A DEFECT

**Status:** verified 2026-08-22 · no change required

The requirement: the anchor must let the system calculate subsequent weeks
automatically, rather than requiring a rotation week to be chosen every week.

It already does, and now it is asserted rather than assumed.
`resolve_rotation_week` (0016) computes position as whole ISO weeks elapsed
since the assignment's `effective_from`:

```sql
(((anchor_week - 1) + floor(weeks_between(date, effective_from))) % week_count) + 1
```

`tests/sql/verify_rotation_autoadvance.sql` proves against the real function
that from a **single** stored anchor: nine consecutive weeks resolve correctly;
a year later it is still right; every day of an ISO week resolves to the same
week; an effective date set mid-week anchors that whole week; dates before the
anchor resolve to _nothing_ rather than to a guess; and a whole-week closure
does not shift the cycle. The "one anchor, and the weeks advance by themselves"
end-to-end test proves the consequence through the UI: a two-week menu with a
different meal in each week, assigned once, publishes three consecutive Mondays
as week 1, week 2, week 1 — and asserts that exactly one assignment row exists,
so three correct weeks cannot have come from three weekly entries.

The Service tab now says this on screen, where the operator needs it, instead of
leaving it to be inferred from a number field.

---

## 10. /dashboard and /audit were refused to the Super Admin — CLOSED

**Status:** closed 2026-08-22 · migration `0042` · **APPLIED TO PRODUCTION**
(ledger `20260822192151`)
**Classification:** DATABASE defect. Environment: reproduced on the local CLI
stack; production state checked before applying (see below).

Reproduced in a browser, signed in as a Super Admin, on a clean rebuild of
every migration:

```
/dashboard -> permission denied for view v_dashboard_institutions [42501]
/audit     -> permission denied for table audit_log [42501]
```

Both screens rendered an error banner to the role that owns them. Nothing
caught it for the life of the project because no test had ever asserted that a
core screen shows **no** error banner — only that whatever banner it showed was
readable. The route sweep added in this closure asserts the absence, and found
both on its first run.

**Cause — the same one as finding 6.** PostgreSQL checks GRANTS before RLS, so
a policy on an object no role may select from is unreachable however carefully
it is written. `audit_log` has carried RLS since `0009` with
`audit_log_select using (app_is_super_admin())` and `revoke all … from anon`,
and no grant to `authenticated` was ever stated. `v_dashboard_institutions` is
a `security_invoker` view (`0039`), so the caller needs SELECT on the view
itself.

**Fixed by `0042`**, which states both grants. Not a widening: the grant makes
the policy reachable, the policy still decides.
`tests/sql/verify_read_grants.sql` asserts both halves — a Super Admin reads
both objects, a Nursery Admin still reads zero audit rows, `anon` holds no
grant on either.

**Production status: CHECKED, then applied.** The grant state was read from the
live database before `0042` ran, and captured in
`docs/recovery/2026-08-22-pre-0042.md`.

The `authenticated` half was a **verified no-op**: both objects already carried
SELECT through Supabase's platform default privileges, so the `permission
denied` failures were real on the local CLI stack only. This is the same
pattern as finding 6, where I generalised a local failure to production and was
wrong — this time it was checked before being claimed.

The `anon` half was **real hardening**. `anon` held
`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on
`v_dashboard_institutions`, restored each of the four times
`CREATE OR REPLACE VIEW` re-applied default privileges (0006, 0023, 0031,
0033). The exposure was contained — as `anon` the view errored with
`permission denied for table institutions`, because it is `security_invoker`
and `0041` revoked that table from `anon` — but `0031` once made this same view
`security_definer` (reverted by `0039`), which is exactly the change that would
have turned it into a live leak. `anon` now holds nothing on either object, and
the permission model rests on what this repository states.

---

## 11. Keyboard focus was invisible — CLOSED

**Status:** closed 2026-08-22 · `src/styles.css`
**Classification:** PRODUCT defect (accessibility). Not environment-specific.

The stylesheet contained no `:focus-visible` rule at all, and five selectors
set `outline: none`. Two of them — `.filters .search-box input` and
`.toolbar .search-box input` — also drop the border, so a keyboard user
focusing either search box saw nothing whatsoever. Everywhere else the app
depended on the browser default ring, which is not a decision anyone made.

Fixed with one generic `:focus-visible` ring plus the named exceptions, and a
light ring inside the dark sidebar where the brand blue does not read.
`:focus-visible` rather than `:focus`, so it appears for keyboard and assistive
technology and not on every mouse click. No other visual change.

Proved by `controls.spec.ts`, which tabs through a core screen and reports
every control that takes focus without a visible indicator.

**A correction while fixing it:** my first version of this fix named `.outcome`
as "the controls the Classroom register is built around". That is wrong —
`.outcome` is dead CSS rendered by no component. The live controls are
`.plate-quarter` and `.chip-choice button`, neither of which suppresses the
outline.

---

## 12. Does `app_users_select` carry the 0040 fault? — INVESTIGATED, NOT A DEFECT

**Status:** settled 2026-08-22 · no change made

Finding 5 recorded a resemblance, not evidence. `tests/sql/verify_app_users_policy.sql`
settles it with 12 assertions: `app_can_see_user()` resolves the **caller's**
row, which always already exists, where the `0040` policies resolved the **new**
row's id. `INSERT … RETURNING` and `UPDATE … RETURNING` both return their row.

Every supported read is asserted — all seven roles reading their own row (the
login path, without which a role cannot sign in at all), the Super Admin
directory, School Admin scope including the linked-parent case and the absence
of a parent directory, a Parent and a Kitchen account each seeing exactly one
row, and the two **joined** reads the client actually issues, where a policy
failure would show as a silently blank name rather than an error.

No policy changed. No visibility widened. Finding 5 is closed by this.

---

---

## 11. The platform could create everything and end nothing — CLOSED

**Status:** closed 2026-08-23 · migrations `0044`/`0045` · **APPLIED IN
PRODUCTION** 2026-08-23 (production ceiling now `0047`)
**Classification:** DATABASE and PRODUCT. Not a defect in what the product did
— an absence of what it could do at all.

Every one of these was found by using the product as its owner, not by reading
the code:

- no account could be deactivated;
- no Institution could be archived, though the specification said in three
  places that Institutions are "archived, never destroyed";
- no Class could be archived;
- no guardian relationship could be ended, though the RBAC matrix advertised
  the authority and nothing served it;
- **no password could ever be changed by anybody after creation**, and the
  operating guide told administrators to keep a written record of every one
  they typed;
- a child's name, ID or grade could not be corrected in the product.

The shape of the cause was the same each time: a rule written down in the spec
pack, with no column in the database to hold it. `institutions` had four
columns — id, name, kind, created_at — and no state to archive into.

**Closed by `0044`** (lifecycle state, guard triggers, five functions), `0045`
(a tag-only Meal edit no longer mints a revision), three Edge Functions, and
the interface for all of it. **Proven by** `verify_lifecycle_security.sql` (35
assertions) and `lifecycle.spec.ts`, which drives the same actions through a
browser and proves a deactivated account cannot get in from a fresh context.

**Recorded as Decisions 037–042.**

---

## 12. Deployment was blocked on an authorisation this session could not perform — CLOSED

**Status:** opened and closed 2026-08-23. **Never a defect.** An honest record
of where the work stopped, and of what unblocked it.

Migrations `0043` through `0046` sat in the repository, replaying cleanly from
nothing and passing 280 assertions, with production still at `0042`.

**The block was measured, not assumed.** Three separate things were checked
rather than inferred:

1. This environment cannot reach Supabase at all. `curl` to both
   `llnofriwvnerntrbpehc.supabase.co` and `api.supabase.com` returns
   `CONNECT tunnel failed, response 403` — the network policy refuses it. There
   is no Supabase CLI installed and no credentials in the environment.
2. GitHub Actions **can** reach Supabase, so
   `.github/workflows/prod-apply-migrations.yml` was written to do the apply
   there. It ran once (run `32644533164`) and failed closed at its first gate
   with `SUPABASE_ACCESS_TOKEN is not set` and `SUPABASE_DB_PASSWORD is not
   set`. Both secrets were therefore **absent** — a fact rather than a belief,
   established by the same fail-closed pattern that settled the same question
   for `prod-browser-auth`.
3. The Supabase connector. I told the owner this "needs an interactive
   authorisation a background session cannot perform". **That was wrong**, and
   it is recorded here rather than quietly deleted: the connector was already
   authorised on the account and merely toggled off for the chat. Once it was
   toggled on, the apply ran from this session. The lesson is the one this
   project keeps relearning — check the thing, do not reason about it.

**How it was resolved.** A recovery point was captured from the live database
first (`docs/recovery/2026-08-23-pre-0043.md` — the pre-change definition of
every function `0044` reissues), then `0043`, `0044`, `0045`, `0046` were
applied in order, then the two new Edge Functions were deployed, then the
security advisor was run, which found finding 14 and produced `0047`, then the
frontend followed at the gated SHA.

`.github/workflows/prod-apply-migrations.yml` is kept. The connector worked
today; the workflow is the path that does not depend on a chat setting, and it
still fails closed without both secrets.

**Verified in production after the apply:** ledger reaches
`20260823173201 / 0047`; 11 lifecycle columns present; 10 of 10 authorization
helpers gated on `active` with 0 ungated; 12 triggers; exactly one `save_meal`
overload; 20 `meal_periods` rows backfilled; security advisors report 0 ERROR.

---

## 13. A guardian account between provisioning and linking was locked inside itself — CLOSED

**Status:** closed 2026-08-23 · `src/pages/parent/ParentShell.tsx`,
`ParentAccountCards.tsx`
**Classification:** PRODUCT defect. **Found by this closure's own gate**, on
its second run, in a state no previous test had ever created.

The Parent shell rendered the "No children are linked to this account yet"
empty state **and nothing else** — no navigation, no `Outlet`, no route. Every
Parent-portal test to date had a linked child, so the branch had never been
exercised by anything but a glance.

**There is no such thing as a childless guardian**, and the product is not
designed for one — a guardian account exists precisely so that someone can see
what their child is being served. What this describes is a TRANSIENT STATE, not
a user type, and it is reached two ways, both ordinary:

- **Between provisioning and linking.** The account is created on the Users
  screen and the child is linked on the Guardians screen. Two screens, two
  steps. For the interval between them the account exists with nothing linked —
  and that interval is the normal provisioning order, not a mistake.
- **After revocation.** Decision 041 lets a Super Admin end guardian access
  with a reason. That capability shipped in this very release. The moment it is
  used, the account is in exactly this state.

Both could sign in, and then do nothing at all. They could not change their password, and **they could not sign out**,
because the sign-out control lives on the profile screen the shell would not
render.

Their own sign-in details never depended on a child, so they no longer
disappear with one. The empty state is still correct and still shown — being
unlinked IS the truth for that account — it simply is not the whole screen any
more. The account cards — name, phone, password, sign out — are a component used
by both the normal profile and the childless state. The empty state is still
shown, because it is true; it is simply no longer the whole screen.

Worth recording for what it says about the gate: the new lifecycle spec creates
a guardian account and then uses it, which is the first time anything had driven
that intermediate state at all. Every earlier Parent-portal test started from a
fixture that already had a child linked, so the branch had never been exercised
by anything but a glance. The assertion now also requires the way out to be
present.

---

## 14. Eight new functions were executable by `anon` — CLOSED

**Status:** found and closed 2026-08-23 · migration `0047`
**Classification:** DATABASE. **A regression introduced by this closure itself**,
found by the Supabase security advisor run immediately after the apply, and
fixed before the frontend was deployed.

`0044` was careful to `revoke all ... from public, anon` on the five action
RPCs it created — `set_user_active`, `update_user_profile`,
`set_institution_active`, `set_class_active`, `revoke_guardian_access` — and
said nothing at all about the helper and trigger functions created beside them.
A PostgreSQL function created with no explicit grant carries the default
`EXECUTE` to `PUBLIC`, and `anon` is in `PUBLIC`. **The omission was the
grant.**

Eight functions were affected: `app_institution_is_active`,
`app_class_is_active`, `app_may_manage_account`,
`app_is_last_active_super_admin`, and the four `app_guard_*` trigger functions.

**What was actually exposed** — small, but real and unauthenticated. The first
two are `SECURITY DEFINER` and return a boolean, so an anonymous caller holding
a UUID could learn whether that institution or class exists and is operating; a
UUID is not a secret, it appears in URLs. `app_is_last_active_super_admin` does
not check its caller at all by design — it answers a question about the user
passed to it — and anonymous access to that question is exactly the probe this
project refuses everywhere else. The four trigger functions return `trigger`,
so PostgreSQL refuses to call them outside a trigger context and there was no
exposure in practice; they are revoked anyway, because a `SECURITY DEFINER`
function nothing may call should say so rather than lean on a second rule.

**Why revoking is safe was checked, not assumed.** No RLS policy and no CHECK
constraint references any of the eight (queried against `pg_policies` and
`pg_constraint` on the live database before writing the migration); they are
called only from inside other `SECURITY DEFINER` functions, which execute as the
function owner and never consult the caller's `EXECUTE` privilege; and trigger
firing does not check `EXECUTE` either — `CREATE TRIGGER` needs privileges, the
trigger going off does not.

This is the same class of finding as `0042`, from the opposite direction: that
one was a policy made **unreachable** by a missing grant, this is a function
made **reachable** by an unstated one. Both follow from the same fact —
PostgreSQL decides `EXECUTE` and `SELECT` privileges before any policy is
consulted — and the lesson is identical: **state the grant, never inherit it.**

**Verified:** after `0047`, `anon` holds `EXECUTE` on none of the fourteen
functions in this batch, and the advisors report 0 ERROR.

**Still open, and not mine** — reported rather than silently fixed, because
touching them is outside what this closure was asked to do. After `0047` the
advisors return **98 WARN, 0 ERROR**, and the arithmetic closes exactly: 47
`SECURITY DEFINER` functions were anon-executable before `0047`, 8 were this
batch's, and revoking those 8 leaves the **39** still reported. Three functions
(`app_is_api_client`, `set_updated_at`, `touch_updated_at`) also carry
`function_search_path_mutable`. All of these predate this work and should be
swept in a dedicated pass with its own evidence, not folded into a release.

The other 56 warnings are `authenticated_security_definer_function_executable`,
10 of which **are** this batch's, deliberately: an authenticated caller has to
be able to invoke `set_user_active` — the function then decides whether that
caller may proceed. Revoking it would delete the feature, not secure it. None of
the four trigger functions appears in that list, which is how `0047`'s
`revoke ... from authenticated` is confirmed to have taken.

---

## 15. The service-role secret was assumed rather than proven — CLOSED

**Status:** closed 2026-08-23 · `.github/workflows/prod-verify-edge-secrets.yml`
**Classification:** EVIDENCE gap. Not a defect — a claim that had been carried
on plausibility instead of measurement.

The 0043–0047 release shipped with one item written down as unverified: whether
`SUPABASE_SERVICE_ROLE_KEY` was actually present as a function secret for
`admin-set-password` and `admin-set-active`. The reasoning for believing it was
sound — Supabase injects that variable into Edge Functions by default, and
`admin-create-user` reads the same variable and had been working in production
for weeks — but that is an inference about a platform, not an observation of
this project, and the authoring environment cannot reach `*.supabase.co` to
settle it.

**It is now proven, and without touching any data.** Both functions read their
environment *before* they read the caller:

```ts
if (!url || !serviceKey || !anonKey) return bad('missing server env', 500);
if (!token)                          return bad('missing bearer token', 401);
```

That ordering is what makes an unauthenticated request diagnostic. A missing
secret answers `500 missing server env` before the token is ever examined; a
present one falls through to `401 missing bearer token`. Reaching the 401 means
the function booted, read all three variables, found all three non-empty, and
only then refused the caller.

Both functions answered **`HTTP 401 {"error":"missing bearer token"}`**, and
both answered the CORS preflight with **`HTTP 200`** — the latter mattering
independently, because `verify_jwt` is false on both precisely so the platform
does not reject the `OPTIONS` request, which carries no Authorization header,
before the function runs.

**Evidence:** run `32657668778` on `80be6e39`. Every request carried no
credential and was refused before a row was read or written, so the probe is
read-only by construction rather than by convention, and left nothing to clean
up. The workflow fails closed on any other outcome — including a request that
does not complete, because a probe that never reaches the env check tests
nothing.

**The rest is now proven too.** The whole flow was driven against the
production origin by run `32658948747`: new password accepted at the auth API
and in a fresh browser context, old password rejected in both, role and scope
unchanged, and the audit row carrying `{"password_reset": true}` and no value.
A disposable `classroom_staff` fixture was created by the run and deactivated
by it; no persona was touched. See the release record for the full table.

## 16. One new advisor warning: `app_special_meal_reference` has no `search_path` — CLOSED

**Status:** closed 2026-08-26 · **Fixed in:** `0054_operability_closure.sql`

Closed as described below — a one-line `create or replace` adding
`set search_path = public`, body unchanged, inside the migration this release
needed anyway. `0049` was not edited.


The post-apply advisor run on production (`32912959791`, 25 August 2026) came
back with **0 errors**, which is the release bar. Three warning counts moved,
and two of them are the release working as intended:

| Rule | Before | After | Reading |
| --- | --- | --- | --- |
| `anon_security_definer_function_executable` | 39 | **39** | Unchanged. Not one of the 47 functions `0048`–`0053` adds is reachable by `anon`. This is the `0047` class of defect proven absent rather than assumed. |
| `authenticated_security_definer_function_executable` | 56 | 104 | The new definer functions, callable by `authenticated`. That is what they are for. |
| `function_search_path_mutable` | 3 | **4** | One new function. This finding. |

The new one is `app_special_meal_reference(uuid)` in `0049`:

```sql
create or replace function app_special_meal_reference(p_id uuid)
returns text language sql immutable as $$
  select 'SM-' || upper(substring(replace(p_id::text, '-', '') from 1 for 6));
$$;
```

**Why it is not urgent.** It is not `SECURITY DEFINER`. It runs as the caller,
touches no table, and calls only `upper`, `substring` and `replace`. The
release rule — every SECURITY DEFINER function carries an intentional
`search_path` — is not violated, and the other 46 functions this release adds
all set it. The worst a caller could do by shadowing one of those built-ins in
their own search path is mislead themselves about a reference string; there is
no path to another user's data and no privilege to escalate.

**Why it is still recorded.** It is a warning this release introduced, on a
function that has no reason to lack the setting, and "we knew and said nothing"
is how the eight anon-executable functions in `0043`–`0046` happened.

**Why it was not fixed in place.** `0049` is applied to production. Editing an
applied migration is forbidden, and rightly — the file has to keep saying what
was actually run. The fix is a one-line `create or replace` in a future
migration, alongside whatever else that migration carries. It did not justify
opening `0054` on its own at the end of this release.

---

## 17. The Kitchen's production table does not name the site — OPEN, MINOR

`Kitchen production → Production and packing` lists one row per Final Demand,
with columns Sitting · Required · Production · Packing · Actions. It does not
say which **institution** each row belongs to.

With one site operating it reads perfectly. With two, a Kitchen operator sees
two rows both labelled "Lunch" with no way to tell them apart, and the only
distinguishing information — the quantity — is exactly the thing that could
legitimately be equal.

Everything above this table is correctly aggregated across sites on purpose:
the *make list* sums a meal revision over every site that serves it, because
that is what a kitchen cooks to. The production and packing table is the
opposite — it is per site and per sitting — so the missing column is a real
omission rather than a deliberate aggregation.

**Not fixed here.** It was found while making the closure browser test
deterministic (the test asserts the row count it expects before clicking, so it
can never advance another site's day), and it is not one of the operability
gaps this release was asked to close. It changes no rule, no authorization and
no number — a Kitchen user may already read every one of these rows. It is one
column on one table whenever this screen is next opened.

---

## 18. Cloudflare's Git integration builds on every push — confirm it is preview-only — OPEN, TO CONFIRM

Every push to `claude/new-session-k5dd5u` triggers a Cloudflare Workers build,
which comments on PR #1 with "Deployment successful" and two URLs:

```
https://<commit-hash>-lunchbox-connect.koumai-2105.workers.dev
https://claude-new-session-k5dd5u-lunchbox-connect.koumai-2105.workers.dev
```

Both are **preview aliases**. Cloudflare Workers Builds deploys to the
production route only from the configured production branch, and this is not
that branch — so the expectation is that these builds never touch
`www.lunchboxconnect.com`.

**Why it is worth confirming rather than assuming.** If that integration ever
did publish to the live route, it would push a frontend ahead of its backend
on every commit — precisely the ordering this project treats as
non-negotiable, because absent columns and functions read back as `undefined`,
which is falsy. The repository's own deploy path is protected against this:
`deploy.yml` has a backend-readiness gate that refuses to ship when
`BACKEND_READY_MIGRATION` is lower than the highest migration in the tree. The
Git integration sits outside that gate.

**Evidence it is preview-only.** The integration has been active across the
whole of the previous release, yet the live site still required a dispatched
`deploy.yml` run to change, and was verified at `0053` afterwards by
`prod-smoke` and `prod-browser-auth`. `wrangler.jsonc` declares no routes at
all, so the custom domain is bound in the dashboard rather than by a push.

**Not confirmed from inside the build sandbox**, whose egress cannot reach
`www.lunchboxconnect.com` (`curl` returns status 000).

**And `prod-smoke` does not answer it either** — checked, rather than assumed.
Run `32919575952` passed every check, but its `APP` is
`https://lunchbox-connect.koumai-2105.workers.dev`: the Worker ORIGIN, not the
custom domain. It proves the backend boundary holds (twelve anonymous probes
refused 401, `admin-create-user` refuses without a JWT, the bundle targets the
right project and carries no service-role material) and says nothing about
which commit's bundle `www` is serving.

To actually settle it, compare the asset filename served by
`https://www.lunchboxconnect.com/` against the one built by the last
DELIBERATE deploy. If they differ, the Git integration is publishing live and
must be pointed at the production branch or disabled — the backend-readiness
gate in `deploy.yml` must not be bypassable by a push. Note that the question
becomes moot for this release the moment the frontend is deployed on purpose,
because the live bundle is then the one that was chosen; the finding is about
whether it could drift again afterwards.
