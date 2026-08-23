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

**Status:** closed 2026-08-23 · migrations `0044`/`0045` · **PENDING IN
PRODUCTION** (repo ceiling `0045`, production ceiling `0042`)
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

## 12. Deployment is blocked on an authorisation this session cannot perform — OPEN

**Status:** open 2026-08-23 · **Not a defect.** An honest statement of where
this stops.

Migrations `0043` through `0046` are in the repository, replay cleanly from
nothing, and pass 280 assertions. They have **not** been applied to
`llnofriwvnerntrbpehc`.

**Measured, not assumed.** Three separate things were checked rather than
inferred:

1. This environment cannot reach Supabase at all. `curl` to both
   `llnofriwvnerntrbpehc.supabase.co` and `api.supabase.com` returns
   `CONNECT tunnel failed, response 403` — the network policy refuses it. There
   is no Supabase CLI installed and no credentials in the environment.
2. The Supabase connector requires an interactive authorisation a background
   session cannot perform.
3. GitHub Actions **can** reach Supabase, so
   `.github/workflows/prod-apply-migrations.yml` now exists to do the apply
   there. It was run once (run `32644533164`) and failed closed at its first
   gate with `SUPABASE_ACCESS_TOKEN is not set` and `SUPABASE_DB_PASSWORD is
not set`. Both secrets are therefore **absent**, which is a fact rather than
   a belief — the same fail-closed pattern that settled the same question for
   `prod-browser-auth`.

The apply is one human action away: add those two repository secrets and
dispatch the workflow. `docs/GO_LIVE_0046.md` is the two-minute version.

**The frontend must not be deployed first**, and the reason is that the failure
would be silent rather than loud. `app_users.active` and `institutions.active`
do not exist at `0042`; `select *` returns rows without them; `undefined` is
falsy; so **every account would render as "Deactivated" and every institution
as "Archived"** on the live site, and Meal saves would fail against a missing
`meal_periods`.

The go-live sequence is in `docs/GO_LIVE_0046.md` and, in more detail, in
`docs/RELEASE_2026-08-23_LIFECYCLE_CLOSURE.md`: migrations → all three Edge
Functions → `BACKEND_READY_MIGRATION=0046` → frontend at the tested SHA →
`prod-smoke` and `prod-browser-auth` against that same SHA.

Until then `0042` remains the truth in production, and the deployed frontend
`2793a90c` remains correct for it. **Nothing in this closure has changed the
live site.**

---

## 13. A Parent with no linked child was locked inside their own account — CLOSED

**Status:** closed 2026-08-23 · `src/pages/parent/ParentShell.tsx`,
`ParentAccountCards.tsx`
**Classification:** PRODUCT defect. **Found by this closure's own gate**, on
its second run, in a state no previous test had ever created.

The Parent shell rendered the "No children are linked to this account yet"
empty state **and nothing else** — no navigation, no `Outlet`, no route. Every
Parent-portal test to date had a linked child, so the branch had never been
exercised by anything but a glance.

Two real people reach that branch: a Parent whose account is created before
their child is linked (which is the normal provisioning order — the account is
made on the Users screen, the link on the Guardians screen), and a Parent whose
guardian link has just been revoked. Both could sign in, and then do nothing at
all. They could not change their password, and **they could not sign out**,
because the sign-out control lives on the profile screen the shell would not
render.

Their own account never depended on a child, so it no longer disappears with
one. The account cards — name, phone, password, sign out — are a component used
by both the normal profile and the childless state. The empty state is still
shown, because it is true; it is simply no longer the whole screen.

Worth recording for what it says about the gate: the new lifecycle spec creates
a Parent account and then uses it, which is the first time anything had driven
a Parent with no children. The assertion now also requires the way out to be
present.
