# Core closure — 22 August 2026

Record of the final core public-launch closure. Supersedes the working
execution checkpoint, which is archived into this document.

## Release identity

| | |
|---|---|
| Git SHA | `e1f9d7b4` — deployed |
| Branch | `claude/new-session-k5dd5u` — the branch every production deploy to date has been cut from |
| Working tree | clean, pushed |
| Migration ceiling in repo | `0042_state_the_reads_the_policies_assume.sql` |
| Migration ceiling in production | **`0042`** — applied 2026-08-22, ledger `20260822192151`, unchanged by this release |
| Production Supabase | `llnofriwvnerntrbpehc` |
| Deployed frontend | **`e1f9d7b4`** (deploy run `32600442731`, success) — supersedes `fc2e4c57`, `2e03b842` and `9e44e786` |

## Gate, dynamically derived

| Gate | Result |
|---|---|
| Browser E2E | **84 / 84** — 0 failed, 0 skipped, 0 flaky (run `32600192293`, on the released SHA `e1f9d7b4`) |
| SQL suites | **21 suites, 223 named assertions**, 0 failures |
| Authorization matrix | **520 checks**, all pass |
| Unit tests | **122**, 13 files |
| TypeScript | app + node + e2e, all pass |
| ESLint | pass |
| Production build | pass |

Suite growth this closure: 51 → 84 browser tests, 19 → 21 SQL suites,
207 → 223 assertions.

## What this closure fixed

| Defect | Layer | Evidence |
|---|---|---|
| `/dashboard` and `/audit` refused to the Super Admin who owns them — `permission denied` on `v_dashboard_institutions` and `audit_log` | DATABASE (reproduced on the local stack; production checked before applying — the `authenticated` half was a verified no-op there, the `anon` revoke was real) | Migration `0042`; `verify_read_grants.sql` |
| Keyboard focus had no visible indicator anywhere; two search inputs showed nothing at all on focus | PRODUCT (accessibility) | `src/styles.css`; `controls.spec.ts` tab sweep |

Both were found by assertions added in this closure, not by inspection.

## What this closure PROVED that was previously unproven

* **Session lifecycle, all nine active roles** — sign in, sign out, stored
  token cleared, protected route refused, reload stays out, Back does not
  restore, sign in again works. Both shells re-proven at tablet and mobile.
  Previously: control present for 3 of 9, session end for 1 of 9.
* **Cancel / close / Back** — each asserts the row does NOT exist, not merely
  that a dialog closed. Previously: never tested.
* **Rendered errors** — sixteen core routes swept; any error banner must be
  readable AND absent. Previously: source-level only.
* **Meal image flow** — upload, object in bucket, render after reload, private
  bucket refuses anonymous readers, and the historical revision keeps its own
  image after the Meal is edited. Previously: never driven through a browser.
* **Super Admin parent provisioning** — account on /users, guardian link on
  /guardians, parent sees their own child and not the second child in the same
  class, cannot forge a link, Nursery Admin not offered the control.
* **Control inventory** — every visible interactive element on every core
  route has an accessible name; no dead links; disabled means semantically
  disabled. Previously: explicitly not inventoried.
* **Deferred shells are honest** — Deliveries, Ops and Absences each say the
  functionality is undefined, offer no action implying business functionality
  they lack, render navigation and sign-out, and can be left.
* **`app_users_select` is safe** — settled with 12 assertions rather than
  rewritten on resemblance. No policy changed.

## Production release — executed

| Step | Result |
|---|---|
| Recovery point captured | `docs/recovery/2026-08-22-pre-0042.md`, in the repository |
| `0042` applied | success · ledger `20260822192151` |
| Grants after | `anon` holds **nothing** on `audit_log` or `v_dashboard_institutions`; `authenticated` retains SELECT |
| Advisors after | **0 ERROR**, 89 WARN — the same two known families, unchanged |
| Data after | 2 institutions · 4 classes · 11 students · 1 service plan · 1 rotation assignment · 10 accounts · 20 meals · 4 historical serving records — **unchanged** |
| Deploy | run `32593668941`, success, on `9e44e786` |
| Production smoke | run `32593859578`, success |
| Production diagnostic (both hostnames, 8 routes, bundle identity, anonymous reads) | run `32594278876`, success |

