begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

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
  ('83000000-0000-0000-0000-000000000001'::uuid, 'owner-a@task.test'),
  ('83000000-0000-0000-0000-000000000002'::uuid, 'lawyer-a@task.test'),
  ('83000000-0000-0000-0000-000000000003'::uuid, 'suspended-a@task.test'),
  ('83000000-0000-0000-0000-000000000004'::uuid, 'owner-b@task.test')
) fixture(id, email);

insert into public.tenants (
  id, legal_name, display_name, slug, status
) values
  (
    '83100000-0000-0000-0000-000000000001',
    'Task Tenant A Ltda.',
    'Task Tenant A',
    'task-tenant-a',
    'active'
  ),
  (
    '83200000-0000-0000-0000-000000000002',
    'Task Tenant B Ltda.',
    'Task Tenant B',
    'task-tenant-b',
    'active'
  );

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope,
  activated_at, suspended_at
) values
  (
    '83300000-0000-0000-0000-000000000001',
    '83100000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'owner', 'active', 'tenant', now(), null
  ),
  (
    '83300000-0000-0000-0000-000000000002',
    '83100000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000002',
    'lawyer', 'active', 'assigned', now(), null
  ),
  (
    '83300000-0000-0000-0000-000000000003',
    '83100000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000003',
    'lawyer', 'suspended', 'assigned', null, now()
  ),
  (
    '83300000-0000-0000-0000-000000000004',
    '83200000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000004',
    'owner', 'active', 'tenant', now(), null
  );

insert into public.processos (
  id, user_id, numero, area, status, tenant_id
) values
  (
    '83400000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '0000001-00.2026.8.00.0001',
    'Cível',
    'Em andamento',
    '83100000-0000-0000-0000-000000000001'
  ),
  (
    '83400000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000004',
    '0000002-00.2026.8.00.0002',
    'Cível',
    'Em andamento',
    '83200000-0000-0000-0000-000000000002'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    insert into public.tarefas (
      id, user_id, titulo, tenant_id, responsavel_id, processo_id
    ) values (
      '83500000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      'Tarefa válida',
      '83100000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000002',
      '83400000-0000-0000-0000-000000000001'
    )
  $$,
  'aceita responsável ativo e processo do mesmo tenant'
);

select lives_ok(
  $$
    insert into public.tarefas (
      id, user_id, titulo, tenant_id, responsavel_id
    ) values (
      '83500000-0000-0000-0000-000000000002',
      '83000000-0000-0000-0000-000000000001',
      'Fila sem responsável',
      '83100000-0000-0000-0000-000000000001',
      null
    )
  $$,
  'aceita tarefa ainda não atribuída'
);

select throws_ok(
  $$
    insert into public.tarefas (
      user_id, titulo, tenant_id, responsavel_id
    ) values (
      '83000000-0000-0000-0000-000000000001',
      'Responsável suspenso',
      '83100000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000003'
    )
  $$,
  '23514',
  'task_assignee_must_be_active_tenant_member',
  'rejeita responsável suspenso'
);

select throws_ok(
  $$
    insert into public.tarefas (
      user_id, titulo, tenant_id, responsavel_id
    ) values (
      '83000000-0000-0000-0000-000000000001',
      'Responsável de outro tenant',
      '83100000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000004'
    )
  $$,
  '23514',
  'task_assignee_must_be_active_tenant_member',
  'rejeita responsável de outro tenant'
);

select throws_ok(
  $$
    insert into public.tarefas (
      user_id, titulo, tenant_id, processo_id
    ) values (
      '83000000-0000-0000-0000-000000000001',
      'Processo de outro tenant',
      '83100000-0000-0000-0000-000000000001',
      '83400000-0000-0000-0000-000000000002'
    )
  $$,
  '23514',
  'task_process_must_belong_to_tenant',
  'rejeita processo de outro tenant'
);

update public.tarefas
set status = 'concluída'
where id = '83500000-0000-0000-0000-000000000001';

select ok(
  (
    select concluida_em is not null
    from public.tarefas
    where id = '83500000-0000-0000-0000-000000000001'
  ),
  'conclusão preenche concluida_em'
);

update public.tarefas
set status = 'em_andamento'
where id = '83500000-0000-0000-0000-000000000001';

select ok(
  (
    select concluida_em is null
    from public.tarefas
    where id = '83500000-0000-0000-0000-000000000001'
  ),
  'reabertura limpa concluida_em'
);

select lives_ok(
  $$
    insert into public.tarefa_user_state (
      tenant_id, tarefa_id, user_id, lida_em, favorita
    ) values (
      '83100000-0000-0000-0000-000000000001',
      '83500000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      now(),
      true
    )
  $$,
  'usuário salva o próprio estado de leitura e favorita'
);

select throws_ok(
  $$
    insert into public.tarefa_user_state (
      tenant_id, tarefa_id, user_id, favorita
    ) values (
      '83100000-0000-0000-0000-000000000001',
      '83500000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000002',
      true
    )
  $$,
  '42501',
  null,
  'usuário não altera o estado individual de outra pessoa'
);

reset role;

select is(
  (
    select count(*)
    from public.tenant_audit_events
    where target_id = '83500000-0000-0000-0000-000000000001'
      and action = 'task.created'
  ),
  1::bigint,
  'audita a criação da tarefa'
);

select is(
  (
    select count(*)
    from public.tenant_audit_events
    where target_id = '83500000-0000-0000-0000-000000000001'
      and action = 'task.completed'
  ),
  1::bigint,
  'audita a conclusão da tarefa'
);

select is(
  (
    select count(*)
    from public.tenant_audit_events
    where target_id = '83500000-0000-0000-0000-000000000001'
      and action = 'task.reopened'
  ),
  1::bigint,
  'audita a reabertura da tarefa'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-0000-0000-000000000004',
  true
);

select is(
  (
    select count(*)
    from public.tarefas
    where id = '83500000-0000-0000-0000-000000000001'
  ),
  0::bigint,
  'outro tenant não lê a tarefa'
);

select throws_ok(
  $$
    insert into public.tarefas (
      user_id, titulo, tenant_id
    ) values (
      '83000000-0000-0000-0000-000000000004',
      'Tentativa cruzada',
      '83100000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'outro tenant não insere tarefa cruzada'
);

select set_config(
  'request.jwt.claim.sub',
  '83000000-0000-0000-0000-000000000001',
  true
);

select is(
  (
    select count(*)
    from public.tarefa_user_state
    where tarefa_id = '83500000-0000-0000-0000-000000000001'
      and favorita
  ),
  1::bigint,
  'o próprio usuário lê seu estado individual'
);

select * from finish();
rollback;
