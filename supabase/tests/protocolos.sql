begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

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
-- Privilegios diretos na tabela: so o service_role escreve. anon e
-- authenticated nao ganham INSERT/UPDATE/DELETE/TRUNCATE — TRUNCATE em
-- particular nao e sujeito a RLS, entao o privilegio sozinho ja bastaria
-- para esvaziar a tabela se sobrasse concedido.
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.protocolos', 'insert'),
  'anon nao insere em protocolos'
);
select ok(
  not has_table_privilege('anon', 'public.protocolos', 'update'),
  'anon nao atualiza protocolos'
);
select ok(
  not has_table_privilege('anon', 'public.protocolos', 'delete'),
  'anon nao apaga protocolos'
);
select ok(
  not has_table_privilege('anon', 'public.protocolos', 'truncate'),
  'anon nao trunca protocolos'
);
select ok(
  not has_table_privilege('authenticated', 'public.protocolos', 'insert'),
  'authenticated nao insere em protocolos diretamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.protocolos', 'update'),
  'authenticated nao atualiza protocolos diretamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.protocolos', 'delete'),
  'authenticated nao apaga protocolos diretamente'
);
select ok(
  not has_table_privilege('authenticated', 'public.protocolos', 'truncate'),
  'authenticated nao trunca protocolos'
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
  ('85000000-0000-0000-0000-000000000005'::uuid, 'owner-b@protocolos.test'),
  ('85000000-0000-0000-0000-000000000006'::uuid, 'lawyer-a2@protocolos.test')
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
  ),
  (
    '85300000-0000-0000-0000-000000000006',
    '85100000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000006',
    'lawyer', 'active', 'assigned', now(), null
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

-- Tarefa-prazo cujo responsavel esta ativo no momento da atribuicao mas sera
-- suspenso logo em seguida — alvo do cenario de atomicidade (cenario 8).
insert into public.tarefas (
  id, user_id, titulo, tenant_id, responsavel_id, status, tipo
) values (
  '85500000-0000-0000-0000-000000000004',
  '85000000-0000-0000-0000-000000000001',
  'Prazo cujo responsavel sai do escritorio',
  '85100000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000006',
  'pendente',
  'prazo'
);

-- O advogado sai do escritorio depois de assumir o prazo, antes de o
-- protocolo ser registrado.
update public.tenant_memberships
set status = 'suspended', suspended_at = now()
where id = '85300000-0000-0000-0000-000000000006';

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
-- tarefa_not_found antes de qualquer insert. A checagem de tarefa roda
-- antes do insert, entao isto nao exercita rollback pos-insert — essa prova
-- e o cenario 8, com o responsavel suspenso apos a atribuicao.
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
  'a tarefa recusada antes do insert nao chega a criar protocolo'
);

-- ---------------------------------------------------------------------------
-- Cenario 8: atomicidade de verdade — o insert do protocolo acontece, o
-- update da tarefa falha depois (responsavel suspenso apos a atribuicao), e
-- a funcao desfaz tudo: nem protocolo fica orfao nem a tarefa e concluida.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now(),
      p_numero_processo := '0008000-00.2026.8.00.0001',
      p_tarefa_id := '85500000-0000-0000-0000-000000000004'
    )
  $$,
  'P0002',
  'prazo_com_responsavel_inativo',
  'responsavel suspenso apos a atribuicao recusa o registro'
);

select is(
  (
    select count(*)::int from public.protocolos
    where tarefa_id = '85500000-0000-0000-0000-000000000004'
  ),
  0,
  'o insert do protocolo e desfeito quando o update da tarefa falha'
);

select is(
  (select status from public.tarefas where id = '85500000-0000-0000-0000-000000000004'),
  'pendente',
  'a tarefa continua pendente quando o registro do protocolo e desfeito'
);

-- ---------------------------------------------------------------------------
-- Cenario 9: register_protocol recusa responsavel de outro escritorio
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now(),
      p_numero_processo := '0009000-00.2026.8.00.0001',
      p_responsavel_id := '85000000-0000-0000-0000-000000000005'
    )
  $$,
  'P0002',
  'responsavel_not_found',
  'responsavel de outro escritorio e recusado'
);

-- ---------------------------------------------------------------------------
-- Cenario 10: register_protocol recusa tipo fora da lista permitida
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'tipo-inexistente',
      p_protocolado_em := now(),
      p_numero_processo := '0010000-00.2026.8.00.0001'
    )
  $$,
  'P0002',
  'invalid_tipo',
  'tipo fora da lista permitida e recusado'
);

-- ---------------------------------------------------------------------------
-- Cenario 11: register_protocol exige processo_id ou numero_processo
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    select public.register_protocol(
      p_tenant_id := '85100000-0000-0000-0000-000000000001',
      p_tipo := 'peticao',
      p_protocolado_em := now()
    )
  $$,
  'P0002',
  'processo_not_identified',
  'sem processo_id nem numero_processo e recusado'
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
