#!/usr/bin/env bash
# §58 DATA MIGRATION — upgrade an EXISTING database, prove history survives.
# Builds a DB at migrations 0001..0016, seeds a legacy menu + an institution +
# a real serving record (operational history), then applies 0017..0020 and
# proves: the meal library/template is built from the menu, NO business
# decisions are made (0 plans / 0 assignments / 0 published), and every
# historical record survives intact.
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}; PORT=${PGPORT:-5433}; SOCK=${SOCK:-/tmp}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PSQL="psql -h $SOCK -p $PORT -U postgres -q -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "drop database if exists lbc_datamig;" -c "create database lbc_datamig;"
$PSQL -d lbc_datamig -f "$HERE/00_supabase_shim.sql" >/dev/null
for n in 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011 0012 0013 0014 0015 0016; do
  f=$(ls "$ROOT"/supabase/migrations/${n}_*.sql 2>/dev/null || true); [ -z "$f" ] && continue
  $PSQL -d lbc_datamig -f "$f" >/dev/null
done
$PSQL -d lbc_datamig -f "$HERE/01_actors.sql" >/dev/null
# Seed pre-upgrade operational history.
$PSQL -d lbc_datamig >/dev/null <<'SQL'
insert into institutions (id,name,kind) values ('99990000-0000-0000-0000-000000000001','DataMig Nursery','nursery');
insert into menus (week_number,weekday,period,dish_name,allergens,published)
select 1,wd,p::app_period,'Chicken Pasta '||wd||' '||p,'["gluten"]'::jsonb,true
from generate_series(0,4) wd cross join unnest(array['breakfast','snack','lunch']) p;
insert into classes (id,institution_id,name,grade) values ('99990000-0000-0000-0000-0000000000c1','99990000-0000-0000-0000-000000000001','DM Class','T');
insert into students (id,student_no,institution_id,given_name,family_name,class_id,enrollment_status,operational_status)
values ('99990000-0000-0000-0000-0000000000d1','DM-1','99990000-0000-0000-0000-000000000001','Old','History','99990000-0000-0000-0000-0000000000c1','enrolled','ACTIVE_BILLABLE_TO_NURSERY');
-- a real historical observation, linked to the legacy menu (menu_item_id)
insert into serving_records (serving_date,class_id,student_id,period,served_status,consumption_pct,concern_observed,menu_item_id,recorded_by)
select current_date - 30,'99990000-0000-0000-0000-0000000000c1','99990000-0000-0000-0000-0000000000d1','lunch','served',75,false,
  (select id from menus where week_number=1 and weekday=0 and period='lunch' limit 1),
  (select user_id from app_users where role='super_admin' limit 1);
SQL
BEFORE=$($PSQL -tAd lbc_datamig -c "select count(*) from serving_records;")
# Apply the upgrade migrations.
for n in 0017 0018 0019 0020; do
  f=$(ls "$ROOT"/supabase/migrations/${n}_*.sql); $PSQL -d lbc_datamig -f "$f" >/dev/null
done
# Assert.
$PSQL -d lbc_datamig <<SQL
do \$\$
declare n int; pct int; dish text;
begin
  -- history survived, unchanged
  select count(*) into n from serving_records; 
  if n <> $BEFORE then raise exception 'FAIL history rows changed % -> %', $BEFORE, n; end if;
  select consumption_pct into pct from serving_records where student_id='99990000-0000-0000-0000-0000000000d1';
  if pct <> 75 then raise exception 'FAIL historical observation altered (pct=%)', pct; end if;
  raise notice 'PASS  §58 historical serving record survived intact (pct=75)';

  -- meal library + template were built from the legacy menu
  if (select count(*) from meals) = 0 then raise exception 'FAIL upgrade did not build the meal library'; end if;
  if (select count(*) from rotation_slots where rotation_id='00000000-0000-4000-8000-000000000171') = 0
    then raise exception 'FAIL upgrade did not build the rotation template'; end if;
  raise notice 'PASS  §58 meal library and rotation template built from legacy menu';

  -- but NO business decisions were made by the upgrade
  if (select count(*) from institution_service_plans) <> 0 then raise exception 'FAIL upgrade inferred service plans'; end if;
  if (select count(*) from institution_rotation_assignments) <> 0 then raise exception 'FAIL upgrade auto-assigned rotations'; end if;
  if (select count(*) from meal_services) <> 0 then raise exception 'FAIL upgrade auto-published services'; end if;
  raise notice 'PASS  §58 upgrade made 0 business decisions (0 plans, 0 assignments, 0 published)';

  raise notice '---------------------------------------------------------';
  raise notice 'DATA MIGRATION: history preserved, no business decisions. All checks pass.';
end \$\$;
SQL
$PSQL -d postgres -c "drop database if exists lbc_datamig;" >/dev/null
echo "RESULT: data migration verification passed"
