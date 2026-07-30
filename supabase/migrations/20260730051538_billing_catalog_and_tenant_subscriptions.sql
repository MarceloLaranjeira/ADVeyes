create table public.billing_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  version integer not null check (version > 0),
  name text not null check (length(btrim(name)) between 2 and 80),
  rank integer not null check (rank > 0),
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  annual_price_cents integer not null check (annual_price_cents > 0),
  activation_fee_cents integer not null check (activation_fee_cents >= 0),
  entitlements jsonb not null check (jsonb_typeof(entitlements) = 'object'),
  features jsonb not null check (jsonb_typeof(features) = 'array'),
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  unique (rank, version),
  constraint billing_plans_lifecycle_valid check (
    retired_at is null or retired_at >= effective_at
  )
);

create table public.billing_addons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  version integer not null check (version > 0),
  name text not null check (length(btrim(name)) between 2 and 100),
  price_cents integer not null check (price_cents > 0),
  billing_model text not null check (
    billing_model in ('recurring', 'prepaid', 'implementation')
  ),
  unit_entitlements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(unit_entitlements) = 'object'),
  min_plan_rank integer not null default 1 check (min_plan_rank > 0),
  validity_days integer check (validity_days is null or validity_days > 0),
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  constraint billing_addons_lifecycle_valid check (
    retired_at is null or retired_at >= effective_at
  )
);

create table public.tenant_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  plan_id uuid references public.billing_plans(id) on delete restrict,
  status text not null default 'trialing' check (
    status in ('trialing', 'pending', 'active', 'past_due', 'canceled')
  ),
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  price_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(price_snapshot) = 'object'),
  asaas_customer_id text unique,
  asaas_subscription_id text unique,
  next_due_date date,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_subscriptions_contract_valid check (
    (status = 'trialing' and trial_ends_at is not null)
    or status <> 'trialing'
  )
);

create table public.tenant_subscription_items (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  subscription_id uuid not null references public.tenant_subscriptions(id)
    on delete cascade,
  addon_id uuid not null references public.billing_addons(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (
    status in ('pending', 'active', 'canceled', 'expired')
  ),
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  starts_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, addon_id),
  unique (tenant_id, id),
  constraint tenant_subscription_items_expiry_valid check (
    expires_at is null or starts_at is null or expires_at > starts_at
  )
);

create table public.billing_checkout_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  plan_id uuid not null references public.billing_plans(id) on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  status text not null default 'creating' check (
    status in ('creating', 'pending', 'paid', 'failed', 'canceled')
  ),
  idempotency_key uuid not null unique,
  selection jsonb not null default '{}'::jsonb
    check (jsonb_typeof(selection) = 'object'),
  pricing_snapshot jsonb not null check (jsonb_typeof(pricing_snapshot) = 'object'),
  recurring_total_cents integer not null check (recurring_total_cents > 0),
  initial_total_cents integer not null check (initial_total_cents > 0),
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_initial_payment_id text unique,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload_hash text not null,
  status text not null default 'received' check (
    status in ('received', 'processed', 'ignored', 'failed')
  ),
  tenant_id uuid references public.tenants(id) on delete set null,
  checkout_order_id uuid references public.billing_checkout_orders(id)
    on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index tenant_subscription_items_tenant_status_idx
  on public.tenant_subscription_items (tenant_id, status);
create index billing_checkout_orders_tenant_created_idx
  on public.billing_checkout_orders (tenant_id, created_at desc);
create index billing_checkout_orders_customer_idx
  on public.billing_checkout_orders (asaas_customer_id)
  where asaas_customer_id is not null;
create index billing_webhook_events_tenant_received_idx
  on public.billing_webhook_events (tenant_id, received_at desc);

create or replace function private.touch_billing_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger billing_plans_touch_updated_at
before update on public.billing_plans
for each row execute function private.touch_billing_updated_at();

create trigger billing_addons_touch_updated_at
before update on public.billing_addons
for each row execute function private.touch_billing_updated_at();

create trigger tenant_subscriptions_touch_updated_at
before update on public.tenant_subscriptions
for each row execute function private.touch_billing_updated_at();

create trigger tenant_subscription_items_touch_updated_at
before update on public.tenant_subscription_items
for each row execute function private.touch_billing_updated_at();

create trigger billing_checkout_orders_touch_updated_at
before update on public.billing_checkout_orders
for each row execute function private.touch_billing_updated_at();

insert into public.billing_plans (
  code,
  version,
  name,
  rank,
  monthly_price_cents,
  annual_price_cents,
  activation_fee_cents,
  entitlements,
  features
)
values
  (
    'solo', 1, 'Solo', 1, 7900, 79000, 7900,
    '{"users":1,"monitored_cases":100,"search_terms":1,"ai_credits":100}'::jsonb,
    '["processes_contacts","calendar_google","tasks_deadlines_publications","client_portal"]'::jsonb
  ),
  (
    'profissional', 1, 'Profissional', 2, 27900, 279000, 27900,
    '{"users":3,"monitored_cases":400,"search_terms":3,"ai_credits":500}'::jsonb,
    '["processes_contacts","calendar_google","tasks_deadlines_publications","client_portal","crm_finance_contracts","automations_reports","roles_permissions"]'::jsonb
  ),
  (
    'escritorio', 1, 'Escritório', 3, 61900, 619000, 61900,
    '{"users":10,"monitored_cases":1000,"search_terms":7,"ai_credits":2000}'::jsonb,
    '["processes_contacts","calendar_google","tasks_deadlines_publications","client_portal","crm_finance_contracts","automations_reports","roles_permissions","advanced_teams_visibility","audit_advanced_reports","white_label_eligible"]'::jsonb
  ),
  (
    'performance', 1, 'Performance', 4, 109900, 1099000, 109900,
    '{"users":30,"monitored_cases":2500,"search_terms":15,"ai_credits":6000}'::jsonb,
    '["processes_contacts","calendar_google","tasks_deadlines_publications","client_portal","crm_finance_contracts","automations_reports","roles_permissions","advanced_teams_visibility","audit_advanced_reports","white_label_eligible","api_webhooks_bi","assisted_onboarding_sla"]'::jsonb
  );

