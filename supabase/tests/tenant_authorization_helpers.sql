begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

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
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
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
from (
  values
    (
      '50000000-0000-0000-0000-000000000001'::uuid,
      'owner-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000002'::uuid,
      'admin-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000003'::uuid,
      'lawyer-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000004'::uuid,
      'assistant-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000005'::uuid,
      'finance-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000006'::uuid,
      'suspended-helper@adveyes.test'
    ),
    (
      '50000000-0000-0000-0000-000000000007'::uuid,
      'outsider-helper@adveyes.test'
    )
) as fixture(id, email);

insert into public.tenants (
  id,
  legal_name,
  display_name,
  slug,
  status
) values (
  '51000000-0000-0000-0000-000000000001',
  'Tenant Helpers Ltda.',
  'Tenant Helpers',
  'tenant-helpers',
  'active'
);

insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  status,
  data_scope,
  permission_overrides,
  activated_at,
  suspended_at
) values
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    'tenant',
    '{}'::jsonb,
    now(),
    null
  ),
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    'admin',
    'active',
    'tenant',
    '{}'::jsonb,
    now(),
    null
  ),
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    'lawyer',
    'active',
    'assigned',
    '{"finance":{"read":true}}'::jsonb,
    now(),
    null
  ),
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000004',
    'assistant',
    'active',
    'team',
    '{}'::jsonb,
    now(),
    null
  ),
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000005',
    'finance',
    'active',
    'tenant',
    '{}'::jsonb,
    now(),
    null
  ),
  (
    '51000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000006',
    'lawyer',
    'suspended',
    'tenant',
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.platform_admins (user_id, granted_by)
values (
  '50000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001'
);

select ok(
  private.is_platform_admin(
    '50000000-0000-0000-0000-000000000001'
  ),
  'platform admin ativo é reconhecido'
);
select isnt(
  private.is_platform_admin(
    '50000000-0000-0000-0000-000000000007'
  ),
  true,
  'usuário comum não é platform admin'
);
select ok(
  private.is_active_tenant_member(
    '50000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001'
  ),
  'membership ativa é reconhecida'
);
select isnt(
  private.is_active_tenant_member(
    '50000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000001'
  ),
  true,
  'membership suspensa não é ativa'
);
select is(
  private.tenant_role(
    '50000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001'
  ),
  'owner',
  'papel ativo é retornado'
);
select is(
  private.tenant_role(
    '50000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000001'
  ),
  null,
  'papel suspenso não é retornado'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000001',
  true
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'subscription',
    'manage'
  ),
  'owner gerencia assinatura'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000002',
  true
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'subscription',
    'read'
  ),
  'admin lê assinatura'
);
select isnt(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'subscription',
    'manage'
  ),
  true,
  'admin não gerencia assinatura'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000003',
  true
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'legal',
    'read'
  ),
  'lawyer pode ler dados jurídicos'
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'finance',
    'read'
  ),
  'override libera leitura financeira do lawyer'
);
select isnt(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'finance',
    'update'
  ),
  true,
  'override de leitura não libera escrita financeira'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000004',
  true
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'legal',
    'read'
  ),
  'assistant pode ler dados jurídicos conforme escopo'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000005',
  true
);
select ok(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'finance',
    'update'
  ),
  'finance pode operar módulo financeiro'
);
select isnt(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'legal',
    'read'
  ),
  true,
  'finance não lê dados jurídicos por padrão'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000006',
  true
);
select isnt(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'legal',
    'read'
  ),
  true,
  'suspenso não possui permissão'
);

select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000007',
  true
);
select isnt(
  private.has_tenant_permission(
    '51000000-0000-0000-0000-000000000001',
    'legal',
    'read'
  ),
  true,
  'usuário externo não possui permissão'
);

select ok(
  private.can_access_tenant_record(
    '50000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    'legal',
    '52000000-0000-0000-0000-000000000001'
  ),
  'owner acessa registro jurídico do tenant'
);
select isnt(
  private.can_access_tenant_record(
    '50000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000001',
    'legal',
    '52000000-0000-0000-0000-000000000001'
  ),
  true,
  'assigned nega até existir atribuição explícita'
);
select isnt(
  private.can_access_tenant_record(
    '50000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000001',
    'legal',
    '52000000-0000-0000-0000-000000000001'
  ),
  true,
  'team nega até existir atribuição explícita'
);
select ok(
  private.can_access_tenant_record(
    '50000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000001',
    'financeiro',
    '52000000-0000-0000-0000-000000000001'
  ),
  'finance acessa registro financeiro'
);
select isnt(
  private.can_access_tenant_record(
    '50000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000001',
    'legal',
    '52000000-0000-0000-0000-000000000001'
  ),
  true,
  'finance não acessa registro jurídico'
);

select throws_ok(
  $$
    select private.is_platform_admin(
      '50000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'authenticated não executa helper de platform admin'
);

set local role anon;
select throws_ok(
  $$
    select private.is_active_tenant_member(
      '50000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  null,
  'anon não executa helpers de tenant'
);

select * from finish();

rollback;
