begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'lawyer_registrations', 'cadastro estruturado de OAB existe');
select has_table('public', 'process_discoveries', 'caixa de processos candidatos existe');
select has_table('public', 'process_lawyers', 'vínculo processo-advogado existe');
select has_table('public', 'legal_provider_monitors', 'monitoramento por provedor existe');
select has_table('public', 'process_movements', 'movimentações normalizadas existem');
select has_table('public', 'legal_provider_events', 'eventos externos idempotentes existem');
select has_table('public', 'legal_usage_events', 'medição de consumo jurídico existe');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'legal-owner-a@adveyes.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'legal-lawyer-a@adveyes.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'legal-owner-b@adveyes.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

insert into public.tenants (
  id, legal_name, display_name, slug, status, created_by
) values
  (
    '92000000-0000-0000-0000-000000000001',
    'Jurídico A Ltda.', 'Jurídico A', 'juridico-a', 'active',
    '91000000-0000-0000-0000-000000000001'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    'Jurídico B Ltda.', 'Jurídico B', 'juridico-b', 'active',
    '91000000-0000-0000-0000-000000000003'
  );

insert into public.tenant_memberships (
  id, tenant_id, user_id, role, status, data_scope, activated_at
) values
  (
    '93000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'owner', 'active', 'tenant', now()
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002',
    'lawyer', 'active', 'tenant', now()
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000003',
    'owner', 'active', 'tenant', now()
  );

insert into public.equipe (
  id, tenant_id, user_id, membership_id, nome, email, cargo, oab, ativo
) values
  (
    '94000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000002',
    '93000000-0000-0000-0000-000000000002',
    'Advogado A', 'legal-lawyer-a@adveyes.test', 'advogado', '1234-AM', true
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000003',
    '93000000-0000-0000-0000-000000000003',
    'Advogado B', 'legal-owner-b@adveyes.test', 'advogado', '1234-AM', true
  );

insert into public.lawyer_registrations (
  id, tenant_id, professional_id, oab_number, oab_state, oab_type, status
) values
  (
    '95000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '94000000-0000-0000-0000-000000000001',
    '1234', 'AM', 'ADVOGADO', 'verified'
  ),
  (
    '95000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    '94000000-0000-0000-0000-000000000002',
    '1234', 'AM', 'ADVOGADO', 'verified'
  );

insert into public.process_discoveries (
  id, tenant_id, lawyer_registration_id, numero_cnj, provider, state
) values
  (
    '96000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000001',
    '0000001-00.2026.8.04.0001', 'escavador', 'candidate'
  ),
  (
    '96000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000002',
    '95000000-0000-0000-0000-000000000002',
    '0000001-00.2026.8.04.0001', 'escavador', 'candidate'
  );

select lives_ok(
  $$
    insert into public.legal_provider_events (
      provider, external_event_id, event_type, payload
    ) values (
      'escavador', 'event-1', 'nova_movimentacao', '{"event":"event-1"}'
    )
  $$,
  'evento desconhecido pode entrar em quarentena sem tenant'
);

select throws_ok(
  $$
    insert into public.legal_provider_events (
      provider, external_event_id, event_type, payload
    ) values (
      'escavador', 'event-1', 'nova_movimentacao', '{"event":"event-1"}'
    )
  $$,
  '23505',
  null,
  'evento externo duplicado é bloqueado'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.process_discoveries),
  1::bigint,
  'owner enxerga apenas candidatos do próprio tenant'
);

select is(
  (select count(*) from public.lawyer_registrations),
  1::bigint,
  'owner enxerga apenas OABs do próprio tenant'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000002',
  true
);

select is(
  (select count(*) from public.legal_usage_events),
  0::bigint,
  'advogado não lê consumo administrativo'
);

select throws_ok(
  $$
    insert into public.process_discoveries (
      tenant_id, lawyer_registration_id, numero_cnj, provider
    ) values (
      '92000000-0000-0000-0000-000000000001',
      '95000000-0000-0000-0000-000000000001',
      '0000002-00.2026.8.04.0001',
      'escavador'
    )
  $$,
  '42501',
  null,
  'navegador não grava candidatos diretamente'
);

select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-0000-0000-000000000003',
  true
);

select is(
  (select count(*) from public.process_discoveries),
  1::bigint,
  'segundo tenant enxerga apenas seus candidatos'
);

select * from finish();

rollback;