### What 0042 actually did to production

Checked before applying, not assumed. The `authenticated` half was a **verified
no-op**: both objects already held SELECT via Supabase platform defaults, so
the `permission denied` failures were local-stack only — exactly as the
migration text predicted, and this time confirmed before being claimed.

The substantive change was the **`anon` revoke**. `anon` held
`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on
`v_dashboard_institutions`, restored every time `CREATE OR REPLACE VIEW`
re-applied default privileges across four recreations. The exposure was
**contained** — verified directly, as `anon` the view errored with
`permission denied for table institutions`, because the view is
`security_invoker` and `0041` revoked that table from `anon`. That containment
was a second layer, and `0031` once made this same view `security_definer`
(reverted by `0039`) — the exact change that would have turned it into a live
leak. `anon` now holds nothing.

## Production browser authentication — VERIFIED

The last open item was that nothing had driven a **real browser** through
sign-in and sign-out against the live origin. The browser suite proves the full
session lifecycle for nine roles, but against an ephemeral local stack by
design — seeded E2E must never touch production — so "login works in
production" rested on the shell returning 200 and on the local suite passing.
That is an inference, not evidence.

`.github/workflows/prod-browser-auth.yml` now closes it. Run
[`32596895985`](https://github.com/kumai2105/lunchbox-connect/actions/runs/32596895985)
launched Chromium against `https://www.lunchboxconnect.com` with one
verification account and passed every assertion:

| # | Assertion against the live origin | Result |
|---|---|---|
| 1 | `/login` renders the sign-in form | PASS |
| 2 | Signing in lands on the role's own first page (`/reports`) | PASS |
| 3 | A session is stored in the browser | PASS |
| 4 | A hard refresh keeps the session | PASS |
| 5 | Signing out returns to the login screen | PASS |
| 6 | No session remains in the browser after sign-out | PASS |
| 7 | A protected route is refused after sign-out | PASS |
| 8 | A reload after sign-out restores no session | PASS |
| 9 | The protected route is still refused after that reload | PASS |
| 10 | Signing in again works after signing out | PASS |

No console errors were reported during the run. The job writes nothing and
records nothing; it reads two screens. It fails closed without
`PROD_VERIFY_EMAIL` and `PROD_VERIFY_PASSWORD`, so it can never report success
having skipped the point — run `32595840227` demonstrated exactly that before
the secrets existed. No real user's password was reset to run it.

Two earlier runs failed on the harness, not the product, and both are recorded
here because the distinction matters:

* `32596453136` — `ERR_MODULE_NOT_FOUND`. The step wrote the script to `/tmp`
  and Node resolves ESM imports relative to the script's own directory, so
  `playwright` was not on the path. Fixed by writing it inside the checkout.
* `32596783343` — reached production and passed sign-in, storage, refresh and
  sign-out, then failed two checks. Both assertions were wrong: the landing
  path was recorded as `/` (the router's `Home` element, before it resolves the
  role and redirects onward), and the post-sign-out checks read the URL at
  `domcontentloaded`, before the app had hydrated and could redirect. The guard
  itself was never at fault.

**This item is closed. No blocker remains.**

## Follow-up release `2e03b842` — the account model, stated

The Founder confirmed the account model: **accounts are administrator-issued**.
The administrator sets the password when creating the account and tells the
person. No invitation email, no self-registration, no self-service reset.

The software already worked that way — all three provisioning screens take a
password typed by the administrator — but it described itself as something
else. Every one of them labelled the field "Temporary password" and instructed
the administrator that "the user signs in and should change it". `src/lib/auth.tsx`
exposes `signIn` and `signOut` and nothing more: there is no change-password
screen, no forgot-password link, no account screen. The copy told a nursery
admin to tell their staff to do something that does not exist.

Corrected on all three screens (`UsersPage`, `StaffPage`,
`InstitutionDetailPage`): the field is "Password", no email is sent, there is no
self-service reset, keep a record of what you set. The same three banners cited
`BLOCKED_BY_SPEC` on email self-activation, which reads as an open question —
the question is now decided, so they state the model instead. `BLOCKED_BY_SPEC`
is untouched everywhere it is still true: guardian linking, the structured
allergy/dietary model, Kitchen actions, the Reports scope note.

