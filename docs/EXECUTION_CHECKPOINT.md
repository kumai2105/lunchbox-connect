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
- [ ] P3 logout/session lifecycle, every active role
- [ ] P4 cancel / close / modal dismissal / back
- [ ] P5 rendered error experience
- [ ] P6 meal image flow through the UI
- [ ] P7 Super Admin parent provisioning + guardian link through the UI
- [ ] P8 active-control inventory over functional core routes
- [ ] P9 accessibility baseline
- [ ] P10 deferred-shell honesty check
- [ ] P11 absent-status presentation check
- [ ] P12 full core chain rerun
- [ ] P13 security boundary rerun
- [ ] P14 durable recovery state recorded
- [ ] P15 authoritative deploy path proven
- [ ] P16 full dynamic test inventory, 0 failed / 0 skipped / 0 flaky
- [ ] P17 deploy exact tested SHA
- [ ] P18 live acceptance at www.lunchboxconnect.com
- [ ] P19 documentation reconciled
- [ ] P20 checkpoint archived

## Proven defects found this run

1. **No visible keyboard focus** — PRODUCT (accessibility). The stylesheet had
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

_(none yet)_

## Blockers

_(appended if genuine per §40)_
