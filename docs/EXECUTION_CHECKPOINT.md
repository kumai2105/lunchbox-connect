# Execution checkpoint — final core public-launch closure

INTERNAL continuation mechanism. If this run is interrupted, resume from the
last unchecked phase rather than restarting the project audit. Archived at the
end of the run.

## Starting state

| | |
|---|---|
| Starting SHA | `b8ee939dea1e8d48fb2c6b8bda2f69f51289f333` |
| Branch | `claude/new-session-k5dd5u` (production source of truth for this release) |
| Dirty at start | no |
| Migration ceiling in repo | `0041_super_admin_can_onboard_an_institution.sql` |
| Production migration ceiling | `0041` (ledger `20260822141122`) |
| Production Supabase | `llnofriwvnerntrbpehc` |
| Last deploy run | `32579334822` on `b8ee939`, success |
| Last E2E run | `32579010173` on `b8ee939`, 51/51 |
| Last prod smoke | `32579505978` on `b8ee939`, success |
| Container note | The dev container rewound to `4b8832a` twice this session; origin is authoritative. Re-checkout from origin before trusting local state. |

## Phases

- [x] P1 checkpoint established
- [x] P2 app_users_select — reproduced, proven SAFE, 12 assertions, no policy changed
- [x] P3 logout/session lifecycle — 9 roles + both shells at tablet/mobile, PASSING
- [x] P4 cancel / close / back — PASSING
- [x] P5 rendered errors — sweep of 16 core routes; found the 0042 defect
- [ ] P6 meal image flow through the UI
- [ ] P7 Super Admin parent provisioning + guardian link through the UI
- [x] P8 control inventory — accessible name, dead links, semantic disabled, PASSING
- [x] P9 accessibility — keyboard focus ring added; tab sweep PASSING
- [x] P10 deferred shells — Deliveries / Ops / Absences honest, PASSING
- [x] P11 Absent vs 100% — distinct, asserted
- [ ] P12 full core chain rerun
- [x] P13 security — 21 SQL suites green, incl. the new read-grant negatives
- [ ] P14 durable recovery state recorded
- [x] P15 deploy path — deploy.yml is the only workflow that deploys; dispatch or v* tag only; gates before deploy; fails closed on missing credentials; asserts the deploy step actually ran
- [ ] P16 full dynamic test inventory, 0 failed / 0 skipped / 0 flaky
- [ ] P17 deploy exact tested SHA
- [ ] P18 live acceptance at www.lunchboxconnect.com
- [ ] P19 documentation reconciled
- [ ] P20 checkpoint archived

## Proven defects found this run

1. **/dashboard and /audit refused to their owning role** — DATABASE.
   `permission denied for view v_dashboard_institutions [42501]` and
   `permission denied for table audit_log [42501]`, reproduced in a browser
   as a Super Admin on a clean rebuild. Policies existed; the grants that
   make them reachable did not. Fixed by 0042. Environment: reproduced
   locally; production may already permit both via Supabase platform default
   privileges — not generalised without checking.

2. **No visible keyboard focus** — PRODUCT (accessibility). The stylesheet had
   no `:focus-visible` rule at all and five selectors set `outline: none`,
   two of which (`.filters .search-box input`, `.toolbar .search-box input`)
   also drop the border, so focus was completely unindicated there. Fixed in
   `src/styles.css`. Not environment-specific.

## Findings that were NOT defects

1. **app_users_select** — the resemblance to the 0040 fault is superficial.
   `app_can_see_user()` resolves the CALLER's row, which already exists;
   the 0040 policies resolved the NEW row's id. `INSERT … RETURNING` and
   `UPDATE … RETURNING` both return their row. Proven by
   `verify_app_users_policy.sql`. No change made.
2. **`.outcome` focus suppression** — dead CSS. No component renders that
   class; the live Classroom controls are `.plate-quarter` and
   `.chip-choice button`, neither of which suppresses the outline.
3. **Absent vs 100%** — already visually distinct (pill vs circle, grey vs
   brand). Asserted rather than assumed.

## Fixes applied

_(appended as applied)_

## Migrations added

* **0042** `state_the_reads_the_policies_assume` — grants SELECT on
  `audit_log` and `v_dashboard_institutions` to `authenticated`. Reproduced
  as `permission denied` on /dashboard and /audit for the Super Admin on the
  local stack. Same class as 0041; expected to be a no-op on production.
  NOT YET APPLIED TO PRODUCTION.

## Blockers

_(appended if genuine per §40)_
