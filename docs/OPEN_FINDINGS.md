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

## 2. The apex domain does not answer

**Status:** open · **Severity:** minor

`https://lunchboxconnect.com/` returns no response; `https://www.lunchboxconnect.com/`
serves the app correctly. Someone typing the bare domain gets nothing.

Closing it needs a Cloudflare Redirect Rule sending apex → `www`. The deploy
credential available to CI is Workers-scoped and cannot create one, and the DNS
record list could not be read with it either (`Authentication error`), so the
zone's MX/SPF/DKIM/DMARC records remain **unread** — they must be enumerated
before any DNS change, not assumed absent.

---

## 3. The pre-migration snapshot has no durable home

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