The two code comments and the `admin-create-user` comment that originated the
word "temporary" were corrected with them.
`docs/SUPER_ADMIN_OPERATING_GUIDE.md` gained an **Accounts and passwords**
section: the three screens that create accounts, why the password must be
recorded, and the Supabase dashboard steps for issuing a new one.

Copy, comments and documentation only — no behaviour, no schema, no policy, no
migration. Two E2E specs addressed the renamed field by its label and were
updated with it.

| Verification | Result |
|---|---|
| Typecheck · lint · 122 unit tests · build | pass |
| Browser E2E on `2e03b842` | run `32597678520` — 84/84, "every test executed, 0 failed, 0 skipped" |
| Deploy | run `32597938339`, success |
| Production smoke | run `32597992480`, success |
| Production browser sign-in/sign-out | run `32597995886`, success |

## Follow-up release `fc2e4c57` — the internal vocabulary is not the customer's

Reported from a phone, on the public sign-in page: a block headed **ROLES IN
THE SYSTEM** listing all nine role identifiers as chips — `SUPER_ADMIN`,
`CLASSROOM_STAFF`, `DRIVER` and the rest — under a line reading "Nine approved
role domains (docs/02) — some scopes are still NOT_YET_DEFINED in the spec".

None of it helps anyone sign in. It published the platform's internal structure
to anyone who opened the URL, cited a document only this project holds, and told
prospective customers which parts of the product are unfinished. Removed
entirely.

The same vocabulary had spread across the product, so this was a sweep:

| Screen | Was | Now |
|---|---|---|
| Deliveries · Ops log · Absences · Reporting shells | "NOT_YET_DEFINED in the approved specification pack (docs 04/05)" | "not available yet", plus what the area will cover |
| Kitchen | "counts only (§56)… (§35)… BLOCKED_BY_SPEC" | plain sentences |
| Guardians | "BLOCKED_BY_SPEC and not yet defined" | "not available yet" |
| Institution detail | "NOT_YET_DEFINED in the spec pack" | "not available yet" |
| Audit log | "(docs/04 §43)" | "who changed it · when" |
| Classes | "(docs/04 §8)" | removed |
| Meal performance | every row's Classification rendered `NOT_YET_DEFINED` | "Not rated", with the banner explaining the judgement is the reader's |
| Status · Dashboard · Student profile | `ACTIVE_BILLABLE_TO_NURSERY` as button, caption and option | "Mark billable — eligible to be served" |
| Users table and role dropdown | `.toUpperCase()` of the stored role | readable names via the new `src/lib/roleLabel.ts` |
| Users banner · missing-config screen | "seeded via the SQL editor (runbook step 7)" | plain explanation |

Display only. Stored values are untouched — the database still holds
`ACTIVE_BILLABLE_TO_NURSERY` and `classroom_staff`; only what a person reads
changed. `STATUS_LABEL`, which existed solely to print the raw enum, is gone;
nothing referenced it.

**Proved on the file that actually ships, not by reading the source.** The built
bundle was grepped for `NOT_YET_DEFINED`, `BLOCKED_BY_SPEC`, any `docs/`, `AT-`
or `§` reference, "runbook", "spec pack" and the raw role identifiers: zero
matches. `90e25830` then moved that assertion into `prod-smoke.yml`, which
already downloads the deployed bundle to check its backend target and the
absence of `service_role` material — so every future smoke run fails, naming the
token, if any of it returns. Verified against **both** origins: run
`32599362961` on the `workers.dev` address and run `32599405379` on
`https://www.lunchboxconnect.com`.

| Verification | Result |
|---|---|
| Typecheck · lint · 122 unit tests · build | pass |
| Browser E2E on `fc2e4c57` | run `32598996896` — 84/84, 0 failed, 0 skipped |
| Deploy | run `32599217686`, success |
| Production smoke (workers.dev) | run `32599362961`, success |
| Production smoke (www, with the vocabulary guard) | run `32599405379`, success |
| Production browser sign-in/sign-out | run `32599275081`, success |

Three E2E assertions read the old strings — the role option list, the
eligibility button, the deferred-shell wording — and moved with them. A unit
test now asserts the classification label never carries an internal token, since
that string renders on a screen a customer reads.

