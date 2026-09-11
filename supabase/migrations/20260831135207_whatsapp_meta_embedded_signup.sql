-- WhatsApp Cloud API por escritório. Credenciais só podem ser manipuladas
-- pelas Edge Functions; o cliente recebe metadados seguros via grant seletivo.

create table public.whatsapp_connections (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  waba_id text not null unique,
  phone_number_id text not null unique,
  display_phone_number text,
  verified_name text,
  business_name text,
  access_token_ciphertext text,
  status text not null default 'connected'
    check (status in ('connecting', 'connected', 'reconnect_required', 'revoked', 'error')),
  billing_mode text not null default 'direct_meta'
    check (billing_mode = 'direct_meta'),
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_webhook_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clientes(id) on delete set null,
  contact_phone text not null,
  contact_name text,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_count integer not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, contact_phone)
);

create index whatsapp_connections_connected_by_idx
  on public.whatsapp_connections (connected_by)
  where connected_by is not null;

create index whatsapp_conversations_tenant_last_message_idx
  on public.whatsapp_conversations (tenant_id, last_message_at desc);
create index whatsapp_conversations_client_idx
  on public.whatsapp_conversations (client_id)
  where client_id is not null;

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  client_id uuid references public.clientes(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  body_text text,
  template_name text,
  wa_message_id text unique,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'deleted', 'received')),
  error_code text,
  occurred_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_messages_conversation_time_idx
  on public.whatsapp_messages (conversation_id, occurred_at desc);
create index whatsapp_messages_tenant_wa_id_idx
  on public.whatsapp_messages (tenant_id, wa_message_id)
  where wa_message_id is not null;
create index whatsapp_messages_client_idx
  on public.whatsapp_messages (client_id)
  where client_id is not null;

create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (tenant_id, event_key)
);

create index whatsapp_webhook_events_tenant_received_idx
  on public.whatsapp_webhook_events (tenant_id, received_at desc);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

create policy whatsapp_connections_tenant_read
on public.whatsapp_connections for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy whatsapp_conversations_tenant_read
on public.whatsapp_conversations for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy whatsapp_messages_tenant_read
on public.whatsapp_messages for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy whatsapp_webhook_events_tenant_read
on public.whatsapp_webhook_events for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

revoke all on table public.whatsapp_connections, public.whatsapp_conversations,
  public.whatsapp_messages, public.whatsapp_webhook_events from anon, authenticated;

grant select (tenant_id, waba_id, phone_number_id, display_phone_number,
  verified_name, business_name, status, billing_mode, connected_by, connected_at,
  last_webhook_at, last_error_code, last_error_at, created_at, updated_at)
on public.whatsapp_connections to authenticated;
grant select on public.whatsapp_conversations, public.whatsapp_messages
  to authenticated;
grant all on table public.whatsapp_connections, public.whatsapp_conversations,
  public.whatsapp_messages, public.whatsapp_webhook_events to service_role;

create or replace function private.touch_whatsapp_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_whatsapp_updated_at()
  from public, anon, authenticated;

create trigger whatsapp_connections_touch_updated_at
before update on public.whatsapp_connections
for each row execute function private.touch_whatsapp_updated_at();
create trigger whatsapp_conversations_touch_updated_at
before update on public.whatsapp_conversations
for each row execute function private.touch_whatsapp_updated_at();
create trigger whatsapp_messages_touch_updated_at
before update on public.whatsapp_messages
for each row execute function private.touch_whatsapp_updated_at();

comment on table public.whatsapp_connections is
  'Conexão WhatsApp Cloud API por escritório; token fica cifrado e inacessível pela Data API.';
comment on table public.whatsapp_webhook_events is
  'Registro idempotente de eventos recebidos da Meta, sem segredos.';
