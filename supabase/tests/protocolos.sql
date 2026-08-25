begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'protocolos', 'tabela protocolos existe'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.protocolos'::regclass),
  'RLS habilitada em protocolos'
);

select has_column(
  'public', 'tarefas', 'tipo', 'tarefas ganha a coluna tipo'
);
select has_column(
  'public', 'documentos', 'protocolo_id', 'documentos ganha a coluna protocolo_id'
);
select has_column(
  'public', 'publicacoes', 'ciencia_em', 'publicacoes ganha a coluna ciencia_em'
);

-- ---------------------------------------------------------------------------
-- Cenario: dois escritorios, papeis distintos em cada um
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values
  ('85000000-0000-0000-0000-000000000001'::uuid, 'owner-a@protocolos.test'),
  ('85000000-0000-0000-0000-000000000002'::uuid, 'admin-a@protocolos.test'),
  ('85000000-0000-0000-0000-000000000003'::uuid, 'finance-a@protocolos.test'),
  ('85000000-0000-0000-0000-000000000004'::uuid, 'suspenso-a@protocolos.test'),
  ('85000000-0000-0000-0000-000000000005'::uuid, 'owner-b@protocolos.test')
) fixture(id, email);

insert into public.tenants (
  id, legal_name, display_name, slug, status
) values
  (
    '85100000-0000-0000-0000-000000000001',
    'Protocolos Tenant A Ltda.',
    'Protocolos Tenant A',
    'protocolos-tenant-a',
    'active'
  ),
  (
    '85200000-0000-0000-0000-000000000002',
    'Protocolos Tenant B Ltda.',
    'Protocolos Tenant B',
    'protocolos-tenant-b',
    'active'
  );

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope,
  activated_at, suspended_at
) values
  (
    '85300000-0000-0000-0000-000000000001',
    '85100000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000001',
    'owner', 'active', 'tenant', now(), null
  ),
  (
    '85300000-0000-0000-0000-000000000002',
    '85100000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000002',
    'admin', 'active', 'tenant', now(), null
  ),
  (
    '85300000-0000-0000-0000-000000000003',
    '85100000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000003',
    'finance', 'active', 'tenant', now(), null
  ),
  (
    '85300000-0000-0000-0000-000000000004',
    '85100000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000004',
    'lawyer', 'suspended', 'assigned', null, now()
  ),
  (
    '85300000-0000-0000-0000-000000000005',
    '85200000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000005',
    'owner', 'active', 'tenant', now(), null
  );

-- Protocolo do tenant A, responsavel e um advogado que nao e quem vai le-lo
-- no cenario 2.
insert into public.protocolos (
  id, tenant_id, numero_processo, tipo, protocolado_em,
  responsavel_id, created_by
) values (
  '85400000-0000-0000-0000-000000000001',
  '85100000-0000-0000-0000-000000000001',
  '0001000-00.2026.8.00.0001',
  'peticao',
  now(),
  '85000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001'
);

-- Tarefa-prazo do tenant A, alvo do register_protocol no cenario 4.
insert into public.tarefas (
  id, user_id, titulo, tenant_id, responsavel_id, status, tipo
) values (
  '85500000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'Prazo para contestar',
  '85100000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  'pendente',
  'prazo'
);

-- Tarefa do tenant B, usada no cenario 5 para provar que register_protocol
-- nao aceita tarefa de outro escritorio.
insert into public.tarefas (
  id, user_id, titulo, tenant_id, responsavel_id, status, tipo
) values (
  '85500000-0000-0000-0000-000000000002',
  '85000000-0000-0000-0000-000000000005',
  'Prazo do tenant B',
  '85200000-0000-0000-0000-000000000002',
  '85000000-0000-0000-0000-000000000005',
  'pendente',
  'prazo'
);

-- Tarefa criada sem informar tipo (cenario 7).
insert into public.tarefas (
  id, user_id, titulo, tenant_id
) values (
  '85500000-0000-0000-0000-000000000003',
  '85000000-0000-0000-0000-000000000001',
  'Tarefa sem tipo informado',
  '85100000-0000-0000-0000-000000000001'
);

select is(
  (select tipo from public.tarefas where id = '85500000-0000-0000-0000-000000000003'),
  'tarefa',
  'tarefa criada sem tipo continua com tipo = tarefa'
);

-- ---------------------------------------------------------------------------
-- Cenario 1: protocolo de um escritorio nao aparece para membro de outro
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-0000-0000-000000000005',
  true
);

select is(
  (
    select count(*)::int from public.protocolos
    where id = '85400000-0000-0000-0000-000000000001'
  ),
  0,
  'membro de outro escritorio nao ve o protocolo'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cenario 2: membro ativo com leitura no modulo juridico ve protocolo de
-- outro responsavel do proprio escritorio
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-0000-0000-000000000002',
  true
);

select is(
  (
    select count(*)::int from public.protocolos
    where id = '85400000-0000-0000-0000-000000000001'
  ),
  1,
  'membro ativo ve o protocolo de outro responsavel no mesmo escritorio'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cenario 3: quem nao e membro ativo nao ve nada
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-0000-0000-000000000004',
  true
);

select is(
  (
    select count(*)::int from public.protocolos
    where tenant_id = '85100000-0000-0000-0000-000000000001'
  ),
  0,
  'membro suspenso nao ve nenhum protocolo do proprio escritorio'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cenario 4: register_protocol com p_tarefa_id conclui a tarefa e cria o
-- protocolo, na mesma transacao
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now(),
      p_numero_processo := '0004000-00.2026.8.00.0001',
      p_tarefa_id := '85500000-0000-0000-0000-000000000001'
    )
  $$,
  'proprietario registra o protocolo vinculado a tarefa'
);

select is(
  (select status from public.tarefas where id = '85500000-0000-0000-0000-000000000001'),
  'concluída',
  'a tarefa vinculada e concluida junto com o registro do protocolo'
);

select is(
  (
    select count(*)::int from public.protocolos
    where tarefa_id = '85500000-0000-0000-0000-000000000001'
  ),
  1,
  'o protocolo criado referencia a tarefa concluida'
);

-- ---------------------------------------------------------------------------
-- Cenario 5: register_protocol com tarefa de outro escritorio levanta
-- tarefa_not_found e nao deixa protocolo criado
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now(),
      p_numero_processo := '0005000-00.2026.8.00.0001',
      p_tarefa_id := '85500000-0000-0000-0000-000000000002'
    )
  $$,
  'P0002',
  'tarefa_not_found',
  'tarefa de outro escritorio e recusada'
);

select is(
  (
    select count(*)::int from public.protocolos
    where tenant_id = '85100000-0000-0000-0000-000000000001'
  ),
  2,
  'a tentativa recusada nao deixa protocolo orfao criado'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cenario 6: register_protocol sem permissao levanta permission_denied
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '85000000-0000-0000-0000-000000000003',
  true
);

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now(),
      p_numero_processo := '0006000-00.2026.8.00.0001'
    )
  $$,
  '42501',
  'permission_denied',
  'papel financeiro nao cria protocolo no modulo juridico'
);

reset role;

select * from finish();

rollback;
