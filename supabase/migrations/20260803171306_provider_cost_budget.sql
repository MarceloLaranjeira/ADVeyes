-- Trava de custo em reais.
--
-- Limitar por contagem não protege: 100 monitoramentos custam R$ 8 na
-- frequência mensal e R$ 176 na diária. O que precisa ser limitado é o
-- dinheiro, então o preço de cada serviço passa a viver no banco e o consumo
-- é registrado em centavos junto do evento.

begin;

create table public.provider_service_prices (
  provider text not null check (provider in ('escavador', 'datajud')),
  service_code text not null,
  description text not null,
  billing_model text not null check (
    billing_model in ('per_call', 'monthly_per_item')
  ),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  -- Alguns serviços cobram um adicional a cada N itens retornados.
  increment_size integer check (increment_size is null or increment_size > 0),
  increment_price_cents integer
    check (increment_price_cents is null or increment_price_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, service_code)
);

insert into public.provider_service_prices (
  provider, service_code, description, billing_model,
  unit_price_cents, increment_size, increment_price_cents
) values
  ('escavador', 'oab_processes', 'Processos do advogado por OAB',
   'per_call', 450, 200, 5),
  ('escavador', 'involved_processes', 'Processos do envolvido por nome ou CPF',
   'per_call', 450, 200, 5),
  ('escavador', 'lawyer_summary', 'Resumo do advogado por OAB',
   'per_call', 40, null, null),
  ('escavador', 'involved_summary', 'Resumo do envolvido',
   'per_call', 40, null, null),
  ('escavador', 'process_cover', 'Capa do processo',
   'per_call', 5, null, null),
  ('escavador', 'process_parties', 'Envolvidos do processo',
   'per_call', 5, null, null),
  ('escavador', 'process_movements', 'Movimentações do processo',
   'per_call', 5, null, null),
  ('escavador', 'process_ai_summary', 'Resumo do processo por IA',
   'per_call', 5, null, null),
  ('escavador', 'court_update', 'Atualização do processo no tribunal',
   'per_call', 10, null, null),
  ('escavador', 'court_update_public_docs',
   'Atualização com download de documentos públicos',
   'per_call', 20, null, null),
  ('escavador', 'monitor_daily', 'Monitoramento diário',
   'monthly_per_item', 176, null, null),
  ('escavador', 'monitor_weekly', 'Monitoramento semanal',
   'monthly_per_item', 32, null, null),
  ('escavador', 'monitor_monthly', 'Monitoramento mensal',
   'monthly_per_item', 8, null, null),
  ('escavador', 'monitor_daily_docs',
   'Monitoramento diário com documentos públicos',
   'monthly_per_item', 230, null, null),
  ('escavador', 'monitor_weekly_docs',
   'Monitoramento semanal com documentos públicos',
   'monthly_per_item', 55, null, null),
  ('escavador', 'monitor_monthly_docs',
   'Monitoramento mensal com documentos públicos',
   'monthly_per_item', 18, null, null),
  ('escavador', 'monitor_new_processes', 'Monitoramento de novos processos',
   'monthly_per_item', 220, null, null)
on conflict (provider, service_code) do nothing;

alter table public.provider_service_prices enable row level security;
revoke all on table public.provider_service_prices from anon, authenticated;
grant all on table public.provider_service_prices to service_role;

-- O custo real fica gravado junto do consumo: preço muda, histórico não.
alter table public.legal_usage_events
  add column cost_cents integer not null default 0
    check (cost_cents >= 0),
  add column service_code text;

alter table public.platform_provider_limits
  add column monthly_budget_cents integer not null default 0
    check (monthly_budget_cents >= 0);

-- Orçamento conservador para o saldo de R$ 195 durar até novembro.
update public.platform_provider_limits
set monthly_budget_cents = 6000,
    notes = 'Orçamento de R$ 60/mês; elevar conforme a carteira crescer.'
where provider = 'escavador';

-- Cada plano passa a ter um orçamento de provedor embutido no preço.
update public.billing_plans
set entitlements = entitlements || '{"provider_budget_cents":1500}'::jsonb
where code = 'solo';

update public.billing_plans
set entitlements = entitlements || '{"provider_budget_cents":5000}'::jsonb
where code = 'profissional';

update public.billing_plans
set entitlements = entitlements || '{"provider_budget_cents":12000}'::jsonb
where code = 'escritorio';

update public.billing_plans
set entitlements = entitlements || '{"provider_budget_cents":30000}'::jsonb
where code = 'performance';

-- Custo estimado de uma chamada, considerando o adicional por faixa de itens.
create or replace function private.estimate_service_cost(
  p_provider text,
  p_service_code text,
  p_quantity integer default 1,
  p_item_count integer default null
)
returns integer
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  price public.provider_service_prices%rowtype;
  extra_blocks integer := 0;
