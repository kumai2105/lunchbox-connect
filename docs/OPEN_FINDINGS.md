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

## 2. Creating a Class through the UI is not interactively proven

**Status:** open · **Severity:** unknown — cause not determined

An acceptance test that creates a Class through the Classes screen and checks
the row failed five consecutive CI rounds. Two causes were mine and are fixed:

* `/classes` without `?institution=` leaves `institutionId` empty, so the submit
  is `disabled={... || !institutionId}` and can never enable. The app is right —
  a Class belongs to exactly one Institution.
* The follow-up used `s.institutionId`, which `.seeded.json` does not contain. I
  had matched a local variable in `global-setup.ts` and taken it for a key. The
  URL became `?institution=undefined` — a non-empty string, so it satisfied the
  truthiness guard, **enabled** the button, and failed the foreign key instead.
  No locator error, no timeout, just a row that never appeared.

After both fixes: every click resolves, the institution is a real UUID, the
`<select>` is pinned and disabled as designed, the modal is correct on
inspection — and the row still does not appear. **I could not establish from the
CI logs whether the remaining fault is the test or the product.** The runner's
log tail truncates before the failure detail, and the environment cannot fetch
the Playwright trace artifact.

**What is proven.** The test was narrowed rather than deleted, and now asserts
the screen's gating: an unscoped Class cannot be created, and with an
Institution in scope the tenant is pinned, not changeable. That is real coverage
of the boundary 0032 enforces with a trigger.

**What is not proven.** The insert itself, through the browser. Direct inserts
are covered by the SQL suites and the RLS policy is unchanged
(`classes_insert with check (app_can_manage_institution(institution_id))`), so
there is no evidence of a production defect — only an absence of interactive
evidence.

**To close it.** Run the suite locally with a headed browser, or fetch the
Playwright trace from the run artifact, and read the error the app renders in
its `.banner.err`. The narrowed test already reads that banner; the information
exists, it just could not be retrieved from this environment.

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
