begin;

alter table public.clientes
  add column if not exists deleted_at timestamptz;
alter table public.processos
  add column if not exists deleted_at timestamptz;
alter table public.tarefas
  add column if not exists deleted_at timestamptz;

create index if not exists clientes_tenant_active_idx
  on public.clientes (tenant_id, created_at desc, id)
  where deleted_at is null;
create index if not exists processos_tenant_active_idx
  on public.processos (tenant_id, created_at desc, id)
  where deleted_at is null;
create index if not exists tarefas_tenant_active_idx
  on public.tarefas (tenant_id, created_at desc, id)
  where deleted_at is null;

create table public.api_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  token_prefix text not null check (token_prefix ~ '^adv_(live|test)_[A-Za-z0-9_-]{8,24}$'),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) between 1 and 7
    and scopes <@ array[
      'contacts:read', 'contacts:write',
      'processes:read', 'processes:write',
      'tasks:read', 'tasks:write',
      'webhooks:manage'
    ]::text[]
  ),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  unique (tenant_id, token_prefix)
);

create table public.api_idempotency_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  api_token_id uuid not null references public.api_tokens(id) on delete cascade,
  method text not null check (method in ('POST', 'PATCH', 'DELETE')),
  route text not null check (route like '/api/v1/%'),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_status integer not null check (
    response_status = 102 or response_status between 200 and 599
  ),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (api_token_id, method, route, idempotency_key)
);

create table public.api_request_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  api_token_id uuid references public.api_tokens(id) on delete set null,
  request_id uuid not null,
  method text not null,
  route text not null,
  status integer not null check (status between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.domain_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type ~ '^(contact|process|task)\.(created|updated|completed|deleted)$'),
  aggregate_type text not null check (aggregate_type in ('contact', 'process', 'task')),
  aggregate_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  url text not null check (url ~ '^https://'),
  event_types text[] not null check (
    cardinality(event_types) between 1 and 10
    and event_types <@ array[
      '*',
      'contact.created', 'contact.updated', 'contact.deleted',
      'process.created', 'process.updated', 'process.deleted',
      'task.created', 'task.updated', 'task.completed', 'task.deleted'
    ]::text[]
  ),
  secret_ciphertext text not null,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, url)
);

create table public.webhook_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_id uuid not null references public.domain_events(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'delivering', 'delivered', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_status_code integer,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, endpoint_id)
);

create index api_tokens_tenant_active_idx
  on public.api_tokens (tenant_id, created_at desc)
  where revoked_at is null;
create index api_idempotency_expiry_idx
  on public.api_idempotency_keys (expires_at);
create index api_request_logs_rate_idx
  on public.api_request_logs (api_token_id, created_at desc);
create index domain_events_tenant_time_idx
  on public.domain_events (tenant_id, occurred_at desc);
create index webhook_endpoints_tenant_active_idx
  on public.webhook_endpoints (tenant_id, active);
create index webhook_deliveries_due_idx
  on public.webhook_deliveries (next_attempt_at, created_at)
  where status = 'pending';

alter table public.api_tokens enable row level security;
alter table public.api_idempotency_keys enable row level security;
alter table public.api_request_logs enable row level security;
alter table public.domain_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

revoke all on table
  public.api_tokens,
  public.api_idempotency_keys,
  public.api_request_logs,
  public.domain_events,
  public.webhook_endpoints,
  public.webhook_deliveries
from anon, authenticated;

grant all on table
  public.api_tokens,
  public.api_idempotency_keys,
  public.api_request_logs,
  public.domain_events,
  public.webhook_endpoints,
  public.webhook_deliveries
to service_role;
grant usage, select on sequence public.api_request_logs_id_seq to service_role;

create or replace function private.emit_public_api_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  tenant_value uuid := (row_data ->> 'tenant_id')::uuid;
  aggregate_value uuid := (row_data ->> 'id')::uuid;
  aggregate_name text;
  event_name text;
  event_payload jsonb;
  event_value uuid;
begin
  if tenant_value is null or aggregate_value is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  aggregate_name := case tg_table_name
    when 'clientes' then 'contact'
    when 'processos' then 'process'
    when 'tarefas' then 'task'
  end;

  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and old_row ->> 'deleted_at' is null
         and new_row ->> 'deleted_at' is not null) then
    event_name := aggregate_name || '.deleted';
  elsif tg_op = 'INSERT' then
    event_name := aggregate_name || '.created';
  elsif tg_table_name = 'tarefas'
        and old_row ->> 'status' is distinct from 'concluída'
        and new_row ->> 'status' = 'concluída' then
    event_name := 'task.completed';
  else
    event_name := aggregate_name || '.updated';
  end if;

  event_payload := case tg_table_name
    when 'clientes' then jsonb_build_object(
      'id', row_data -> 'id',
      'name', row_data -> 'nome',
      'document', row_data -> 'cpf',
      'email', row_data -> 'email',
      'phone', row_data -> 'telefone',
      'person_type', row_data -> 'person_type',
      'relationship_type', row_data -> 'relationship_type',
      'updated_at', row_data -> 'updated_at',
      'deleted_at', row_data -> 'deleted_at'
    )
    when 'processos' then jsonb_build_object(
      'id', row_data -> 'id',
      'number', row_data -> 'numero',
      'contact_id', row_data -> 'cliente_id',
      'client_name', row_data -> 'cliente_nome',
      'status', row_data -> 'status',
      'court', row_data -> 'tribunal',
      'updated_at', row_data -> 'updated_at',
      'deleted_at', row_data -> 'deleted_at'
    )
    when 'tarefas' then jsonb_build_object(
      'id', row_data -> 'id',
      'title', row_data -> 'titulo',
      'status', row_data -> 'status',
      'priority', row_data -> 'prioridade',
      'due_at', row_data -> 'data_limite',
      'process_id', row_data -> 'processo_id',
      'assignee_id', row_data -> 'responsavel_id',
      'completed_at', row_data -> 'concluida_em',
      'updated_at', row_data -> 'updated_at',
      'deleted_at', row_data -> 'deleted_at'
    )
  end;

  insert into public.domain_events (
    tenant_id, type, aggregate_type, aggregate_id, payload
  ) values (
    tenant_value, event_name, aggregate_name, aggregate_value, event_payload
  ) returning id into event_value;

  insert into public.webhook_deliveries (
    tenant_id, event_id, endpoint_id
  )
  select tenant_value, event_value, endpoint.id
  from public.webhook_endpoints endpoint
  where endpoint.tenant_id = tenant_value
    and endpoint.active
    and (event_name = any(endpoint.event_types) or '*' = any(endpoint.event_types));

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.emit_public_api_event() from public;

drop trigger if exists clientes_public_api_events on public.clientes;
create trigger clientes_public_api_events
after insert or update or delete on public.clientes
for each row execute function private.emit_public_api_event();

drop trigger if exists processos_public_api_events on public.processos;
create trigger processos_public_api_events
after insert or update or delete on public.processos
for each row execute function private.emit_public_api_event();

drop trigger if exists tarefas_public_api_events on public.tarefas;
create trigger tarefas_public_api_events
after insert or update or delete on public.tarefas
for each row execute function private.emit_public_api_event();

comment on table public.api_tokens is
  'Credenciais server-to-server da API pública. O segredo nunca é persistido.';
comment on table public.webhook_deliveries is
  'Outbox persistente para webhooks assinados e repetíveis.';
comment on function private.emit_public_api_event() is
  'Produz eventos públicos minimizados para contatos, processos e tarefas.';

commit;
