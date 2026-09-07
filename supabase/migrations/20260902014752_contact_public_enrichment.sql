begin;

create table public.contact_enrichment_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null,
  cnpj text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'retry', 'completed', 'not_found', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  provider text check (provider in ('brasilapi', 'opencnpj', 'serpro')),
  result_fields jsonb not null default '[]'::jsonb check (
    jsonb_typeof(result_fields) = 'array'
  ),
  last_error_code text,
  last_checked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, contact_id, cnpj),
  foreign key (tenant_id, contact_id)
    references public.clientes(tenant_id, id) on delete cascade
);

create index contact_enrichment_jobs_due_idx
  on public.contact_enrichment_jobs (next_attempt_at, created_at)
  where status in ('pending', 'retry', 'processing');

create trigger contact_enrichment_jobs_touch_updated_at
before update on public.contact_enrichment_jobs
for each row execute function private.touch_tenant_updated_at();

alter table public.contact_enrichment_jobs enable row level security;
revoke all on public.contact_enrichment_jobs from public, anon, authenticated;
grant all on public.contact_enrichment_jobs to service_role;

create or replace function public.enqueue_contact_enrichment(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_cnpj text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_cnpj text := upper(regexp_replace(coalesce(p_cnpj, ''), '[^0-9A-Za-z]', '', 'g'));
  queued_id uuid;
begin
  if normalized_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' then
    raise exception using message = 'invalid_cnpj';
  end if;

  if not exists (
    select 1
    from public.clientes contact
    where contact.tenant_id = p_tenant_id
      and contact.id = p_contact_id
  ) then
    raise exception using message = 'contact_not_found';
  end if;

  insert into public.contact_enrichment_jobs (
    tenant_id, contact_id, cnpj, status, next_attempt_at
  ) values (
    p_tenant_id, p_contact_id, normalized_cnpj, 'pending', now()
  )
  on conflict (tenant_id, contact_id, cnpj) do update
  set status = case
        when public.contact_enrichment_jobs.status in ('failed', 'not_found')
          and coalesce(public.contact_enrichment_jobs.last_checked_at, '-infinity'::timestamptz)
            < now() - interval '30 days'
          then 'pending'
        else public.contact_enrichment_jobs.status
      end,
      next_attempt_at = case
        when public.contact_enrichment_jobs.status in ('failed', 'not_found')
          and coalesce(public.contact_enrichment_jobs.last_checked_at, '-infinity'::timestamptz)
            < now() - interval '30 days'
          then now()
        else public.contact_enrichment_jobs.next_attempt_at
      end,
      last_error_code = case
        when public.contact_enrichment_jobs.status in ('failed', 'not_found')
          and coalesce(public.contact_enrichment_jobs.last_checked_at, '-infinity'::timestamptz)
            < now() - interval '30 days'
          then null
        else public.contact_enrichment_jobs.last_error_code
      end
  returning id into queued_id;

  return queued_id;
end;
$$;

revoke all on function public.enqueue_contact_enrichment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.enqueue_contact_enrichment(uuid, uuid, text)
  to service_role;

create or replace function public.claim_contact_enrichment_jobs(
  p_worker_id text,
  p_limit integer default 10
)
returns table (
  id uuid,
  tenant_id uuid,
  contact_id uuid,
  cnpj text,
  attempts integer
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select job.id
    from public.contact_enrichment_jobs job
    where (
        job.status in ('pending', 'retry')
        and job.next_attempt_at <= now()
      ) or (
        job.status = 'processing'
        and job.lease_expires_at < now()
      )
    order by job.next_attempt_at, job.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 25)
  ), claimed as (
    update public.contact_enrichment_jobs job
    set status = 'processing',
        attempts = job.attempts + 1,
        lease_owner = p_worker_id,
        lease_expires_at = now() + interval '5 minutes',
        started_at = coalesce(job.started_at, now()),
        last_error_code = case
          when job.status = 'processing' then 'worker_interrupted'
          else job.last_error_code
        end
    from due
    where job.id = due.id
    returning job.id, job.tenant_id, job.contact_id, job.cnpj, job.attempts
  )
  select * from claimed
$$;

