# Open findings — reported, not fixed

Things found during acceptance testing that are real, are **not** release
blocking, and were deliberately left alone because fixing them is a product
decision rather than a test repair.

---

## 1. No form input has a programmatic label (accessibility)

**Status:** open · **Severity:** minor · **Found:** 2026-08-21, acceptance pass

`src/components/ui.tsx`:

```tsx
export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}          {/* the input is a SIBLING */}
    </div>
  );
}
```

The `<label>` has no `htmlFor`, and the control is not nested inside it. HTML
associates a label with a control by one of those two mechanisms and no other,
so **no input built with `Field` has a label as far as the accessibility tree is
concerned**.

**Who it affects.** Anyone using a screen reader hears an unlabelled edit field
and has to infer its purpose from surrounding text. It affects every form in the
product, because every form uses `Field`: staff provisioning, class creation,
meal authoring, menu creation, institution editing.

**How it surfaced.** An acceptance test used Playwright's `getByLabel('Full
name')` on the staff provisioning form and timed out. The test was rewritten to
scope by the `.field` wrapper; the underlying gap was left in place.

**Why it was not fixed here.** `Field` is shared UI on every form in the
application. Changing it touches every screen at once, which is exactly the kind
of change the release rules require a reproduced defect, an impact assessment
and its own regression evidence for. It also has no approved specification
behind it — no accessibility requirement is recorded in the spec pack — so
implementing one unprompted would be inventing scope.

**The likely fix, when it is decided.** Give `Field` a generated id, pass it to
the child control, and point the label at it with `htmlFor`. Roughly ten lines
in one component. It would also let the test suite address form fields the way a
user does, by their visible label.

**Not decided:** whether accessibility conformance is a target for this product,
and to what standard. That is a Founder decision, and `NOT_YET_DEFINED` until
one is taken.

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

## 3. The apex domain does not answer

**Status:** open · **Severity:** minor

`https://lunchboxconnect.com/` returns no response; `https://www.lunchboxconnect.com/`
serves the app correctly. Someone typing the bare domain gets nothing.

Closing it needs a Cloudflare Redirect Rule sending apex → `www`. The deploy
credential available to CI is Workers-scoped and cannot create one, and the DNS
record list could not be read with it either (`Authentication error`), so the
zone's MX/SPF/DKIM/DMARC records remain **unread** — they must be enumerated
before any DNS change, not assumed absent.

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
