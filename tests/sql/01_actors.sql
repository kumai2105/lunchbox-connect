-- Minimal actor set so RLS can be exercised as each real role.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','super@zz.test'),
  ('00000000-0000-0000-0000-0000000000a2','viewer@zz.test'),
  ('00000000-0000-0000-0000-0000000000a3','driver@zz.test'),
  ('00000000-0000-0000-0000-0000000000a4','ops@zz.test')
on conflict do nothing;

insert into app_users (user_id, role, full_name, email) values
  ('00000000-0000-0000-0000-0000000000a1','super_admin','ZZ Super','super@zz.test'),
  ('00000000-0000-0000-0000-0000000000a2','viewer','ZZ Viewer','viewer@zz.test'),
  ('00000000-0000-0000-0000-0000000000a3','driver','ZZ Driver','driver@zz.test'),
  ('00000000-0000-0000-0000-0000000000a4','operations_manager','ZZ Ops','ops@zz.test')
on conflict do nothing;
