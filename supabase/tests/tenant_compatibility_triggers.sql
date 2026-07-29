begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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
      '60000000-0000-0000-0000-000000000001'::uuid,
      'single-tenant@adveyes.test'
    ),
    (
      '60000000-0000-0000-0000-000000000002'::uuid,
      'multi-tenant@adveyes.test'
    ),
    (
      '60000000-0000-0000-0000-000000000003'::uuid,
      'no-tenant@adveyes.test'
    )
) as fixture(id, email);

insert into public.tenants (
  id,
  legal_name,
  display_name,
  slug,
  status
) values
  (
    '61000000-0000-0000-0000-000000000001',
    'Compat A Ltda.',
    'Compat A',
    'compat-a',
    'active'
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    'Compat B Ltda.',
    'Compat B',
    'compat-b',
    'active'
  );

insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  status,
  data_scope,
  activated_at
) values
  (
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    'tenant',
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000002',
    'owner',
    'active',
    'tenant',
    now()
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000002',
    'owner',
    'active',
    'tenant',
    now()
  );

insert into public.clientes (
  id,
  user_id,
  nome,
  tenant_id
) values (
  '63000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002',
  'Cliente pai Compat A',
  '61000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    insert into public.clientes (user_id, nome)
    values (
      '60000000-0000-0000-0000-000000000001',
      'Cliente inferido'
    )
  $$,
  'usuário de um tenant recebe tenant_id automaticamente'
);

select is(
  (
    select tenant_id
    from public.clientes
    where nome = 'Cliente inferido'
  ),
  '61000000-0000-0000-0000-000000000001'::uuid,
  'tenant inferido é o membership ativo'
);

select throws_ok(
  $$
    insert into public.clientes (user_id, nome, tenant_id)
    values (
      '60000000-0000-0000-0000-000000000001',
      'Tenant indevido',
      '62000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  'user is not an active member of the resolved tenant',
  'tenant explícito incompatível é rejeitado'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$
    insert into public.clientes (user_id, nome)
    values (
      '60000000-0000-0000-0000-000000000002',
      'Ambíguo'
    )
  $$,
  '23514',
  'legacy insert requires exactly one active tenant membership',
  'usuário multi-tenant precisa de contexto explícito'
);

select lives_ok(
  $$
    insert into public.financeiro (
      user_id,
      cliente_id,
      tipo,
      descricao,
      valor,
      status
    ) values (
      '60000000-0000-0000-0000-000000000002',
      '63000000-0000-0000-0000-000000000001',
      'receita',
      'Derivado do cliente',
      100,
      'pendente'
    )
  $$,
  'registro filho deriva tenant do pai mesmo para usuário multi-tenant'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000003',
  true
);

select throws_ok(
  $$
    insert into public.clientes (user_id, nome)
    values (
      '60000000-0000-0000-0000-000000000003',
      'Sem membership'
    )
  $$,
  '23514',
  'legacy insert requires exactly one active tenant membership',
  'usuário sem membership é rejeitado'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$
    update public.clientes
    set tenant_id = '62000000-0000-0000-0000-000000000002'
    where nome = 'Cliente inferido'
  $$,
  '23514',
  'tenant_id cannot be reassigned',
  'tenant de registro existente não pode ser trocado'
);

select * from finish();

rollback;
