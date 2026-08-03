-- Consumo controlado dos provedores pagos.
--
-- Duas travas independentes:
--   1. cota do escritório, vinda do plano contratado;
--   2. teto global da plataforma, que limita a soma de todos os escritórios.
--
-- A segunda existe porque a soma dos planos vendidos pode passar o crédito
-- comprado no provedor. Sem ela, o excedente sairia do bolso da plataforma.

begin;

-- Consultas sob demanda passam a ter cota própria, ao lado de monitoramentos.
update public.billing_plans
set entitlements = entitlements || '{"provider_lookups":50}'::jsonb
where code = 'solo';

update public.billing_plans
set entitlements = entitlements || '{"provider_lookups":200}'::jsonb
where code = 'profissional';

update public.billing_plans
set entitlements = entitlements || '{"provider_lookups":500}'::jsonb
where code = 'escritorio';

update public.billing_plans
set entitlements = entitlements || '{"provider_lookups":1000}'::jsonb
where code = 'performance';

create table public.platform_provider_limits (
  provider text primary key check (provider in ('escavador', 'datajud')),
  monthly_lookup_limit integer not null default 0
    check (monthly_lookup_limit >= 0),
  monthly_monitor_limit integer not null default 0
    check (monthly_monitor_limit >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

-- Começa baixo, para a fase de testes. A conta geral pode elevar depois.
insert into public.platform_provider_limits (
  provider,
  monthly_lookup_limit,
  monthly_monitor_limit,
  notes
)
values (
  'escavador',
  200,
  100,
  'Teto conservador para a fase de testes; elevar conforme a carteira crescer.'
)
on conflict (provider) do nothing;

alter table public.platform_provider_limits enable row level security;
revoke all on table public.platform_provider_limits from anon, authenticated;
grant all on table public.platform_provider_limits to service_role;

-- Operações que consomem crédito. `monitor_check` não entra: a verificação
-- recorrente já está paga pela assinatura do monitoramento.
create or replace function private.is_billable_lookup(p_operation text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_operation in ('oab_discovery', 'process_lookup', 'public_document');
$$;

create or replace function private.provider_usage_this_month(
  p_tenant_id uuid,
  p_provider text,
  p_kind text
)
returns integer
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(sum(usage.quantity), 0)::integer
  from public.legal_usage_events usage
  where usage.provider = p_provider
    and usage.occurred_at >= date_trunc('month', now())
    and (p_tenant_id is null or usage.tenant_id = p_tenant_id)
    and (
      (p_kind = 'lookup' and private.is_billable_lookup(usage.operation))
      or (p_kind = 'monitor' and usage.operation = 'monitor_created')
    );
$$;

-- Responde se o escritório ainda pode consumir o provedor. Devolve o motivo
-- da recusa em vez de apenas negar, para a tela poder explicar ao advogado se
-- o limite atingido é o do plano dele ou o da plataforma.
create or replace function public.provider_quota_check_server(
  p_tenant_id uuid,
  p_provider text,
  p_kind text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  tenant_limit integer;
  tenant_used integer;
  platform_limit integer;
  platform_used integer;
  entitlement_key text;
begin
  if p_kind not in ('lookup', 'monitor') then
    raise exception using message = 'invalid_quota_kind';
  end if;

  entitlement_key := case p_kind
    when 'lookup' then 'provider_lookups'
    else 'monitored_cases'
  end;

  select coalesce((plan.entitlements ->> entitlement_key)::integer, 0)
  into tenant_limit
  from public.tenant_subscriptions subscription
  join public.billing_plans plan on plan.id = subscription.plan_id
  where subscription.tenant_id = p_tenant_id
    and subscription.status in ('trialing', 'active', 'past_due');

  -- Sem assinatura ativa não há cota: o escritório não consome crédito pago.
  tenant_limit := coalesce(tenant_limit, 0);
  tenant_used := private.provider_usage_this_month(
    p_tenant_id,
    p_provider,
    p_kind
  );

  select case p_kind
    when 'lookup' then limits.monthly_lookup_limit
    else limits.monthly_monitor_limit
  end
  into platform_limit
  from public.platform_provider_limits limits
  where limits.provider = p_provider;

  platform_limit := coalesce(platform_limit, 0);
  platform_used := private.provider_usage_this_month(null, p_provider, p_kind);

  if tenant_used + p_quantity > tenant_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_quota_exceeded',
      'limit', tenant_limit,
      'used', tenant_used,
      'platform_limit', platform_limit,
      'platform_used', platform_used
    );
  end if;

  if platform_used + p_quantity > platform_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'platform_quota_exceeded',
      'limit', tenant_limit,
      'used', tenant_used,
      'platform_limit', platform_limit,
      'platform_used', platform_used
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'limit', tenant_limit,
    'used', tenant_used,
    'platform_limit', platform_limit,
    'platform_used', platform_used
  );
end;
$$;

-- Resumo de consumo para a tela do escritório.
create or replace function public.provider_usage_summary_server(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  lookup_state jsonb;
  monitor_state jsonb;
begin
  lookup_state := public.provider_quota_check_server(
    p_tenant_id,
    'escavador',
    'lookup',
    0
  );
  monitor_state := public.provider_quota_check_server(
    p_tenant_id,
    'escavador',
    'monitor',
    0
  );

  return jsonb_build_object(
    'provider', 'escavador',
    'period_start', date_trunc('month', now()),
    'lookups', jsonb_build_object(
      'used', lookup_state -> 'used',
      'limit', lookup_state -> 'limit'
    ),
    'monitors', jsonb_build_object(
      'used', monitor_state -> 'used',
      'limit', monitor_state -> 'limit'
    )
  );
end;
$$;

revoke all on function private.is_billable_lookup(text)
  from public, anon, authenticated;
revoke all on function private.provider_usage_this_month(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.provider_quota_check_server(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.provider_usage_summary_server(uuid)
  from public, anon, authenticated;

grant execute on function public.provider_quota_check_server(uuid, text, text, integer)
  to service_role;
grant execute on function public.provider_usage_summary_server(uuid)
  to service_role;

create index if not exists legal_usage_events_provider_period_idx
  on public.legal_usage_events (provider, occurred_at desc);

comment on table public.platform_provider_limits is
  'Teto global de consumo por provedor; protege o crédito da plataforma.';

commit;
