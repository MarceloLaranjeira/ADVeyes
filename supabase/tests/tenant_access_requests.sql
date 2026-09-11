begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select has_table(
  'public', 'tenant_access_links', 'tabela tenant_access_links existe'
);
select has_table(
  'public', 'tenant_access_requests', 'tabela tenant_access_requests existe'
);

select has_index(
  'public',
  'tenant_access_links',
  'tenant_access_links_active_key',
  'um unico link ativo por escritorio'
);
select has_index(
  'public',
  'tenant_access_requests',
  'tenant_access_requests_pending_key',
  'uma unica solicitacao pendente por pessoa e escritorio'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.tenant_access_links'::regclass),
  'RLS habilitada em tenant_access_links'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tenant_access_requests'::regclass),
  'RLS habilitada em tenant_access_requests'
);

-- ---------------------------------------------------------------------------
-- Funcoes privilegiadas: nenhuma executavel pelo cliente
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'authenticated', 'public.tenant_decide_access_server(uuid, uuid, uuid, text, text, text, uuid, jsonb, text)', 'execute'
  ),
  'authenticated nao decide acesso diretamente'
);
select ok(
  not has_function_privilege(
    'anon', 'public.tenant_decide_access_server(uuid, uuid, uuid, text, text, text, uuid, jsonb, text)', 'execute'
  ),
  'anon nao decide acesso diretamente'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.tenant_request_access_server(uuid, text, jsonb)', 'execute'
  ),
  'authenticated nao cria solicitacao diretamente'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.tenant_access_link_server(uuid, uuid, text, text)', 'execute'
  ),
  'authenticated nao administra o link diretamente'
);
select ok(
  has_function_privilege(
    'service_role', 'public.tenant_decide_access_server(uuid, uuid, uuid, text, text, text, uuid, jsonb, text)', 'execute'
  ),
  'service_role decide acesso'
);

-- ---------------------------------------------------------------------------
-- Cenario: escritorio, proprietario, administrador e solicitante
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-0000000000a1', 'dona@example.com'),
  ('00000000-0000-4000-8000-0000000000a2', 'admin@example.com'),
  ('00000000-0000-4000-8000-0000000000a3', 'pede@example.com'),
  ('00000000-0000-4000-8000-0000000000a4', 'outro@example.com');

insert into public.tenants (id, legal_name, display_name, slug)
values (
  '00000000-0000-4000-8000-0000000000b1',
  'Escritorio Teste LTDA',
  'Escritorio Teste',
  'escritorio-teste'
);

insert into public.tenant_memberships (tenant_id, user_id, role, status, activated_at)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active', now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'admin', 'active', now());

-- Link privado: somente o proprietario gera.
select lives_ok(
  $$select public.tenant_access_link_server(
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b1',
      'generate',
      repeat('a', 64)
    )$$,
  'proprietario gera o link privado'
);

select throws_ok(
  $$select public.tenant_access_link_server(
      '00000000-0000-4000-8000-0000000000a2',
      '00000000-0000-4000-8000-0000000000b1',
      'generate',
      repeat('b', 64)
    )$$,
  '42501',
  'owner_required',
  'administrador nao gera o link privado'
);

-- Solicitacao
select lives_ok(
  $$select public.tenant_request_access_server(
      '00000000-0000-4000-8000-0000000000a3',
      repeat('a', 64),
      '{"name":"Helena","phone":"92999999999","oab":"AM-1234"}'::jsonb
    )$$,
  'integrante autenticado solicita acesso'
);

select is(
  (select count(*)::int from public.tenant_access_requests
    where tenant_id = '00000000-0000-4000-8000-0000000000b1' and status = 'pending'),
  1,
  'solicitacao fica pendente'
);

select is(
  (select count(*)::int from public.tenant_memberships
    where tenant_id = '00000000-0000-4000-8000-0000000000b1'
      and user_id = '00000000-0000-4000-8000-0000000000a3'),
  0,
  'solicitacao pendente nao concede membership'
);

