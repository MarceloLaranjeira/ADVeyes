begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid, id,
  'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
from (values
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'multi@tenant.test'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'other@tenant.test')
) fixture(id, email);

insert into public.tenants (
  id, legal_name, display_name, slug, status
) values
  ('b1000000-0000-0000-0000-000000000001','Tenant Um Ltda.','Tenant Um','tenant-um','active'),
  ('b2000000-0000-0000-0000-000000000002','Tenant Dois Ltda.','Tenant Dois','tenant-dois','trialing'),
  ('b3000000-0000-0000-0000-000000000003','Tenant Outro Ltda.','Tenant Outro','tenant-outro','active');

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope, activated_at
) values
  ('b1100000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','owner','active','tenant',now()),
  ('b2200000-0000-0000-0000-000000000002','b2000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','lawyer','active','assigned',now()),
  ('b3300000-0000-0000-0000-000000000003','b3000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000002','owner','active','tenant',now());

select throws_ok(
  $$select * from public.current_user_tenants()$$,
  '42501',
  'Authentication required',
  'anon não lista memberships'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000001',
  true
);
select is(
  (select count(*) from public.current_user_tenants()),
  2::bigint,
  'usuário recebe os dois tenants próprios'
);
select is(
  (select string_agg(slug, ',' order by slug)
   from public.current_user_tenants()),
  'tenant-dois,tenant-um',
  'não recebe tenant de outro usuário'
);
select is(
  (select membership_role
   from public.current_user_tenants()
   where slug = 'tenant-dois'),
  'lawyer',
  'retorna role da membership'
);
select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'tenant_memberships'
      and privilege_type = 'SELECT'
  ),
  'tabela administrativa continua fechada para acesso direto'
);

select * from finish();
rollback;
