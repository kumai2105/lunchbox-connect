# Applying the pending migrations to production

**Project:** `llnofriwvnerntrbpehc`
**Pending:** `0017`, `0018`, `0019`, `0020` (live has `0001`–`0016`)

I could not apply these myself — writes to the production database are
blocked by a permission guard in this environment that your verbal approval
does not clear. The SQL below is what I would have run, in order.

---

## Read this first: production is running on test fixtures

Both institutions are currently assigned to **`Test Rotation 2wk`**, built
from `Test Meal A`–`D`. Those were created by this session while verifying
Decision 033, and they are what production resolves meals from today.

Migration `0017` skips any institution that **already** has a rotation
assignment. So applying `0017` and `0019` on their own would silently do
nothing useful, and `0019` would publish **"Test Meal B" as real children's
lunches**. Step 2 below exists to prevent exactly that, and it must run
between `0018` and `0017`.

---

## Order

| Step | What | Why it is in this position |
| ---- | ---- | -------------------------- |
| 1 | `0018` | Closes a live leak. Independent of everything else — apply it even if you stop here. |
| 2 | Remove `Test %` fixtures | Must precede `0017`, or the backfill no-ops and test meals get published. |
| 3 | `0017` | Backfills your real menu (20 rows, week 34) onto the rotation engine. |
| 4 | `0019` | Publishes a dated window, so Kitchen and Parent are not blank. |
| 5 | `0020` | Makes observations persist their meal link. |

Run steps 1–5 from the migration files in `supabase/migrations/`, with the
step 2 block below inserted between `0018` and `0017`.

Everything can be wrapped in a single `begin; … commit;` so a failure at any
point leaves production untouched.

---

## Step 2 — remove the test fixtures

```sql
-- Refuse to run if any observed history depends on the fixtures. Deleting a
-- meal a child was actually recorded against would destroy real history, so
-- this aborts rather than guess.
do $guard$
declare n int;
begin
  select count(*) into n
    from serving_records sr
    join meal_services ms  on ms.id = sr.meal_service_id
    join meal_revisions mr on mr.id = ms.meal_revision_id
    join meals m           on m.id  = mr.meal_id
   where m.name like 'Test %';
  if n > 0 then
    raise exception 'ABORT: % serving record(s) reference Test fixtures.', n;
  end if;
end $guard$;

-- Children first, then parents.
delete from meal_services ms
 using meal_revisions mr, meals m
 where ms.meal_revision_id = mr.id and mr.meal_id = m.id and m.name like 'Test %';

delete from institution_rotation_assignments a
 using rotations r where a.rotation_id = r.id and r.name like 'Test %';

delete from rotation_slots rs using rotations r
 where rs.rotation_id = r.id and r.name like 'Test %';

delete from rotations where name like 'Test %';

update meals set current_revision_id = null where name like 'Test %';
delete from meal_revisions mr using meals m
 where mr.meal_id = m.id and m.name like 'Test %';
delete from meals where name like 'Test %';
```

### Service plans — a decision you may want to override

The current plans also came from the verification run:

```
Al Noor Nursery        -> breakfast, snack, lunch, afternoon_snack
Sunshine Valley School -> breakfast, snack, lunch          <- no afternoon snack
```

That distinction is **a test fixture, not something you entered.** Before the
cutover, every institution read the same single global menu, so every
institution served the same periods. To reproduce that faithfully:

```sql
delete from institution_service_plans;
insert into institution_service_plans (institution_id, periods, effective_from)
select i.id,
       (select array_agg(distinct mn.period order by mn.period) from menus mn),
       date '2026-01-01'
from institutions i
where exists (select 1 from menus);
```

**Skip this block if Sunshine Valley really has no afternoon snack.** I am not
going to keep inventing that difference silently, and I am not going to delete
it behind your back either — it is your call.

---

## Step 6 — verification

```sql
do $verify$
declare n int;
begin
  if has_function_privilege('authenticated','resolve_meal(uuid,date,app_period)','EXECUTE')
     or has_function_privilege('anon','resolve_meal(uuid,date,app_period)','EXECUTE') then
    raise exception 'FAIL resolver RPC leak still open';
  end if;

  select count(*) into n from meals where name like 'Test %';
  if n <> 0 then raise exception 'FAIL % Test meals remain', n; end if;

  select count(*) into n from meal_services
   where published and service_date between current_date and current_date + 30;
  if n = 0 then
    raise exception 'FAIL no published services in the next 30 days — Kitchen and Parent would be blank';
  end if;
  raise notice 'OK — % published services in the next 30 days', n;
end $verify$;
```

Then `commit;`.

---

## If you would rather not touch the database today

The deployed app currently reads `meal_services`, and production has no
services for today, so **Kitchen's "Today's meals" is blank right now**. That
regression is mine: the deploy workflow fires on push to
`claude/new-session-k5dd5u`, and I pushed the read-path rewire before the
migrations were applied.

Reverting commit `a3a8dd6` restores the previous behaviour — Kitchen and Parent
read the legacy menu again, including the seven-week freeze. Ask me and I will
do it.

**Step 1 (`0018`) should be applied either way.** The leak is live, reachable
without logging in, and independent of the rest of this.
