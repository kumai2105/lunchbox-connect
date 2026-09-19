-- 0041: a Super Admin could not create an Institution through the software ----
--
-- REPRODUCED, ON THE SERVER, NOT INFERRED
--
--   grants to authenticated on institutions : REFERENCES,SELECT,TRIGGER,TRUNCATE
--   INSERT as a super_admin                 : 42501 permission denied for table institutions
--
-- 0007 granted `authenticated` SELECT and nothing else on institutions:
--
--     grant select on institutions, app_users to authenticated;
--
-- while 0033 added policies stating the opposite intent:
--
--     create policy institutions_insert on institutions for insert
--       with check (app_is_super_admin());
--     create policy institutions_update on institutions for update
--       using (app_is_super_admin()) with check (app_is_super_admin());
--
-- PostgreSQL checks GRANTS BEFORE RLS. With no INSERT or UPDATE grant those two
-- policies were unreachable — dead code expressing a permission the database
-- would always refuse. They have been dead since 0033 was written.
--
-- WHAT THAT MEANT FOR THE BUSINESS
--
-- Super Admin is the operational control plane: LunchBox Connect onboards a
-- nursery by creating an Institution and configuring what it purchased. That
-- first step was impossible through the application. Every Institution in
-- production was written by the service role during setup, and every future
-- one would have needed a developer, a migration or a dashboard edit — for an
-- ordinary commercial operation. That is the failure mode the product exists
-- to remove, sitting in the product itself.
--
-- Nothing caught it because nothing had ever onboarded an Institution the way
-- an operator does. The suite verified surfaces against a database the FIXTURE
-- had already populated with service-role writes, so the one path a real
-- operator must take was the one path never taken.
--
-- THE CORRECTION
--
-- Grant exactly what 0033's policies already assume, and no more. The boundary
-- does not move: RLS still restricts both statements to app_is_super_admin(),
-- so a Nursery Admin, Classroom Staff, Kitchen or Parent gains nothing here —
-- a grant permits the verb, the policy decides the row, and the policy is
-- unchanged.
--
-- DELETE is deliberately NOT granted. 0033 revoked it on purpose: institutions
-- are archived, never destroyed, because students, classes, meal services and
-- served history all reference them.

grant insert, update on institutions to authenticated;

-- anon keeps nothing, exactly as 0004 established.
revoke all on institutions from anon;

comment on table institutions is
  'A customer nursery or school. Created and renamed by a Super Admin THROUGH '
  'THE APPLICATION — 0041 granted the insert/update the 0033 policies always '
  'assumed. Never deleted: archival only, because operational history '
  'references it.';
