# Core closure — 22 August 2026

Record of the final core public-launch closure. Supersedes the working
execution checkpoint, which is archived into this document.

## Release identity

| | |
|---|---|
| Git SHA | `648d72985e4c66cbe376e33ef41eabfc68ba6c5b` |
| Branch | `claude/new-session-k5dd5u` — the branch every production deploy to date has been cut from |
| Working tree | clean, pushed |
| Migration ceiling in repo | `0042_state_the_reads_the_policies_assume.sql` |
| Migration ceiling in production | `0041` — **0042 NOT APPLIED** (see Blockers) |
| Production Supabase | `llnofriwvnerntrbpehc` |
| Deployed frontend | `b8ee939` (deploy run 32579334822). **This closure is NOT deployed.** |

## Gate, dynamically derived

| Gate | Result |
|---|---|
| Browser E2E | **84 / 84** — 0 failed, 0 skipped, 0 flaky (run 32591361476, job on `a02f9a0a`) |
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
| `/dashboard` and `/audit` refused to the Super Admin who owns them — `permission denied` on `v_dashboard_institutions` and `audit_log` | DATABASE (local stack reproduced; production unverified) | Migration `0042`; `verify_read_grants.sql` |
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

## Blockers (neither is a software defect)

1. **Supabase connector unavailable.** Blocks applying `0042` to production,
   reading the managed backup/PITR state, and re-reading production business
   data. Re-authorise from claude.ai connector settings.

2. **Production origin unreachable from the build session.** The egress proxy
   answers `403 CONNECT` for both `lunchboxconnect.com` hostnames — an
   organisation policy denial. `.github/workflows/prod-browser-auth.yml` runs
   the same real-browser sign-in / sign-out checks from a GitHub runner with
   open egress; it needs two repository secrets that do not exist:
   `PROD_VERIFY_EMAIL` and `PROD_VERIFY_PASSWORD`, for an account created for
   the purpose. It fails closed without them.

**Consequence.** The software half of this closure is finished and green. The
production half — apply 0042, deploy, verify live — was NOT attempted, because
performing it without being able to verify it afterwards is precisely what the
closure order forbids.

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
