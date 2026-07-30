alter table public.processos
  add constraint processos_tenant_id_id_key unique (tenant_id, id);

create table public.lawyer_registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null,
  oab_number text not null check (oab_number ~ '^[0-9]+$'),
  oab_state text not null check (oab_state ~ '^[A-Z]{2}$'),
  oab_type text not null default 'ADVOGADO' check (
    oab_type in (
      'ADVOGADO',
      'SUPLEMENTAR',
      'ESTAGIARIO',
      'CONSULTOR_ESTRANGEIRO'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'verified', 'invalid', 'disabled')
  ),
  verified_name text,
  verified_at timestamptz,
  last_discovery_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, oab_state, oab_number, oab_type),
  foreign key (tenant_id, professional_id)
    references public.equipe(tenant_id, id)
    on delete cascade
);

create table public.process_discoveries (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lawyer_registration_id uuid not null,
  numero_cnj text not null check (
    numero_cnj ~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
  ),
  provider text not null check (provider in ('escavador', 'datajud')),
  state text not null default 'candidate' check (
    state in ('candidate', 'confirmed', 'ignored', 'conflict')
  ),
  title_active_party text,
  title_passive_party text,
  tribunal text,
  court_unit text,
  process_status text,
  last_movement_at timestamptz,
  provider_fetched_at timestamptz not null default now(),
  provider_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provider_payload) = 'object'
  ),
  confirmed_process_id uuid,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, lawyer_registration_id, numero_cnj, provider),
  foreign key (tenant_id, lawyer_registration_id)
    references public.lawyer_registrations(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, confirmed_process_id)
    references public.processos(tenant_id, id)
    on delete set null (confirmed_process_id),
  constraint process_discoveries_confirmation_valid check (
    (state <> 'confirmed')
    or (
      confirmed_process_id is not null
      and confirmed_by is not null
      and confirmed_at is not null
    )
  )
);

create table public.process_lawyers (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  lawyer_registration_id uuid not null,
  source text not null default 'discovery' check (
    source in ('discovery', 'manual', 'import')
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, process_id, lawyer_registration_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, lawyer_registration_id)
    references public.lawyer_registrations(tenant_id, id)
    on delete cascade
);

create table public.legal_provider_monitors (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  provider text not null check (provider in ('escavador')),
  external_id text,
  frequency text not null default 'DIARIA' check (
    frequency in ('DIARIA', 'SEMANAL')
  ),
  include_public_documents boolean not null default true,
  status text not null default 'queued' check (
    status in (
      'queued',
      'pending',
      'found',
      'not_found',
      'paused',
      'failed',
      'removed'
    )
  ),
  last_checked_at timestamptz,
  last_callback_at timestamptz,
  last_error_code text,
  last_error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, process_id, provider),
  unique (provider, external_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete cascade
);

create table public.process_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  provider text not null check (provider in ('escavador', 'datajud', 'manual')),
  external_id text not null,
  movement_type text not null default 'ANDAMENTO' check (
    movement_type in ('ANDAMENTO', 'PUBLICACAO', 'DOCUMENTO')
  ),
  occurred_at timestamptz,
  title text,
  content text not null,
  source_name text,
  source_url text,
  provider_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provider_payload) = 'object'
  ),
  created_at timestamptz not null default now(),
  unique (tenant_id, process_id, provider, external_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete cascade
);

create table public.legal_provider_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete restrict,
  monitor_id uuid,
  provider text not null check (provider in ('escavador', 'datajud')),
  external_event_id text not null,
  event_type text not null,
  status text not null default 'received' check (
    status in ('received', 'processed', 'quarantined', 'failed')
  ),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id),
  foreign key (tenant_id, monitor_id)
    references public.legal_provider_monitors(tenant_id, id)
    on delete set null (monitor_id),
  constraint legal_provider_events_monitor_tenant_valid check (
    monitor_id is null or tenant_id is not null
  )
);

create table public.legal_usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('escavador', 'datajud')),
  operation text not null check (
    operation in (
      'oab_discovery',
      'process_lookup',
      'monitor_created',
      'monitor_check',
      'public_document'
    )
  ),
  quantity integer not null default 1 check (quantity > 0),
  external_reference text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  occurred_at timestamptz not null default now()
);

create index lawyer_registrations_tenant_professional_idx
  on public.lawyer_registrations (tenant_id, professional_id);
create index process_discoveries_tenant_state_idx
  on public.process_discoveries (tenant_id, state, provider_fetched_at desc);
create index process_discoveries_numero_idx
  on public.process_discoveries (tenant_id, numero_cnj);
create index process_lawyers_registration_idx
  on public.process_lawyers (tenant_id, lawyer_registration_id);
create index legal_provider_monitors_status_idx
  on public.legal_provider_monitors (tenant_id, status, updated_at desc);
create index process_movements_process_time_idx
  on public.process_movements (tenant_id, process_id, occurred_at desc);
create index legal_provider_events_status_idx
  on public.legal_provider_events (status, received_at);
create index legal_usage_events_tenant_time_idx
  on public.legal_usage_events (tenant_id, occurred_at desc);

create trigger lawyer_registrations_touch_updated_at
before update on public.lawyer_registrations
for each row execute function private.touch_tenant_updated_at();

create trigger process_discoveries_touch_updated_at
before update on public.process_discoveries
for each row execute function private.touch_tenant_updated_at();

create trigger legal_provider_monitors_touch_updated_at
before update on public.legal_provider_monitors
for each row execute function private.touch_tenant_updated_at();

alter table public.lawyer_registrations enable row level security;
alter table public.process_discoveries enable row level security;
alter table public.process_lawyers enable row level security;
alter table public.legal_provider_monitors enable row level security;
alter table public.process_movements enable row level security;
alter table public.legal_provider_events enable row level security;
alter table public.legal_usage_events enable row level security;

create policy lawyer_registrations_tenant_read
on public.lawyer_registrations
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy process_discoveries_tenant_read
on public.process_discoveries
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy process_lawyers_tenant_read
on public.process_lawyers
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy legal_provider_monitors_tenant_read
on public.legal_provider_monitors
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy process_movements_tenant_read
on public.process_movements
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy legal_usage_events_tenant_read
on public.legal_usage_events
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'subscription', 'read')
);

revoke all privileges
on table
  public.lawyer_registrations,
  public.process_discoveries,
  public.process_lawyers,
  public.legal_provider_monitors,
  public.process_movements,
  public.legal_provider_events,
  public.legal_usage_events
from anon, authenticated;

grant select
on table
  public.lawyer_registrations,
  public.process_discoveries,
  public.process_lawyers,
  public.legal_provider_monitors,
  public.process_movements,
  public.legal_usage_events
to authenticated;

grant all privileges
on table
  public.lawyer_registrations,
  public.process_discoveries,
  public.process_lawyers,
  public.legal_provider_monitors,
  public.process_movements,
  public.legal_provider_events,
  public.legal_usage_events
to service_role;

comment on table public.process_discoveries is
  'Processos candidatos descobertos por OAB; não ativam monitoramento.';
comment on table public.legal_provider_events is
  'Eventos externos brutos, idempotentes e não expostos ao navegador.';
comment on table public.legal_usage_events is
  'Medição de consumo jurídico por tenant e provedor.';