-- Solicitacao duplicada nao cria uma segunda pendencia.
select lives_ok(
  $$select public.tenant_request_access_server(
      '00000000-0000-4000-8000-0000000000a3',
      repeat('a', 64),
      '{"name":"Helena"}'::jsonb
    )$$,
  'segunda tentativa devolve a pendencia existente'
);
select is(
  (select count(*)::int from public.tenant_access_requests
    where tenant_id = '00000000-0000-4000-8000-0000000000b1' and status = 'pending'),
  1,
  'continua existindo uma unica solicitacao pendente'
);

-- Token invalido e revogado
select throws_ok(
  $$select public.tenant_request_access_server(
      '00000000-0000-4000-8000-0000000000a4',
      repeat('c', 64),
      '{"name":"Outro"}'::jsonb
    )$$,
  'P0001',
  'invalid_token',
  'token inexistente e recusado'
);

-- Decisao: administrador nao decide.
select throws_ok(
  format(
    $$select public.tenant_decide_access_server(
        '00000000-0000-4000-8000-0000000000a2',
        '00000000-0000-4000-8000-0000000000b1',
        %L, 'approve', 'lawyer', 'tenant', null, '{}'::jsonb, null
      )$$,
    (select id from public.tenant_access_requests where status = 'pending' limit 1)
  ),
  '42501',
  'owner_required',
  'administrador nao aprova solicitacao'
);

-- Exceção proibida
select throws_ok(
  format(
    $$select public.tenant_decide_access_server(
        '00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000b1',
        %L, 'approve', 'lawyer', 'tenant', null,
        '{"ownership":{"transfer":"allow"}}'::jsonb, null
      )$$,
    (select id from public.tenant_access_requests where status = 'pending' limit 1)
  ),
  '42501',
  'forbidden_override',
  'nao delega autoridade do proprietario por excecao'
);

-- Aprovacao pelo proprietario
select lives_ok(
  format(
    $$select public.tenant_decide_access_server(
        '00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000b1',
        %L, 'approve', 'lawyer', 'tenant', null,
        '{"finance":{"read":"allow"}}'::jsonb, null
      )$$,
    (select id from public.tenant_access_requests where status = 'pending' limit 1)
  ),
  'proprietario aprova a solicitacao'
);

select is(
  (select status from public.tenant_memberships
    where tenant_id = '00000000-0000-4000-8000-0000000000b1'
      and user_id = '00000000-0000-4000-8000-0000000000a3'),
  'active',
  'aprovacao ativa a membership'
);

select is(
  (select permission_overrides from public.tenant_memberships
    where tenant_id = '00000000-0000-4000-8000-0000000000b1'
      and user_id = '00000000-0000-4000-8000-0000000000a3'),
  '{"finance":{"read":"allow"}}'::jsonb,
  'aprovacao persiste as permissoes escolhidas'
);

select is(
  (select status from public.tenant_access_requests
    where user_id = '00000000-0000-4000-8000-0000000000a3'),
  'approved',
  'solicitacao concluida'
);

select is(
  (select count(*)::int from public.tenant_audit_events
    where tenant_id = '00000000-0000-4000-8000-0000000000b1'
      and action = 'access_request.approved'),
  1,
  'aprovacao registrada na auditoria'
);

select is(
  (select count(*)::int from public.equipe
    where tenant_id = '00000000-0000-4000-8000-0000000000b1'
      and lower(email) = 'pede@example.com'
      and membership_id is not null),
  1,
  'perfil profissional vinculado a membership'
);

select throws_ok(
  format(
    $Q$select public.tenant_decide_access_server(
        '00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000b1',
        %L, 'reject', null, null, null, null, 'fora do escritorio'
      )$Q$,
    (select id from public.tenant_access_requests
      where user_id = '00000000-0000-4000-8000-0000000000a3')
  ),
  'P0001',
  'request_not_pending',
  'solicitacao ja decidida nao muda'
);

select is(
  (select count(*)::int from public.notificacoes
    where origem = 'access_request'
      and user_id = '00000000-0000-4000-8000-0000000000a1'),
  1,
  'proprietario e notificado da solicitacao'
);

select is(
  (select bool_and(lida) from public.notificacoes
    where origem = 'access_request'),
  true,
  'a decisao encerra a notificacao'
);

select * from finish();

rollback;