insert into public.billing_addons (
  code,
  version,
  name,
  price_cents,
  billing_model,
  unit_entitlements,
  min_plan_rank,
  validity_days
)
values
  (
    'extra_user', 1, 'Usuário adicional', 4900, 'recurring',
    '{"users":1}'::jsonb, 1, null
  ),
  (
    'extra_monitoring_100', 1, '100 monitoramentos adicionais', 4900,
    'recurring', '{"monitored_cases":100}'::jsonb, 1, null
  ),
  (
    'extra_search_term', 1, 'Termo OAB ou nome adicional', 3900,
    'recurring', '{"search_terms":1}'::jsonb, 1, null
  ),
  (
    'ai_credits_500', 1, '500 créditos de IA', 3900, 'prepaid',
    '{"ai_credits":500}'::jsonb, 1, 90
  ),
  (
    'white_label_monthly', 1, 'White-label mensal', 34900, 'recurring',
    '{"white_label":true}'::jsonb, 3, null
  ),
  (
    'white_label_implementation', 1, 'Implantação white-label', 249000,
    'implementation', '{"white_label_setup":true}'::jsonb, 3, null
  );

-- Migra o cadastro Asaas do proprietário para o escritório, sem criar cobrança.
insert into public.tenant_subscriptions (
  tenant_id,
  plan_id,
  status,
  billing_cycle,
  price_snapshot,
  asaas_customer_id,
  asaas_subscription_id,
  next_due_date,
  trial_ends_at,
  created_by
)
select
  membership.tenant_id,
  plan.id,
  case legacy.status
    when 'active' then 'active'
    when 'overdue' then 'past_due'
    when 'cancelled' then 'canceled'
    when 'trial' then 'trialing'
    else 'pending'
  end,
  case when legacy.status = 'trial' then null else 'monthly' end,
  jsonb_build_object(
    'source', 'legacy_user_subscription',
    'legacy_plan', legacy.plan,
    'catalog_code', plan.code,
    'catalog_version', plan.version
  ),
  legacy.asaas_customer_id,
  legacy.asaas_subscription_id,
  legacy.next_due_date,
  case when legacy.status = 'trial'
    then greatest(legacy.trial_ends_at, now() + interval '14 days')
    else null
  end,
  membership.user_id
from public.tenant_memberships membership
join public.asaas_subscriptions legacy
  on legacy.user_id = membership.user_id
join public.billing_plans plan
  on plan.code = case legacy.plan
    when 'starter' then 'solo'
    when 'solo' then 'solo'
    when 'profissional' then 'profissional'
    when 'escritorio' then 'escritorio'
    when 'performance' then 'performance'
    else 'solo'
  end
  and plan.version = 1
where membership.role = 'owner'
  and membership.status = 'active'
on conflict (tenant_id) do nothing;

alter table public.billing_plans enable row level security;
alter table public.billing_addons enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_subscription_items enable row level security;
alter table public.billing_checkout_orders enable row level security;
alter table public.billing_webhook_events enable row level security;

revoke all privileges on table
  public.billing_plans,
  public.billing_addons,
  public.tenant_subscriptions,
  public.tenant_subscription_items,
  public.billing_checkout_orders,
  public.billing_webhook_events
from anon, authenticated;

grant select on table public.billing_plans, public.billing_addons
  to authenticated;
grant select on table
  public.tenant_subscriptions,
  public.tenant_subscription_items,
  public.billing_checkout_orders
to authenticated;

grant all privileges on table
  public.billing_plans,
  public.billing_addons,
  public.tenant_subscriptions,
  public.tenant_subscription_items,
  public.billing_checkout_orders,
  public.billing_webhook_events
to service_role;

create policy billing_plans_read_active
on public.billing_plans
for select
to authenticated
using (is_active and effective_at <= now() and retired_at is null);

create policy billing_addons_read_active
on public.billing_addons
for select
to authenticated
using (is_active and effective_at <= now() and retired_at is null);

create policy tenant_subscriptions_read_member
on public.tenant_subscriptions
for select
to authenticated
using (private.is_active_tenant_member((select auth.uid()), tenant_id));

create policy tenant_subscription_items_read_member
on public.tenant_subscription_items
for select
to authenticated
using (private.is_active_tenant_member((select auth.uid()), tenant_id));

create policy billing_checkout_orders_read_manager
on public.billing_checkout_orders
for select
to authenticated
using (
  private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin')
);

comment on table public.billing_plans is
  'Catálogo comercial versionado; contratos guardam snapshots imutáveis.';
comment on table public.tenant_subscriptions is
  'Uma assinatura lógica por escritório, independente da rotatividade da equipe.';
comment on table public.billing_checkout_orders is
  'Pedido idempotente calculado exclusivamente pelo backend antes do Asaas.';
comment on table public.billing_webhook_events is
  'Deduplicação e auditoria dos eventos recebidos do Asaas.';
