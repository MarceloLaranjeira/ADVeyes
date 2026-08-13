begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

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
  confirmed_at,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from (values
  (
    '84000000-0000-0000-0000-000000000001'::uuid,
    'owner@signup.test',
    now()
  ),
  (
    '84000000-0000-0000-0000-000000000002'::uuid,
    'unconfirmed@signup.test',
    null::timestamptz
  ),
  (
    '84000000-0000-0000-0000-000000000003'::uuid,
    'rollback@signup.test',
    now()
  ),
  (
    '84000000-0000-0000-0000-000000000004'::uuid,
    'linked@signup.test',
    now()
  ),
  (
    '84000000-0000-0000-0000-000000000005'::uuid,
    'member@signup.test',
    now()
  )
) fixture(id, email, confirmed_at);

insert into public.tenants (
  id, legal_name, display_name, slug, status
) values (
  '84100000-0000-0000-0000-000000000004',
  'Escritório já existente',
  'Escritório existente',
  'escritorio-existente-signup-test',
  'active'
);

insert into public.tenant_memberships (
  tenant_id, user_id, role, status, data_scope, activated_at
) values (
  '84100000-0000-0000-0000-000000000004',
  '84000000-0000-0000-0000-000000000004',
  'owner',
  'active',
  'tenant',
  now()
);

select ok(
  not has_function_privilege(
    'anon',
    'public.provision_self_service_tenant(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anon não executa o provisionamento privilegiado'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.provision_self_service_tenant(uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated não executa o provisionamento diretamente'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.provision_self_service_tenant(uuid,uuid,text)',
    'EXECUTE'
  ),
  'somente o backend service_role possui execução'
);

set local role service_role;

select lives_ok(
  $$
    select * from public.provision_self_service_tenant(
      '84000000-0000-0000-0000-000000000001',
      '84200000-0000-0000-0000-000000000001',
      '  Escritório Ágil & Seguro  '
    )
  $$,
  'provisiona uma identidade confirmada'
);

reset role;

select is(
  (
    select count(*)
    from public.tenants tenant
    where tenant.created_by = '84000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'cria exatamente um tenant'
);

select is(
  (
    select count(*)
    from public.tenant_memberships membership
    where membership.user_id = '84000000-0000-0000-0000-000000000001'
      and membership.role = 'owner'
      and membership.status = 'active'
      and membership.data_scope = 'tenant'
  ),
  1::bigint,
  'cria o proprietário ativo com escopo do escritório'
);

select is(
  (
    select count(*)
    from public.equipe professional
    where professional.user_id = '84000000-0000-0000-0000-000000000001'
      and professional.membership_id is not null
      and professional.cargo = 'administrador'
  ),
  1::bigint,
  'cria o perfil profissional do proprietário para vincular a OAB'
);

select is(
  (
    select count(*)
    from public.tenant_subscriptions subscription
    join public.billing_plans plan on plan.id = subscription.plan_id
    where subscription.created_by = '84000000-0000-0000-0000-000000000001'
      and subscription.status = 'trialing'
      and plan.code = 'solo'
  ),
  1::bigint,
  'cria piloto sobre o plano solo'
);

select is(
  (
    select count(*)
    from public.tenant_onboarding onboarding
    join public.tenants tenant on tenant.id = onboarding.tenant_id
    where tenant.created_by = '84000000-0000-0000-0000-000000000001'
      and onboarding.current_step = 'oab'
      and onboarding.office_completed_at is not null
  ),
  1::bigint,
  'inicia onboarding retomável na OAB'
);

select ok(
  (
    select subscription.trial_ends_at between
      now() + interval '13 days 23 hours'
      and now() + interval '14 days 1 hour'
    from public.tenant_subscriptions subscription
    where subscription.created_by = '84000000-0000-0000-0000-000000000001'
  ),
  'piloto possui janela de 14 dias'
);

set local role service_role;

select lives_ok(
  $$
    select * from public.provision_self_service_tenant(
      '84000000-0000-0000-0000-000000000001',
      '84200000-0000-0000-0000-000000000099',
      'Outro nome ignorado na repetição'
    )
  $$,
  'repetição retorna o provisionamento existente'
);

reset role;

select is(
  (
    select count(*)
    from public.tenants tenant
    where tenant.created_by = '84000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'repetição não duplica tenant'
);

set local role service_role;

select throws_ok(
  $$
    select * from public.provision_self_service_tenant(
      '84000000-0000-0000-0000-000000000002',
      '84200000-0000-0000-0000-000000000002',
      'Sem confirmação'
    )
  $$,
  '28000',
  'signup_email_not_confirmed',
  'rejeita identidade sem e-mail confirmado'
);

select throws_ok(
  $$
    select * from public.provision_self_service_tenant(
      '84000000-0000-0000-0000-000000000004',
      '84200000-0000-0000-0000-000000000004',
      'Já vinculado'
    )
  $$,
  '23505',
  'signup_user_already_linked',
  'rejeita identidade já vinculada a outro escritório'
);

reset role;

update public.billing_plans
set is_active = false
where code = 'solo';

set local role service_role;

select throws_ok(
  $$
    select * from public.provision_self_service_tenant(
      '84000000-0000-0000-0000-000000000003',
      '84200000-0000-0000-0000-000000000003',
      'Rollback completo'
    )
  $$,
  'P0001',
  'signup_trial_plan_unavailable',
  'falha explicitamente sem plano de piloto'
);

reset role;

select is(
  (
    select count(*)
    from public.tenants tenant
    where tenant.created_by = '84000000-0000-0000-0000-000000000003'
  ),
  0::bigint,
  'falha de plano não deixa tenant parcial'
);

update public.billing_plans
set is_active = true
where code = 'solo';

insert into public.tenant_memberships (
  tenant_id, user_id, role, status, data_scope, activated_at
)
select
  tenant.id,
  '84000000-0000-0000-0000-000000000005',
  'lawyer',
  'active',
  'assigned',
  now()
from public.tenants tenant
where tenant.created_by = '84000000-0000-0000-0000-000000000001';

select set_config(
  'test.signup_tenant_id',
  (
    select id::text from public.tenants
    where created_by = '84000000-0000-0000-0000-000000000001'
  ),
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    update public.tenant_onboarding
    set current_step = 'team', oab_skipped_at = now()
    where tenant_id = current_setting('test.signup_tenant_id')::uuid
  $$,
  'owner atualiza o próprio onboarding'
);

select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-0000-0000-000000000005',
  true
);

select is(
  (
    select count(*)
    from public.tenant_onboarding
  ),
  1::bigint,
  'membro ativo lê o onboarding do próprio tenant'
);

update public.tenant_onboarding
set current_step = 'complete'
where tenant_id = current_setting('test.signup_tenant_id')::uuid;

reset role;

select is(
  (
    select current_step
    from public.tenant_onboarding onboarding
    join public.tenants tenant on tenant.id = onboarding.tenant_id
    where tenant.created_by = '84000000-0000-0000-0000-000000000001'
  ),
  'team',
  'membro comum não altera o onboarding'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '84000000-0000-0000-0000-000000000004',
  true
);

select is(
  (
    select count(*)
    from public.tenant_onboarding
  ),
  0::bigint,
  'outro tenant não lê o onboarding provisionado'
);

reset role;

select is(
  (
    select count(*)
    from public.tenant_audit_events event
    join public.tenants tenant on tenant.id = event.tenant_id
    where tenant.created_by = '84000000-0000-0000-0000-000000000001'
      and event.action = 'tenant.self_service_provisioned'
  ),
  1::bigint,
  'provisionamento registra uma auditoria'
);

select * from finish();
rollback;
