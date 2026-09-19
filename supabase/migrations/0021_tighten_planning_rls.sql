-- =====================================================================
-- 0021 — Tighten RLS on internal planning data (correction order §44).
--
-- rotations, rotation_slots, meals and meal_revisions were all
-- `select using (true)` — readable by every authenticated user AND anon.
-- That exposed the entire global meal library, every rotation template, and
-- all unpublished planning to Parents and any other role. Downstream roles
-- must receive ONLY the published, authorised information their experience
-- needs; the resolver already runs SECURITY DEFINER, so clients never need
-- to read the raw templates.
--
-- New rules:
--   rotations / rotation_slots  → Super Admin only (pure admin planning).
--   meal_revisions              → Super Admin, OR the revision is referenced
--                                 by a PUBLISHED meal_service the caller may
--                                 see (their institution / kitchen / parent).
--   meals                       → same visibility as its visible revisions.
-- This is exactly the visibility already granted on meal_services, so Parent
-- and Kitchen keep working (they read published services and join the dish),
-- while nobody can browse the library or templates directly.
-- =====================================================================

-- rotations / rotation_slots: admin-only reads.
drop policy if exists rotations_select on rotations;
create policy rotations_select on rotations for select using (app_is_super_admin());

drop policy if exists rotation_slots_select on rotation_slots;
create policy rotation_slots_select on rotation_slots for select using (app_is_super_admin());

-- meal_revisions: admin, or referenced by a published service the caller sees.
drop policy if exists meal_revisions_select on meal_revisions;
create policy meal_revisions_select on meal_revisions for select using (
  app_is_super_admin()
  or exists (
    select 1 from meal_services ms
    where ms.meal_revision_id = meal_revisions.id
      and ms.published
      and (
        app_can_see_institution(ms.institution_id)
        or app_is_kitchen()
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = ms.institution_id and sp.user_id = auth.uid()
        )
      )
  )
);

-- meals: admin, or the meal has a revision that is visible per the rule above.
drop policy if exists meals_select on meals;
create policy meals_select on meals for select using (
  app_is_super_admin()
  or exists (
    select 1 from meal_revisions r
    join meal_services ms on ms.meal_revision_id = r.id
    where r.meal_id = meals.id
      and ms.published
      and (
        app_can_see_institution(ms.institution_id)
        or app_is_kitchen()
        or exists (
          select 1 from students s
          join student_parents sp on sp.student_id = s.id
          where s.institution_id = ms.institution_id and sp.user_id = auth.uid()
        )
      )
  )
);