begin
  select * into price
  from public.provider_service_prices
  where provider = p_provider and service_code = p_service_code;

  if price.service_code is null then
    -- Serviço sem preço cadastrado não pode ser autorizado às cegas.
    raise exception using message = 'unknown_service_price';
  end if;

  if price.increment_size is not null and p_item_count is not null then
    extra_blocks := greatest(
      0,
      ceil(p_item_count::numeric / price.increment_size) - 1
    )::integer;
  end if;

  return (price.unit_price_cents * p_quantity)
    + (coalesce(price.increment_price_cents, 0) * extra_blocks);
end;
$$;

create or replace function private.provider_spend_this_month(
  p_tenant_id uuid,
  p_provider text
)
returns integer
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(sum(usage.cost_cents), 0)::integer
  from public.legal_usage_events usage
  where usage.provider = p_provider
    and usage.occurred_at >= date_trunc('month', now())
    and (p_tenant_id is null or usage.tenant_id = p_tenant_id);
$$;

-- Autoriza pelo custo, não pela contagem. Devolve os dois orçamentos para a
-- tela poder dizer se quem barrou foi o plano ou a plataforma.
create or replace function public.provider_budget_check_server(
  p_tenant_id uuid,
  p_provider text,
  p_service_code text,
  p_quantity integer default 1,
  p_item_count integer default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  estimated integer;
  tenant_budget integer;
  tenant_spent integer;
  platform_budget integer;
  platform_spent integer;
begin
  estimated := private.estimate_service_cost(
    p_provider,
    p_service_code,
    p_quantity,
    p_item_count
  );

  select coalesce(
    (plan.entitlements ->> 'provider_budget_cents')::integer,
    0
  )
  into tenant_budget
  from public.tenant_subscriptions subscription
  join public.billing_plans plan on plan.id = subscription.plan_id
  where subscription.tenant_id = p_tenant_id
    and subscription.status in ('trialing', 'active', 'past_due');

  tenant_budget := coalesce(tenant_budget, 0);
  tenant_spent := private.provider_spend_this_month(p_tenant_id, p_provider);

  select limits.monthly_budget_cents
  into platform_budget
  from public.platform_provider_limits limits
  where limits.provider = p_provider;

  platform_budget := coalesce(platform_budget, 0);
  platform_spent := private.provider_spend_this_month(null, p_provider);

  if tenant_spent + estimated > tenant_budget then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'tenant_budget_exceeded',
      'estimated_cents', estimated,
      'budget_cents', tenant_budget,
      'spent_cents', tenant_spent,
      'platform_budget_cents', platform_budget,
      'platform_spent_cents', platform_spent
    );
  end if;

  if platform_spent + estimated > platform_budget then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'platform_budget_exceeded',
      'estimated_cents', estimated,
      'budget_cents', tenant_budget,
      'spent_cents', tenant_spent,
      'platform_budget_cents', platform_budget,
      'platform_spent_cents', platform_spent
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'estimated_cents', estimated,
    'budget_cents', tenant_budget,
    'spent_cents', tenant_spent,
    'platform_budget_cents', platform_budget,
    'platform_spent_cents', platform_spent
  );
end;
$$;

-- Resumo em reais para a tela do escritório.
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
  tenant_budget integer;
  tenant_spent integer;
  monitors_used integer;
  monitors_limit integer;
begin
  select coalesce(
    (plan.entitlements ->> 'provider_budget_cents')::integer,
    0
  ),
  coalesce((plan.entitlements ->> 'monitored_cases')::integer, 0)
  into tenant_budget, monitors_limit
  from public.tenant_subscriptions subscription
  join public.billing_plans plan on plan.id = subscription.plan_id
  where subscription.tenant_id = p_tenant_id
    and subscription.status in ('trialing', 'active', 'past_due');

  tenant_spent := private.provider_spend_this_month(p_tenant_id, 'escavador');

  select count(*)::integer
  into monitors_used
  from public.legal_provider_monitors monitor
  where monitor.tenant_id = p_tenant_id
    and monitor.status not in ('removed', 'failed');

  return jsonb_build_object(
    'provider', 'escavador',
    'period_start', date_trunc('month', now()),
    'budget_cents', coalesce(tenant_budget, 0),
    'spent_cents', coalesce(tenant_spent, 0),
    'monitors', jsonb_build_object(
      'used', coalesce(monitors_used, 0),
      'limit', coalesce(monitors_limit, 0)
    )
  );
end;
$$;

revoke all on function private.estimate_service_cost(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function private.provider_spend_this_month(uuid, text)
  from public, anon, authenticated;
revoke all on function public.provider_budget_check_server(
  uuid, text, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.provider_budget_check_server(
  uuid, text, text, integer, integer
) to service_role;

comment on table public.provider_service_prices is
  'Preço de cada serviço do provedor; base do cálculo da trava de custo.';
comment on column public.legal_usage_events.cost_cents is
  'Custo real do evento em centavos, congelado no momento do consumo.';

commit;
