# Verification — Decision 033 (Master Operating Logic Lock)

Executed against the **live** Supabase project `llnofriwvnerntrbpehc` on
`2026-08-19`, after migration `0016_operating_logic_lock.sql` was applied.

Every result below is actual query output, not an expectation. Tests that mutate
data were run inside a transaction and rolled back unless the row was meant to
persist.

## Fixtures

| Object | Value |
| --- | --- |
| Meals | `Test Meal A` … `Test Meal D`, revision 1 each |
| Rotation | `Test Rotation 2wk`, **week_count = 2** (proves length is data-driven, not fixed at 4) |
| Rotation slots | 40 — 2 weeks × Mon–Fri × 4 periods |
| Week 1 slots | breakfast/snack → Meal A, lunch/afternoon → Meal B |
| Week 2 slots | breakfast/snack → Meal C, lunch/afternoon → Meal D |
| Al Noor Nursery | four-meal plan, effective 2026-01-01 |
| Sunshine Valley School | three-meal plan (no afternoon snack), effective 2026-01-01 |
| Rotation assignment | **both** institutions → the same rotation, anchor 2026-08-03, week 1 |

Fixture rows are prefixed `Test ` so they are distinguishable from production
data (Part 63).

---

## Part 104 — Rotation maps to real dates and repeats

```
2026-08-03 → week 1
2026-08-10 → week 2
2026-08-17 → week 1
2026-08-24 → week 2
2026-08-31 → week 1
```

**PASS.** A 2-week rotation cycles correctly and repeats after its final week.

## Part 107 — Service Plan filters applicable periods

Same date (2026-08-18), same master rotation:

| Institution | breakfast | snack | lunch | afternoon snack |
| --- | --- | --- | --- | --- |
| Al Noor Nursery | resolves | resolves | resolves | **resolves** |
| Sunshine Valley School | resolves | resolves | resolves | **does not resolve** |

**PASS.** The master rotation contains an afternoon snack; the three-meal
institution does not receive one.

## Part 105 — A closure does not shift the rotation

Closure inserted for Wed 2026-08-19:

```
2026-08-18 Tue  service=true   rotation_week=1
2026-08-19 Wed  service=false  rotation_week=1   <- closed
2026-08-20 Thu  service=true   rotation_week=1   <- Thursday still serves Thursday
2026-08-21 Fri  service=true   rotation_week=1
2026-08-22 Sat  service=false  (no weekend slots)
2026-08-23 Sun  service=false
2026-08-24 Mon  service=true   rotation_week=2   <- rotation advanced normally
2026-08-25 Tue  service=true   rotation_week=2
```

**PASS.** Thursday did not inherit Wednesday's meal, and the following week is
still rotation week 2 — the closure changed nothing about rotation position.

## Part 106 — A date override changes only that date

| Date | Baseline (no override) | With override on 2026-08-21 lunch |
| --- | --- | --- |
| 2026-08-21 (Fri) | rotation → **Meal B** | override → **Meal D** |
| 2026-08-28 (Fri) | rotation → **Meal D** | rotation → **Meal D** (unchanged) |

**PASS.** The override changed 08-21 from Meal B to Meal D. The next Friday kept
its own normal rotation value. The master rotation was not modified.

## Part 108 — Service Plan effective dates do not rewrite history

Three-meal plan added effective 2026-09-01:

```
2026-08-18  afternoon snack = true    <- historical coverage preserved
2026-08-31  afternoon snack = true
2026-09-01  afternoon snack = false   <- new plan takes effect
2026-09-15  afternoon snack = false
```

**PASS.**

## Part 109 — Draft schedules never reach downstream roles

One unpublished service inserted for 2026-09-07 alongside 20 published ones:

| Role | services visible | drafts visible |
| --- | --- | --- |
| Super Admin | 21 | **1** |
| Parent | 20 | **0** |
| Kitchen | 20 | **0** |

**PASS.** Enforced by RLS, not by screen logic.

## Part 111 — Historical Meal version survives a recipe change

1. 20 services published for w/c 2026-08-24, referencing **revision 1**.
2. `Test Meal C` revision **2** appended (`["improved recipe v2"]`) and the
   Meal's current revision pointer moved to it.
3. The already-published August range was **republished**.
4. A new September range (rotation week 2, where Meal C appears) was published.

| Range | Revision referenced |
| --- | --- |
| August (already published, then republished) | **1** — 10 services |
| September (newly published) | **2** — `["improved recipe v2"]` |

**PASS.** Past truth stayed past truth; republishing did not rewrite it; future
schedules pick up the new revision.

### Append-only enforcement

```
UPDATE meal_revisions SET ingredients = '["REWRITTEN HISTORY"]' WHERE revision_no = 1
  → rows_rewritten = 0     (executed AS SUPER ADMIN)
```

**PASS.** There is no UPDATE policy on `meal_revisions`, so historical content
cannot be rewritten by any role — including Super Admin.

## Part 119 — Cross-institution isolation with a shared rotation

Both institutions published over the identical week (2026-08-24 → 08-28) from
the **same** master rotation:

| Institution | services that week | afternoon snacks |
| --- | --- | --- |
| Al Noor Nursery | 20 | **5** |
| Sunshine Valley School | 15 | **0** |

Visibility, as the Al Noor admin:

```
services_visible = 60
leaked_from_other_institution = 0
```

**PASS.** One rotation, two independent resolved schedules, no leakage.

---

## Summary

| Scenario | Result |
| --- | --- |
| 104 Rotation → calendar, repetition | PASS |
| 105 No-service day | PASS |
| 106 Date override | PASS |
| 107 Service plan filtering | PASS |
| 108 Plan effective dates | PASS |
| 109 Draft vs published | PASS |
| 111 Historical meal version + append-only | PASS |
| 119 Cross-institution isolation | PASS |

Also verified: **39 unit tests** pass (`pnpm test:unit`), including 14 in
`src/lib/calendar.test.ts` that pin the same resolution semantics without a
database.

## Not yet verified end-to-end

- **112** (class-change history) and **117** (kitchen change) — the underlying
  columns exist and are historical by construction, but no live scenario has
  been executed.
- **118** (expected vs received) — `BLOCKED_BY_SPEC`. Produced / packed /
  dispatched / received quantity stages have no approved state machine, so the
  columns to compare do not exist yet. Expected demand is derived today; the
  actual-quantity side is deliberately not invented.
- The admin UI for Meal Library, Rotation Builder and Calendar is **not built
  yet**. Kitchen, Classroom and Parent still read the legacy `menus` table;
  rewiring them to `meal_services` is outstanding.
