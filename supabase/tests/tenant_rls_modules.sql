begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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
  ('80000000-0000-0000-0000-000000000001'::uuid, 'owner-a@modules.test'),
  ('80000000-0000-0000-0000-000000000002'::uuid, 'lawyer-a@modules.test'),
  ('80000000-0000-0000-0000-000000000003'::uuid, 'finance-a@modules.test'),
  ('80000000-0000-0000-0000-000000000004'::uuid, 'owner-b@modules.test')
) fixture(id, email);

insert into public.tenants (id, legal_name, display_name, slug, status) values
  ('81000000-0000-0000-0000-000000000001','Módulos A Ltda.','Módulos A','modulos-a','active'),
  ('82000000-0000-0000-0000-000000000002','Módulos B Ltda.','Módulos B','modulos-b','active');

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope, activated_at
) values
  ('81100000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','owner','active','tenant',now()),
  ('81100000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','lawyer','active','assigned',now()),
  ('81100000-0000-0000-0000-000000000003','81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000003','finance','active','tenant',now()),
  ('82200000-0000-0000-0000-000000000004','82000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004','owner','active','tenant',now());

insert into public.processos (
  id, user_id, numero, cliente_nome, tenant_id
) values
  ('81300000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','A-1','Cliente A','81000000-0000-0000-0000-000000000001'),
  ('82300000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004','B-1','Cliente B','82000000-0000-0000-0000-000000000002');

insert into public.tenant_record_assignments (
  tenant_id, module, record_id, membership_id
) values (
  '81000000-0000-0000-0000-000000000001',
  'processos',
  '81300000-0000-0000-0000-000000000001',
  '81100000-0000-0000-0000-000000000002'
);

insert into public.publicacoes (
  id, user_id, tipo, conteudo, tenant_id
) values
  ('81400000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','diario','Publicação A','81000000-0000-0000-0000-000000000001'),
  ('82400000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004','diario','Publicação B','82000000-0000-0000-0000-000000000002');

insert into public.andamentos (
  id, user_id, processo_id, numero_processo, descricao, tenant_id
) values
  ('81500000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','81300000-0000-0000-0000-000000000001','A-1','Andamento A','81000000-0000-0000-0000-000000000001'),
  ('82500000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004','82300000-0000-0000-0000-000000000002','B-1','Andamento B','82000000-0000-0000-0000-000000000002');

insert into public.honorario_parcelas (
  id, processo_id, user_id, numero_parcela, valor, data_vencimento,
  tenant_id
) values
  ('81600000-0000-0000-0000-000000000001','81300000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',1,100,'2026-08-01','81000000-0000-0000-0000-000000000001'),
  ('82600000-0000-0000-0000-000000000002','82300000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004',1,200,'2026-08-01','82000000-0000-0000-0000-000000000002');

insert into public.documentos (
  id, user_id, nome, processo_id, arquivo_path, tenant_id
) values
  ('81900000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Documento A','81300000-0000-0000-0000-000000000001','a.pdf','81000000-0000-0000-0000-000000000001'),
  ('82900000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000004','Documento B','82300000-0000-0000-0000-000000000002','b.pdf','82000000-0000-0000-0000-000000000002');

insert into public.notificacoes (
  id, user_id, titulo, mensagem, tenant_id
) values
  ('81700000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Dono','Somente dono','81000000-0000-0000-0000-000000000001'),
  ('81700000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002','Advogado','Somente advogado','81000000-0000-0000-0000-000000000001');

insert into public.equipe (
  id, user_id, nome, email, cargo, tenant_id
) values (
  '81800000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  'Equipe A', 'equipe-a@test.local', 'Advogado',
  '81000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.publicacoes),1::bigint,'owner A lê somente publicações A');
select is((select count(*) from public.andamentos),1::bigint,'owner A lê somente andamentos A');
select is((select count(*) from public.notificacoes),1::bigint,'owner lê somente a própria notificação');
select is((select count(*) from public.equipe),1::bigint,'owner lê a equipe do tenant');

select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.andamentos),1::bigint,'assigned herda acesso do processo');
select is((select count(*) from public.publicacoes),0::bigint,'assigned não lê publicação não atribuída');
select is((select count(*) from public.documentos),1::bigint,'assigned herda documento do processo');
update public.documentos set nome = 'Documento A atualizado'
where id = '81900000-0000-0000-0000-000000000001';
select is(
  (select nome from public.documentos where id = '81900000-0000-0000-0000-000000000001'),
  'Documento A atualizado',
  'assigned atualiza documento do processo'
);
select is((select count(*) from public.notificacoes),1::bigint,'advogado lê somente a própria notificação');
select is((select count(*) from public.equipe),0::bigint,'advogado não gerencia cadastro de equipe');

select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.honorario_parcelas),1::bigint,'finance lê honorários somente do tenant A');
select is((select count(*) from public.publicacoes),0::bigint,'finance não lê publicações jurídicas');

select throws_ok(
  $$insert into public.publicacoes(
      user_id, tipo, conteudo, tenant_id
    ) values (
      '80000000-0000-0000-0000-000000000002',
      'diario', 'Inválida',
      '82000000-0000-0000-0000-000000000002'
    )$$,
  '42501', null, 'membro não insere publicação em outro tenant'
);

reset role;
select ok(
  not has_table_privilege('authenticated','public.email_send_log','select'),
  'authenticated não recebe acesso aos logs de e-mail'
);

select * from finish();
rollback;
