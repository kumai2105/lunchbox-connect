-- notes_safety.sql — acceptance test for the PARENT-VISIBILITY rule (AT-031).
--
-- Run in the Supabase SQL editor while logged in as each identity below, or
-- via psql with placeholders substituted. Expected: every SELECT returns only
-- the rows described — never a row another identity must not see.
--
-- Setup required (once, via seed.sql / the app):
--   • a parent account P with at least one child in an institution
--   • a nurse/teacher account T in that same institution
--   • two serving records for P's child: one with a PUBLISHED note, one with
--     an UNPUBLISHED note.

-- 1) As PARENT (run in the session of the parent user): only shows the child's
--    PUBLISHED notes — the unpublished one must NOT appear.
select sr.period, sn.body, sn.published_at
from serving_notes sn
join serving_records sr on sr.id = sn.serving_record_id
where sr.student_id = :child_uuid;

-- EXPECT: 1 row (published note only). If 2 rows appear, RLS is leaking an
-- unpublished note — that is a failure of AT-031.

-- 2) As PARENT for a DIFFERENT child in the same institution: must return ZERO rows.
select sr.student_id
from serving_notes sn
join serving_records sr on sr.id = sn.serving_record_id
where sr.student_id <> :child_uuid;

-- EXPECT: 0 rows. Any parent reading another child's notes fails AT-031.

-- 3) As STAFF (nurse/teacher of the same institution): may see published AND
--    unpublished notes for any student in that institution.
select sr.student_id, sn.body, sn.published_at
from serving_notes sn
join serving_records sr on sr.id = sn.serving_record_id
where sr.student_id = :child_uuid;

-- EXPECT: 2 rows (both notes).