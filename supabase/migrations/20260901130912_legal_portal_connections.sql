begin;

create table public.legal_portal_connections (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('projudi_tjam')),
  court_code text not null check (court_code = upper(court_code)),
  vault_secret_id uuid,
  login_identifier_masked text,
  status text not null default 'pending' check (
    status in (
      'pending', 'validating', 'active', 'action_required',
      'invalid', 'paused', 'revoked'
    )
  ),
  capabilities jsonb not null default '{}'::jsonb check (
    jsonb_typeof(capabilities) = 'object'
  ),
  last_validated_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  last_result jsonb not null default '{}'::jsonb check (
    jsonb_typeof(last_result) = 'object'
  ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider, court_code),
  unique (tenant_id, id)
);

create table public.legal_portal_sync_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  scope text not null default 'future' check (
    scope in ('future', 'history', 'process')
  ),
  process_number text,
  state text not null default 'pending' check (
    state in ('pending', 'leased', 'running', 'retry', 'completed', 'failed', 'cancelled')
  ),
  cursor jsonb not null default '{}'::jsonb check (jsonb_typeof(cursor) = 'object'),
  priority smallint not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text not null,
  received_count integer not null default 0 check (received_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  ignored_count integer not null default 0 check (ignored_count >= 0),
  last_error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, connection_id)
    references public.legal_portal_connections(tenant_id, id) on delete cascade
);

create index legal_portal_connections_status_idx
  on public.legal_portal_connections (status, last_success_at);
create index legal_portal_sync_jobs_queue_idx
  on public.legal_portal_sync_jobs
    (state, next_attempt_at, priority desc, created_at)
  where state in ('pending', 'retry', 'leased', 'running');

create trigger legal_portal_connections_touch_updated_at
before update on public.legal_portal_connections
for each row execute function private.touch_tenant_updated_at();

create trigger legal_portal_sync_jobs_touch_updated_at
before update on public.legal_portal_sync_jobs
for each row execute function private.touch_tenant_updated_at();

alter table public.legal_portal_connections enable row level security;
alter table public.legal_portal_sync_jobs enable row level security;
revoke all on public.legal_portal_connections from public, anon, authenticated;
revoke all on public.legal_portal_sync_jobs from public, anon, authenticated;
grant all on public.legal_portal_connections to service_role;
grant all on public.legal_portal_sync_jobs to service_role;

-- O navegador nunca consulta o Vault. Estas funções são endpoints internos
-- exclusivos do service_role usado pelas Edge Functions.
create or replace function public.legal_portal_store_secret(
  p_connection_id uuid,
  p_secret text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_name text := 'legal_portal:' || p_connection_id::text;
  secret_id uuid;
begin
  if length(p_secret) < 8 or length(p_secret) > 8192 then
    raise exception using message = 'invalid_secret_value';
  end if;

  select secret.id into secret_id
  from vault.secrets secret
  where secret.name = secret_name
  limit 1;

  if secret_id is null then
    secret_id := vault.create_secret(
      p_secret,
      secret_name,
      'Credencial de portal jurídico do ADVeyes'
    );
  else
    perform vault.update_secret(
      secret_id,
      p_secret,
      secret_name,
      'Credencial de portal jurídico do ADVeyes'
    );
  end if;

  return secret_id;
end;
$$;

create or replace function public.legal_portal_read_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select secret.decrypted_secret
  from vault.decrypted_secrets secret
  where secret.id = p_secret_id
  limit 1
$$;

create or replace function public.legal_portal_delete_secret(p_secret_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = p_secret_id;
end;
$$;

revoke all on function public.legal_portal_store_secret(uuid, text)
  from public, anon, authenticated;
revoke all on function public.legal_portal_read_secret(uuid)
  from public, anon, authenticated;
revoke all on function public.legal_portal_delete_secret(uuid)
  from public, anon, authenticated;
grant execute on function public.legal_portal_store_secret(uuid, text)
  to service_role;
grant execute on function public.legal_portal_read_secret(uuid)
  to service_role;
grant execute on function public.legal_portal_delete_secret(uuid)
  to service_role;

alter table public.audiencias
  drop constraint if exists audiencias_source_provider_check,
  add constraint audiencias_source_provider_check check (
    source_provider in (
      'djen', 'datajud', 'escavador', 'manual', 'legacy', 'projudi_tjam'
    )
  );

alter table public.audiencias
  drop constraint if exists audiencias_provider_external_unique;
drop index if exists public.audiencias_provider_external_unique;
alter table public.audiencias
  add constraint audiencias_provider_external_unique
    unique (tenant_id, source_provider, external_id);

-- O mesmo segredo já usado pelos demais workers internos protege esta chamada.
select cron.unschedule(jobid)
from cron.job
where jobname = 'legal-portal-worker-every-30-minutes';

select cron.schedule(
  'legal-portal-worker-every-30-minutes',
  '7,37 * * * *',
  $schedule$
  with secrets as (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as cron_secret
  )
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-portal-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{"scope":"due"}'::jsonb
  )
  from secrets
  where secrets.project_url is not null
    and secrets.cron_secret is not null;
  $schedule$
);

commit;
