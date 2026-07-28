begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('public', 'tenants', 'tabela tenants existe');
select has_table(
  'public',
  'tenant_memberships',
  'tabela tenant_memberships existe'
);
select has_table('public', 'tenant_teams', 'tabela tenant_teams existe');
select has_table(
  'public',
  'tenant_team_members',
  'tabela tenant_team_members existe'
);
select has_table(
  'public',
  'tenant_brand_settings',
  'tabela tenant_brand_settings existe'
);
select has_table(
  'public',
  'platform_admins',
  'tabela platform_admins existe'
);
select has_table(
  'public',
  'tenant_invitations',
  'tabela tenant_invitations existe'
);
select has_table(
  'public',
  'tenant_audit_events',
  'tabela tenant_audit_events existe'
);
select has_table(
  'public',
  'tenant_admin_overrides',
  'tabela tenant_admin_overrides existe'
);

select is(
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'platform_admins',
        'tenants',
        'tenant_memberships',
        'tenant_teams',
        'tenant_team_members',
        'tenant_brand_settings',
        'tenant_invitations',
        'tenant_audit_events',
        'tenant_admin_overrides'
      )
      and relation.relrowsecurity
  ),
  9::bigint,
  'RLS está habilitado nas nove tabelas administrativas'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'platform_admins',
        'tenants',
        'tenant_memberships',
        'tenant_teams',
        'tenant_team_members',
        'tenant_brand_settings',
        'tenant_invitations',
        'tenant_audit_events',
        'tenant_admin_overrides'
      )
  ),
  0::bigint,
  'fundação não cria policy permissiva temporária'
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
    '30000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'owner-a@adveyes.test',
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
    '40000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'member-a@adveyes.test',
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
  '31000000-0000-0000-0000-000000000003',
  'Escritório Teste A Ltda.',
  'Escritório Teste A',
  'escritorio-a',
  'trialing',
  '30000000-0000-0000-0000-000000000003'
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
    '32000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'owner',
    'active',
    'tenant',
    now()
  ),
  (
    '42000000-0000-0000-0000-000000000004',
    '31000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000004',
    'lawyer',
    'active',
    'assigned',
    now()
  );

select throws_ok(
  $$
    insert into public.tenants (legal_name, display_name, slug)
    values ('Duplicado Ltda.', 'Duplicado', 'ESCRITORIO-A')
  $$,
  '23514',
  null,
  'slug precisa estar normalizado em minúsculas'
);

select throws_ok(
  $$
    insert into public.tenants (legal_name, display_name, slug)
    values ('Duplicado Ltda.', 'Duplicado', 'escritorio-a')
  $$,
  '23505',
  null,
  'slug duplicado é rejeitado'
);

select throws_ok(
  $$
    insert into public.tenants (legal_name, display_name, slug)
    values ('Reservado Ltda.', 'Reservado', 'admin')
  $$,
  '23514',
  null,
  'slug reservado é rejeitado'
);

select throws_ok(
  $$
    insert into public.tenants (legal_name, display_name, slug, status)
    values ('Inválido Ltda.', 'Inválido', 'invalido', 'unknown')
  $$,
  '23514',
  null,
  'status de tenant inválido é rejeitado'
);

select throws_ok(
  $$
    insert into public.tenant_memberships (
      tenant_id,
      user_id,
      role,
      status,
      data_scope,
      activated_at
    ) values (
      '31000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000004',
      'root',
      'active',
      'tenant',
      now()
    )
  $$,
  '23514',
  null,
  'papel de membership inválido é rejeitado'
);

select throws_ok(
  $$
    update public.tenant_memberships
    set
      status = 'suspended',
      suspended_at = now()
    where id = '32000000-0000-0000-0000-000000000003'
  $$,
  '23514',
  'tenant must retain at least one active owner',
  'último owner ativo não pode ser suspenso'
);

select throws_ok(
  $$
    delete from public.tenant_memberships
    where id = '32000000-0000-0000-0000-000000000003'
  $$,
  '23514',
  'tenant must retain at least one active owner',
  'último owner ativo não pode ser removido'
);

select lives_ok(
  $$
    update public.tenant_memberships
    set
      status = 'suspended',
      suspended_at = now()
    where id = '42000000-0000-0000-0000-000000000004'
  $$,
  'membro que não é owner pode ser suspenso'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$
    insert into public.tenants (legal_name, display_name, slug)
    values ('Sem API Ltda.', 'Sem API', 'sem-api')
  $$,
  '42501',
  null,
  'authenticated não escreve diretamente nas tabelas administrativas'
);

select * from finish();

rollback;
