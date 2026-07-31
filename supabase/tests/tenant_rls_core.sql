begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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
  ('70000000-0000-0000-0000-000000000001'::uuid, 'owner-a@rls.test'),
  ('70000000-0000-0000-0000-000000000002'::uuid, 'assigned-a@rls.test'),
  ('70000000-0000-0000-0000-000000000003'::uuid, 'team-a@rls.test'),
  ('70000000-0000-0000-0000-000000000004'::uuid, 'finance-a@rls.test'),
  ('70000000-0000-0000-0000-000000000005'::uuid, 'owner-b@rls.test')
) fixture(id, email);

insert into public.tenants (id, legal_name, display_name, slug, status) values
  ('71000000-0000-0000-0000-000000000001','RLS A Ltda.','RLS A','rls-a','active'),
  ('72000000-0000-0000-0000-000000000002','RLS B Ltda.','RLS B','rls-b','active');

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope, activated_at
) values
  ('71100000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','owner','active','tenant',now()),
  ('71100000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002','lawyer','active','assigned',now()),
  ('71100000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000003','assistant','active','team',now()),
  ('71100000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000004','finance','active','tenant',now()),
  ('72200000-0000-0000-0000-000000000005','72000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000005','owner','active','tenant',now());

insert into public.tenant_teams (id, tenant_id, name)
values ('71300000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','Equipe A');
insert into public.tenant_team_members (tenant_id, team_id, membership_id)
values ('71000000-0000-0000-0000-000000000001','71300000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000003');

insert into public.clientes (id,user_id,nome,tenant_id) values
  ('71400000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','A atribuído','71000000-0000-0000-0000-000000000001'),
  ('71400000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001','A equipe','71000000-0000-0000-0000-000000000001'),
  ('71400000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001','A geral','71000000-0000-0000-0000-000000000001'),
  ('72400000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000005','B geral','72000000-0000-0000-0000-000000000002');

insert into public.tenant_record_assignments (
  tenant_id,module,record_id,membership_id,team_id
) values
  ('71000000-0000-0000-0000-000000000001','clientes','71400000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000002',null),
  ('71000000-0000-0000-0000-000000000001','clientes','71400000-0000-0000-0000-000000000002',null,'71300000-0000-0000-0000-000000000001');

insert into public.financeiro (id,user_id,tipo,descricao,valor,status,tenant_id) values
  ('71500000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','receita','Financeiro A',10,'pendente','71000000-0000-0000-0000-000000000001'),
  ('72500000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000005','receita','Financeiro B',20,'pendente','72000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.clientes where nome like '% %'),3::bigint,'owner A lê somente os três clientes A');

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.clientes),1::bigint,'assigned lê somente registro atribuído');
select is((select nome from public.clientes limit 1),'A atribuído','assigned recebe o registro correto');

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.clientes),1::bigint,'team lê somente registro da equipe');
select is((select nome from public.clientes limit 1),'A equipe','team recebe o registro correto');

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000004',true);
select is((select count(*) from public.financeiro),1::bigint,'finance lê financeiro do próprio tenant');
select is((select count(*) from public.clientes),0::bigint,'finance não lê clientes jurídicos');

select throws_ok(
  $$insert into public.clientes(user_id,nome,tenant_id) values(
    '70000000-0000-0000-0000-000000000002','Spoof B',
    '72000000-0000-0000-0000-000000000002')$$,
  '42501',null,'lawyer não insere em outro tenant'
);

select set_config('request.jwt.claim.sub','70000000-0000-0000-0000-000000000005',true);
select is((select count(*) from public.clientes),1::bigint,'owner B não vê tenant A');

select * from finish();
rollback;