revoke all on function public.claim_contact_enrichment_jobs(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_contact_enrichment_jobs(text, integer)
  to service_role;

create or replace function public.apply_contact_enrichment_result(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_status text,
  p_provider text,
  p_cnpj_masked text,
  p_checked_at timestamptz,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_corporate_name text default null,
  p_trade_name text default null,
  p_error_code text default null
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact public.clientes%rowtype;
  filled_fields text[] := array[]::text[];
  enrichment_metadata jsonb;
begin
  if p_status not in ('completed', 'not_found', 'retry', 'failed') then
    raise exception using message = 'invalid_enrichment_status';
  end if;
  if p_provider is not null and p_provider not in ('brasilapi', 'opencnpj', 'serpro') then
    raise exception using message = 'invalid_enrichment_provider';
  end if;

  select * into contact
  from public.clientes
  where tenant_id = p_tenant_id and id = p_contact_id
  for update;
  if not found then
    raise exception using message = 'contact_not_found';
  end if;

  if p_status = 'completed' then
    if nullif(btrim(contact.telefone), '') is null and nullif(btrim(p_phone), '') is not null then
      filled_fields := array_append(filled_fields, 'telefone');
    end if;
    if nullif(btrim(contact.email), '') is null and nullif(btrim(p_email), '') is not null then
      filled_fields := array_append(filled_fields, 'email');
    end if;
    if nullif(btrim(contact.endereco), '') is null and nullif(btrim(p_address), '') is not null then
      filled_fields := array_append(filled_fields, 'endereco');
    end if;
  end if;

  enrichment_metadata := jsonb_strip_nulls(jsonb_build_object(
    'status', p_status,
    'provider', p_provider,
    'checked_at', p_checked_at,
    'cnpj_masked', p_cnpj_masked,
    'fields', to_jsonb(filled_fields),
    'corporate_name', p_corporate_name,
    'trade_name', p_trade_name,
    'error_code', p_error_code
  ));

  update public.clientes
  set telefone = case
        when p_status = 'completed' and nullif(btrim(telefone), '') is null
          then coalesce(nullif(btrim(p_phone), ''), telefone)
        else telefone
      end,
      email = case
        when p_status = 'completed' and nullif(btrim(email), '') is null
          then coalesce(nullif(btrim(p_email), ''), email)
        else email
      end,
      endereco = case
        when p_status = 'completed' and nullif(btrim(endereco), '') is null
          then coalesce(nullif(btrim(p_address), ''), endereco)
        else endereco
      end,
      source_metadata = coalesce(source_metadata, '{}'::jsonb) ||
        jsonb_build_object('contact_enrichment', enrichment_metadata)
  where tenant_id = p_tenant_id and id = p_contact_id;

  return filled_fields;
end;
$$;

revoke all on function public.apply_contact_enrichment_result(
  uuid, uuid, text, text, text, timestamptz,
  text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.apply_contact_enrichment_result(
  uuid, uuid, text, text, text, timestamptz,
  text, text, text, text, text, text
) to service_role;

create or replace function private.queue_contact_cnpj_enrichment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_cnpj text := upper(regexp_replace(coalesce(new.cpf, ''), '[^0-9A-Za-z]', '', 'g'));
begin
  if normalized_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' then
    perform public.enqueue_contact_enrichment(new.tenant_id, new.id, normalized_cnpj);
  end if;
  return new;
end;
$$;

create trigger clientes_queue_public_cnpj_enrichment
after insert or update of cpf on public.clientes
for each row
when (new.tenant_id is not null and new.cpf is not null)
execute function private.queue_contact_cnpj_enrichment();

-- Backfill seguro: somente valores completos e sem máscara são candidatos.
insert into public.contact_enrichment_jobs (tenant_id, contact_id, cnpj)
select contact.tenant_id, contact.id,
       upper(regexp_replace(contact.cpf, '[^0-9A-Za-z]', '', 'g'))
from public.clientes contact
where contact.tenant_id is not null
  and upper(regexp_replace(coalesce(contact.cpf, ''), '[^0-9A-Za-z]', '', 'g'))
    ~ '^[0-9A-Z]{12}[0-9]{2}$'
on conflict (tenant_id, contact_id, cnpj) do nothing;

insert into public.contact_enrichment_jobs (tenant_id, contact_id, cnpj)
select distinct party.tenant_id, party.contact_id,
       upper(regexp_replace(party.document_masked, '[^0-9A-Za-z]', '', 'g'))
from public.process_parties party
where party.contact_id is not null
  and party.document_masked is not null
  and party.document_masked !~ '\*'
  and upper(regexp_replace(party.document_masked, '[^0-9A-Za-z]', '', 'g'))
    ~ '^[0-9A-Z]{12}[0-9]{2}$'
on conflict (tenant_id, contact_id, cnpj) do nothing;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'contact-enrichment-worker-every-5-minutes';

select cron.schedule(
  'contact-enrichment-worker-every-5-minutes',
  '2-59/5 * * * *',
  $schedule$
  with secrets as (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as cron_secret
  )
  select net.http_post(
    url := secrets.project_url || '/functions/v1/contact-enrichment-worker',
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

comment on table public.contact_enrichment_jobs is
  'Fila interna de enriquecimento empresarial por CNPJ público; não exposta ao navegador.';

commit;
