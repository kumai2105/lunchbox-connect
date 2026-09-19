-- =====================================================================
-- 0026 — Retire the legacy menu publish flow (§9/§10/§51).
--
-- The old "Publish week / Publish to families" button called
-- publish_menu_week(), which only flipped menus.published — a table Parent,
-- Kitchen and Classroom no longer read. That is exactly the misleading
-- legacy publishing §10 forbids. The Admin Menu system is now Meal Library +
-- Menu Builder + Calendar + Meal Services; the real publish path is
-- publish_meal_services(). This drops the dead RPC.
--
-- The `menus` TABLE is deliberately kept: serving_records.menu_item_id still
-- references it for pre-cutover history (§13 — a meal a child was served must
-- not vanish). It is now historical/read-only — no code writes it any more.
-- =====================================================================

drop function if exists publish_menu_week(int);

comment on table menus is
  'LEGACY, historical/read-only. Superseded by the Meal Library + Menu Builder '
  '+ Calendar + meal_services architecture. Retained only because '
  'serving_records.menu_item_id references pre-cutover history; no code writes '
  'this table any more.';
