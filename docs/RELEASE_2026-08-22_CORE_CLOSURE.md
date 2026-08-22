# Core closure — 22 August 2026

Record of the final core public-launch closure. Supersedes the working
execution checkpoint, which is archived into this document.

## Release identity

| | |
|---|---|
| Git SHA | `648d72985e4c66cbe376e33ef41eabfc68ba6c5b` |
| Branch | `claude/new-session-k5dd5u` — the branch every production deploy to date has been cut from |
| Working tree | clean, pushed |
| Commits after the released SHA | CI and documentation only — `.github/workflows/prod-browser-auth.yml`, `.gitignore`, `docs/`. **No `src/`, no `supabase/`.** The running application is unchanged. |
| Migration ceiling in repo | `0042_state_the_reads_the_policies_assume.sql` |
| Migration ceiling in production | **`0042`** — applied 2026-08-22, ledger `20260822192151` |
| Production Supabase | `llnofriwvnerntrbpehc` |
| Deployed frontend | **`9e44e786`** (deploy run `32593668941`, success) |

## Gate, dynamically derived

| Gate | Result |
|---|---|
| Browser E2E | **84 / 84** — 0 failed, 0 skipped, 0 flaky (run `32593855792`, on the released SHA `9e44e786`) |
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
