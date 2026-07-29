begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'rls-a@adveyes.test',
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
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'rls-b@adveyes.test',
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
  status
) values
  (
    '10000000-0000-0000-0000-000000000099',
    'Tenant RLS Baseline A Ltda.',
    'Tenant RLS Baseline A',
    'tenant-rls-baseline-a',
    'active'
  ),
  (
    '20000000-0000-0000-0000-000000000099',
    'Tenant RLS Baseline B Ltda.',
    'Tenant RLS Baseline B',
    'tenant-rls-baseline-b',
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
    '20000000-0000-0000-0000-000000000099',
    '10000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    'tenant',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000099',
    '20000000-0000-0000-0000-000000000002',
    'lawyer',
    'active',
    'assigned',
    now()
  );

insert into public.clientes (id, user_id, nome)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Cliente do usuário A'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Cliente do usuário B'
  );

insert into public.processos (id, user_id, numero, area, status)
values
  (
    '12000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'RLS-A',
    'Cível',
    'ativo'
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'RLS-B',
    'Cível',
    'ativo'
  );

insert into public.financeiro (
  id,
  user_id,
  tipo,
  descricao,
  valor,
  status
) values
  (
    '13000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'receita',
    'Financeiro do usuário A',
    10,
    'pendente'
  ),
  (
    '24000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'receita',
    'Financeiro do usuário B',
    20,
    'pendente'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.clientes where nome like 'Cliente do usuário %'),
  1::bigint,
  'usuário A lê somente o próprio cliente'
);

select is(
  (select count(*) from public.processos where numero like 'RLS-%'),
  1::bigint,
  'usuário A lê somente o próprio processo'
);

select is(
  (
    select count(*)
    from public.financeiro
    where descricao like 'Financeiro do usuário %'
  ),
  1::bigint,
  'usuário A lê somente o próprio lançamento financeiro'
);

select is(
  (
    select count(*)
    from public.asaas_subscriptions
    where user_id in (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
  ),
  1::bigint,
  'usuário A lê somente a própria assinatura'
);

select throws_ok(
  $$
    insert into public.clientes (user_id, nome)
    values (
      '20000000-0000-0000-0000-000000000002',
      'Cliente indevido'
    )
  $$,
  '42501',
  null,
  'usuário A não cria cliente para o usuário B'
);

select results_eq(
  $$
    update public.processos
    set descricao = 'alteração indevida'
    where id = '23000000-0000-0000-0000-000000000002'
    returning id
  $$,
  $$
    select id
    from public.processos
    where false
  $$,
  'usuário A não atualiza processo invisível do usuário B'
);

select is(
  (
    select count(*)
    from public.processos
    where id = '23000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'processo do usuário B permanece invisível ao usuário A'
);

select is(
  (
    select count(*)
    from public.clientes
    where id = '22000000-0000-0000-0000-000000000002'
  ),
  0::bigint,
  'cliente do usuário B permanece invisível ao usuário A'
);

select * from finish();

rollback;
