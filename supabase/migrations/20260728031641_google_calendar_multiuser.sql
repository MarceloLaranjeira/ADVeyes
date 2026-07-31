-- Google Calendar multiusuário, unidirecional ADVeyes -> Google.
-- Tokens são criptografados pelas Edge Functions antes de chegar ao banco.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  google_subject text,
  calendar_id text not null default 'primary',
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_connections_status_check
    check (status in ('connected', 'reconnect_required', 'disconnecting', 'error')),
  constraint google_calendar_connections_calendar_id_check
    check (calendar_id = 'primary')
);

create table public.google_calendar_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  access_token_ciphertext text,
  access_token_iv text,
  access_token_expires_at timestamptz,
  encryption_version integer not null default 1,
  scope text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_credentials_encryption_version_check
    check (encryption_version > 0)
);

create table public.google_calendar_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_url text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index google_calendar_oauth_states_user_id_idx
  on public.google_calendar_oauth_states (user_id);
create index google_calendar_oauth_states_expiry_idx
  on public.google_calendar_oauth_states (expires_at)
  where consumed_at is null;

create table public.google_calendar_event_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  google_event_id text not null,
  last_payload_hash text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id),
  constraint google_calendar_event_links_entity_type_check
    check (entity_type in ('evento', 'audiencia', 'tarefa', 'financeiro'))
);

create index google_calendar_event_links_google_event_id_idx
  on public.google_calendar_event_links (google_event_id);

create table public.google_calendar_sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_sync_queue_entity_key
    unique (user_id, entity_type, entity_id),
  constraint google_calendar_sync_queue_entity_type_check
    check (entity_type in ('evento', 'audiencia', 'tarefa', 'financeiro')),
  constraint google_calendar_sync_queue_operation_check
    check (operation in ('upsert', 'delete')),
  constraint google_calendar_sync_queue_status_check
    check (status in ('pending', 'processing', 'retry', 'completed', 'failed')),
  constraint google_calendar_sync_queue_attempts_check
    check (attempts >= 0)
);

create index google_calendar_sync_queue_due_idx
  on public.google_calendar_sync_queue (next_attempt_at, created_at)
  where status in ('pending', 'retry');
create index google_calendar_sync_queue_user_status_idx
  on public.google_calendar_sync_queue (user_id, status);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_event_links enable row level security;
alter table public.google_calendar_sync_queue enable row level security;
alter table public.google_calendar_credentials enable row level security;
alter table public.google_calendar_oauth_states enable row level security;

create policy google_calendar_connections_select_own
  on public.google_calendar_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy google_calendar_event_links_select_own
  on public.google_calendar_event_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy google_calendar_sync_queue_select_own
  on public.google_calendar_sync_queue
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.google_calendar_connections from anon, authenticated;
revoke all on table public.google_calendar_event_links from anon, authenticated;
revoke all on table public.google_calendar_sync_queue from anon, authenticated;
grant select on table public.google_calendar_connections to authenticated;
grant select on table public.google_calendar_event_links to authenticated;
grant select on table public.google_calendar_sync_queue to authenticated;

revoke all on table public.google_calendar_credentials from public, anon, authenticated;
revoke all on table public.google_calendar_oauth_states from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on table public.google_calendar_credentials to service_role;
grant all on table public.google_calendar_oauth_states to service_role;
grant all on table public.google_calendar_connections to service_role;
grant all on table public.google_calendar_event_links to service_role;
grant all on table public.google_calendar_sync_queue to service_role;

create or replace function private.touch_google_calendar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_google_calendar_updated_at()
  from public, anon, authenticated;

create trigger google_calendar_connections_touch_updated_at
before update on public.google_calendar_connections
for each row execute function private.touch_google_calendar_updated_at();

create trigger google_calendar_credentials_touch_updated_at
before update on public.google_calendar_credentials
for each row execute function private.touch_google_calendar_updated_at();

create trigger google_calendar_event_links_touch_updated_at
before update on public.google_calendar_event_links
for each row execute function private.touch_google_calendar_updated_at();

create trigger google_calendar_sync_queue_touch_updated_at
before update on public.google_calendar_sync_queue
for each row execute function private.touch_google_calendar_updated_at();

