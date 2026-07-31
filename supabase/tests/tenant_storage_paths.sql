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
  ('90000000-0000-0000-0000-000000000001'::uuid, 'owner-a@storage.test'),
  ('90000000-0000-0000-0000-000000000002'::uuid, 'lawyer-a@storage.test'),
  ('90000000-0000-0000-0000-000000000003'::uuid, 'owner-b@storage.test')
) fixture(id, email);

insert into public.tenants (id, legal_name, display_name, slug, status) values
  ('91000000-0000-0000-0000-000000000001','Storage A Ltda.','Storage A','storage-a','active'),
  ('92000000-0000-0000-0000-000000000002','Storage B Ltda.','Storage B','storage-b','active');

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope, activated_at
) values
  ('91100000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','owner','active','tenant',now()),
  ('91100000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','lawyer','active','assigned',now()),
  ('92200000-0000-0000-0000-000000000003','92000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','owner','active','tenant',now());

insert into public.processos (
  id, user_id, numero, cliente_nome, tenant_id
) values
  ('91300000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','ST-A','Cliente A','91000000-0000-0000-0000-000000000001'),
  ('92300000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','ST-B','Cliente B','92000000-0000-0000-0000-000000000002');

insert into public.tenant_record_assignments (
  tenant_id, module, record_id, membership_id
) values (
  '91000000-0000-0000-0000-000000000001',
  'processos',
  '91300000-0000-0000-0000-000000000001',
  '91100000-0000-0000-0000-000000000002'
);

insert into public.documentos (
  id, user_id, nome, processo_id, arquivo_path, tenant_id
) values
  ('91400000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','Documento A','91300000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001/documentos/91400000-0000-0000-0000-000000000001/a.pdf','91000000-0000-0000-0000-000000000001'),
  ('92400000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000003','Documento B','92300000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002/documentos/92400000-0000-0000-0000-000000000002/b.pdf','92000000-0000-0000-0000-000000000002');

insert into storage.objects (bucket_id, name) values
  ('documentos','91000000-0000-0000-0000-000000000001/documentos/91400000-0000-0000-0000-000000000001/a.pdf'),
  ('documentos','92000000-0000-0000-0000-000000000002/documentos/92400000-0000-0000-0000-000000000002/b.pdf');

select is(
  private.storage_path_tenant_id('invalido/documentos/arquivo'),
  null::uuid,
  'caminho inválido não produz tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
select is((select count(*) from storage.objects),1::bigint,'owner A vê somente arquivo A');

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
select is((select count(*) from storage.objects),1::bigint,'assigned herda acesso ao arquivo do processo');
select lives_ok(
  $$insert into storage.objects(bucket_id,name) values(
    'documentos',
    '91000000-0000-0000-0000-000000000001/documentos/91500000-0000-0000-0000-000000000005/novo.pdf'
  )$$,
  'membro pode enviar novo arquivo ao próprio tenant'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name) values(
    'documentos',
    '92000000-0000-0000-0000-000000000002/documentos/92500000-0000-0000-0000-000000000005/invasao.pdf'
  )$$,
  '42501', null, 'membro não envia arquivo a outro tenant'
);
select throws_ok(
  $$insert into storage.objects(bucket_id,name) values(
    'documentos',
    '90000000-0000-0000-0000-000000000002/arquivo-legado.pdf'
  )$$,
  '42501', null, 'caminho legado por usuário é rejeitado'
);
select set_config('storage.allow_delete_query','true',true);
delete from storage.objects
where name like '91000000-0000-0000-0000-000000000001/%';
select is((select count(*) from storage.objects),1::bigint,'lawyer sem delete não remove arquivo');

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
select is((select count(*) from storage.objects),1::bigint,'owner B vê somente arquivo B');
delete from storage.objects
where name like '92000000-0000-0000-0000-000000000002/%';
select is((select count(*) from storage.objects),0::bigint,'owner B pode excluir arquivo B');

select * from finish();
rollback;
