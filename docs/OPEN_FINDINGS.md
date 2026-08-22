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

| | |
|---|---|
| Institution in the UI before Save | correct |
| POST body | correct `institution_id` |
| PostgREST response | `403 {"code":"42501","message":"new row violates row-level security policy for table \"classes\""}` |
| Rows written | none |

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

## 5. `app_users_select` carries the same self-referencing shape as the two policies 0040 fixed

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