## Follow-up release `e1f9d7b4` — the official logo, and the school assumption

**The logo.** The supplied file was a 896x1200 PNG in **RGB mode with no alpha
channel**: what looked like a transparent background was a grey/white
checkerboard baked into the pixels as real colour — 11px squares alternating
(203,203,203) and (255,255,255), verified by sampling. Placed as supplied it
would have put the logo on a chequered rectangle on the public sign-in page, so
"preserve the transparent background" could not be met as written.

The checkerboard was removed to true alpha and nothing else was touched. A
connected-region pass marks a light area transparent only when it contains the
checkerboard's grey squares, so an enclosed counter inside a letter is cleared
while genuinely white artwork is kept (7 such pixels were). Every artwork pixel
is byte-identical to the file supplied — not redrawn, recoloured, regenerated,
filtered, stretched or cropped — then trimmed to the artwork bounding box,
708x458, original proportions intact. The source is a lossy export, so faint
compression noise around the letterforms is inherent to it; a vector or true
transparent PNG would be sharper and is a one-file swap.

| Placement | Size | Note |
|---|---|---|
| Login screen (and the account-not-provisioned and missing-configuration cards) | 72% width, capped 260px, centred | Replaces the "LC" square and text lockup — showing both prints the wordmark twice |
| Authenticated sidebar, desktop | 200x134 | Smaller than the login placement. On the smallest white plate that gives the artwork contrast against the sidebar navy; the logo is **not** recoloured |
| Sidebar below 900px | full logo hidden | The rail is 64px; the lockup there would be ~40px and illegible, and padding it out would take tappable navigation width. The compact mark stands in |
| Favicon | unchanged | |

Width is capped with `height: auto` throughout, so the aspect ratio holds at
every breakpoint and the artwork cannot overflow its container. The asset lives
at `src/assets/lunchbox-connect-logo.png`, imported so Vite emits it
content-hashed — there was no prior asset convention, the repository had no
`public/` directory and no images at all.

**The school assumption.** An institution is a nursery **or** a school, and the
product sells into nurseries. Two places assumed otherwise:

* The sign-in screen told every visitor "Accounts are created by your school's
  administrator" — telling a nursery manager, on the first screen they see, that
  this software is not for them. Now "your institution's administrator", matching
  the heading above it.
* **Add institution** opened with Type pre-set to **School**, so anything created
  by clicking straight through was a school. It now opens on Nursery, which is
  also the first option in the list.

The Institutions banner read "Every school or nursery"; nursery comes first now,
as it does everywhere else. Both option lists already ordered Nursery before
School and are unchanged. Stored values, the `kind` enum and every permission
are untouched.

| Verification | Result |
|---|---|
| Typecheck · lint · 122 unit tests · build | pass |
| Browser E2E on `e1f9d7b4` | run `32600192293` — 84/84, 0 failed, 0 skipped |
| Real Chromium at 1440x900, 820x1180, 390x844 | no horizontal overflow at any size; **Log out** measured visible and on-screen at all three; sidebar logo 200x134 on desktop and correctly absent from the 64px rail |
| Deploy | run `32600442731`, success |
| Production smoke on `www.lunchboxconnect.com` | run `32600501387`, success |
| Production browser sign-in/sign-out | run `32600510742`, success |

No Supabase, migration, RLS, authentication, business-logic, route or permission
change in this release.

## Deployment path

`deploy.yml` is the only workflow that can deploy. It fires on
`workflow_dispatch` or a `v*` tag only; runs typecheck, lint, unit tests and
build in the same job before deploying; requires an explicit
`backend_ready_migration` input; fails closed when Cloudflare credentials are
absent; and asserts the deploy step actually executed. `ci.yml`,
`e2e-local-supabase.yml`, `prod-smoke.yml`, `prod-diagnose.yml` and
`prod-browser-auth.yml` contain no deploy action.

## Deliberately not built

Structured dietary/allergy workflow, special-meal approvals, production
lock/finalisation, packing, labels, dispatch, delivery, proof of handover,
delivery issues, cold chain, batch/lot, operational reconciliation, parent
questions/support, payments, AI, native apps. These are undefined in the
specification pack and were not invented.