create or replace function private.enqueue_google_calendar_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row jsonb;
  source_user_id uuid;
  source_entity_id uuid;
  entity_kind text;
  desired_operation text;
  syncable boolean := true;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'google_event_id') =
         (to_jsonb(old) - 'google_event_id') then
    return new;
  end if;

  source_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  source_user_id := (source_row ->> 'user_id')::uuid;
  source_entity_id := (source_row ->> 'id')::uuid;

  entity_kind := case tg_table_name
    when 'eventos' then 'evento'
    when 'audiencias' then 'audiencia'
    when 'tarefas' then 'tarefa'
    when 'financeiro' then 'financeiro'
    else null
  end;

  if entity_kind is null then
    raise exception 'Unsupported Google Calendar source table: %', tg_table_name;
  end if;

  if tg_op <> 'DELETE' then
    syncable := case tg_table_name
      when 'tarefas' then nullif(source_row ->> 'data_limite', '') is not null
      when 'financeiro' then nullif(source_row ->> 'data_vencimento', '') is not null
      else true
    end;
  end if;

  desired_operation := case
    when tg_op = 'DELETE' or not syncable then 'delete'
    else 'upsert'
  end;

  insert into public.google_calendar_sync_queue (
    user_id,
    entity_type,
    entity_id,
    operation,
    snapshot,
    status,
    attempts,
    next_attempt_at,
    locked_at,
    last_error_code
  )
  values (
    source_user_id,
    entity_kind,
    source_entity_id,
    desired_operation,
    case when desired_operation = 'delete' then source_row else '{}'::jsonb end,
    'pending',
    0,
    now(),
    null,
    null
  )
  on conflict (user_id, entity_type, entity_id)
  do update set
    operation = excluded.operation,
    snapshot = excluded.snapshot,
    status = 'pending',
    attempts = 0,
    next_attempt_at = now(),
    locked_at = null,
    last_error_code = null,
    updated_at = now();

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.enqueue_google_calendar_change()
  from public, anon, authenticated, service_role;

create trigger eventos_google_calendar_outbox
after insert or update or delete on public.eventos
for each row execute function private.enqueue_google_calendar_change();

create trigger audiencias_google_calendar_outbox
after insert or update or delete on public.audiencias
for each row execute function private.enqueue_google_calendar_change();

create trigger tarefas_google_calendar_outbox
after insert or update or delete on public.tarefas
for each row execute function private.enqueue_google_calendar_change();

create trigger financeiro_google_calendar_outbox
after insert or update or delete on public.financeiro
for each row execute function private.enqueue_google_calendar_change();

create or replace function public.claim_google_calendar_sync_jobs(
  claim_limit integer default 25,
  claim_user_id uuid default null
)
returns setof public.google_calendar_sync_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select queue.id
    from public.google_calendar_sync_queue as queue
    where (
      queue.status in ('pending', 'retry')
      and queue.next_attempt_at <= now()
      and (claim_user_id is null or queue.user_id = claim_user_id)
    ) or (
      queue.status = 'processing'
      and queue.locked_at < now() - interval '10 minutes'
      and (claim_user_id is null or queue.user_id = claim_user_id)
    )
    order by queue.next_attempt_at, queue.created_at
    limit greatest(1, least(claim_limit, 100))
    for update skip locked
  )
  update public.google_calendar_sync_queue as queue
  set status = 'processing',
      locked_at = now(),
      attempts = queue.attempts + 1,
      updated_at = now()
  from due
  where queue.id = due.id
  returning queue.*;
end;
$$;

revoke execute on function public.claim_google_calendar_sync_jobs(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_google_calendar_sync_jobs(integer, uuid)
  to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('google-calendar-worker')
where exists (
  select 1 from cron.job where jobname = 'google-calendar-worker'
);

select cron.schedule(
  'google-calendar-worker',
  '* * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/google-calendar-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', secrets.worker_secret
    ),
    body := '{"limit":25}'::jsonb,
    timeout_milliseconds := 50000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (
        where name = 'google_calendar_worker_secret'
      ) as worker_secret
    from vault.decrypted_secrets
  ) as secrets
  where secrets.project_url is not null
    and secrets.worker_secret is not null;
  $job$
);
