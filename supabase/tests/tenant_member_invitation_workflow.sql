begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_column(
  'public',
  'equipe',
  'membership_id',
  'equipe possui vínculo opcional com membership'
);

select has_function(
  'public',
  'tenant_invite_member_server',
  array[
    'uuid',
    'uuid',
    'jsonb',
    'text',
    'text',
    'uuid',
    'text',
    'timestamp with time zone'
  ],
  'RPC server-only de convite existe'
);

select has_function(
  'public',
  'tenant_accept_invite_server',
  array['uuid', 'text'],
  'RPC server-only de aceite existe'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner-invite@adveyes.test',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'admin-invite@adveyes.test',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'lawyer-invite@adveyes.test',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'invitee@adveyes.test',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'different@adveyes.test',
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
  );

insert into public.tenants (
  id,
  legal_name,
  display_name,
  slug,
  status,
  created_by
) values (
  '82000000-0000-0000-0000-000000000001',
  'Convites Teste Ltda.',
  'Convites Teste',
  'convites-teste',
  'active',
  '81000000-0000-0000-0000-000000000001'
);

insert into public.tenant_memberships (
  id,
  tenant_id,
  user_id,
  role,
  status,
  data_scope,
  activated_at
) values
  (
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    'tenant',
    now()
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000002',
    'admin',
    'active',
    'tenant',
    now()
  ),
  (
    '83000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000003',
    'lawyer',
    'active',
    'assigned',
    now()
  );

select lives_ok(
  $$
    select public.tenant_invite_member_server(
      '81000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000001',
      '{"name":"Pessoa Convidada","email":"invitee@adveyes.test","jobTitle":"advogado"}',
      'lawyer',
      'assigned',
      null,
      repeat('a', 64),
      now() + interval '7 days'
    )
  $$,
  'owner pode criar convite'
);

select is(
  (
    select count(*)
    from public.tenant_invitations
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and status = 'pending'
  ),
  1::bigint,
  'existe um convite pendente'
);

select throws_ok(
  $$
    select public.tenant_invite_member_server(
      '81000000-0000-0000-0000-000000000003',
      '82000000-0000-0000-0000-000000000001',
      '{"name":"Sem Permissão","email":"blocked@adveyes.test"}',
      'assistant',
      'assigned',
      null,
      repeat('c', 64),
      now() + interval '7 days'
    )
  $$,
  '42501',
  'permission_denied',
  'advogado não cria convite'
);

select lives_ok(
  $$
    select public.tenant_invite_member_server(
      '81000000-0000-0000-0000-000000000002',
      '82000000-0000-0000-0000-000000000001',
      '{"name":"Pessoa Convidada","email":"invitee@adveyes.test","jobTitle":"advogado"}',
      'lawyer',
      'assigned',
      null,
      repeat('b', 64),
      now() + interval '7 days'
    )
  $$,
  'admin pode reenviar convite'
);

select is(
  (
    select count(*)
    from public.tenant_invitations
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and lower(email::text) = 'invitee@adveyes.test'
      and status = 'pending'
  ),
  1::bigint,
  'reenvio mantém somente um convite pendente'
);

select throws_ok(
  $$
    select public.tenant_accept_invite_server(
      '81000000-0000-0000-0000-000000000005',
      repeat('b', 64)
    )
  $$,
  '42501',
  'email_mismatch',
  'e-mail diferente não aceita convite'
);

select lives_ok(
  $$
    select public.tenant_accept_invite_server(
      '81000000-0000-0000-0000-000000000004',
      repeat('b', 64)
    )
  $$,
  'e-mail convidado aceita convite'
);

select is(
  (
    select role || ':' || data_scope || ':' || status
    from public.tenant_memberships
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and user_id = '81000000-0000-0000-0000-000000000004'
  ),
  'lawyer:assigned:active',
  'membership é ativada com papel e alcance do convite'
);

select throws_ok(
  $$
    select public.tenant_accept_invite_server(
      '81000000-0000-0000-0000-000000000004',
      repeat('b', 64)
    )
  $$,
  'P0001',
  'already_accepted',
  'convite aceito não pode ser reutilizado'
);

select lives_ok(
  $$
    select public.tenant_manage_member_server(
      '81000000-0000-0000-0000-000000000002',
      '82000000-0000-0000-0000-000000000001',
      (
        select id
        from public.tenant_memberships
        where tenant_id = '82000000-0000-0000-0000-000000000001'
          and user_id = '81000000-0000-0000-0000-000000000004'
      ),
      'suspend'
    )
  $$,
  'admin pode suspender membro'
);

select is(
  (
    select count(*)
    from public.equipe
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and lower(email) = 'invitee@adveyes.test'
      and ativo = false
  ),
  1::bigint,
  'suspensão preserva o perfil profissional inativo'
);

select lives_ok(
  $$
    select public.tenant_manage_member_server(
      '81000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000001',
      (
        select id
        from public.tenant_memberships
        where tenant_id = '82000000-0000-0000-0000-000000000001'
          and user_id = '81000000-0000-0000-0000-000000000004'
      ),
      'reactivate'
    )
  $$,
  'owner pode reativar membro'
);

select ok(
  (
    select status = 'active'
    from public.tenant_memberships
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and user_id = '81000000-0000-0000-0000-000000000004'
  ),
  'membership reativada volta ao estado ativo'
);

select ok(
  (
    select count(*) >= 4
    from public.tenant_audit_events
    where tenant_id = '82000000-0000-0000-0000-000000000001'
      and action in (
        'member.invited',
        'member.invite_accepted',
        'member.suspend',
        'member.reactivate'
      )
  ),
  'ações administrativas geram auditoria'
);

select * from finish();

rollback;
