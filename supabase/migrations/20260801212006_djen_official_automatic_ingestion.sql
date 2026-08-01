-- Fonte oficial de publicações do DJEN/CNJ, consultada a cada dez minutos.
-- Mantém DataJud para processos/andamentos e Escavador como complemento.

begin;

alter table public.publicacoes
  drop constraint if exists publicacoes_provider_check;
alter table public.publicacoes
  add constraint publicacoes_provider_check
  check (provider in ('djen', 'escavador', 'manual', 'legacy'));

alter table public.legal_sync_sources
  drop constraint if exists legal_sync_sources_provider_check;
alter table public.legal_sync_sources
  add constraint legal_sync_sources_provider_check
  check (provider in ('djen', 'escavador', 'datajud'));

alter table public.legal_sync_runs
  drop constraint if exists legal_sync_runs_provider_check;
alter table public.legal_sync_runs
  add constraint legal_sync_runs_provider_check
  check (provider in ('djen', 'escavador', 'datajud'));

-- Uma OAB gera duas fontes independentes: DJEN oficial e Escavador opcional.
create or replace function private.sync_source_for_lawyer_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  source_active boolean;
  source_provider text;
  canonical_reference text;
begin
  canonical_reference := btrim(new.oab_number) || '/' || upper(btrim(new.oab_state));

  select exists (
    select 1
    from public.lawyer_registrations sibling
    where sibling.tenant_id = new.tenant_id
      and btrim(sibling.oab_number) = btrim(new.oab_number)
      and upper(btrim(sibling.oab_state)) = upper(btrim(new.oab_state))
      and sibling.status not in ('disabled', 'invalid')
  )
  into source_active;

  foreach source_provider in array array['escavador', 'djen']
  loop
    insert into public.legal_sync_sources (
      tenant_id,
      source_kind,
      provider,
      lawyer_registration_id,
      reference,
      active,
      next_sync_at
    )
    values (
      new.tenant_id,
      'oab',
      source_provider,
      new.id,
      canonical_reference,
      source_active,
      now()
    )
    on conflict (tenant_id, source_kind, provider, reference)
    do update set
      lawyer_registration_id = excluded.lawyer_registration_id,
      active = excluded.active,
      paused_reason = case
        when excluded.active then null
        else 'registration_disabled'
      end,
      next_sync_at = case
        when excluded.active and not public.legal_sync_sources.active then now()
        else public.legal_sync_sources.next_sync_at
      end;
  end loop;

  return new;
end;
$$;

-- Um processo gera uma fonte DataJud (andamentos) e uma DJEN (publicações).
create or replace function private.sync_source_for_processo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  digits text;
  formatted text;
  source_provider text;
begin
  if new.tenant_id is null then
    return new;
  end if;

  digits := regexp_replace(coalesce(new.numero, ''), '[^0-9]', '', 'g');
  if length(digits) <> 20 then
    return new;
  end if;

  formatted :=
    substring(digits from 1 for 7) || '-' ||
    substring(digits from 8 for 2) || '.' ||
    substring(digits from 10 for 4) || '.' ||
    substring(digits from 14 for 1) || '.' ||
    substring(digits from 15 for 2) || '.' ||
    substring(digits from 17 for 4);

  foreach source_provider in array array['datajud', 'djen']
  loop
    insert into public.legal_sync_sources (
      tenant_id,
      source_kind,
      provider,
      process_id,
      reference,
      active,
      next_sync_at
    )
    values (
      new.tenant_id,
      'process',
      source_provider,
      new.id,
      formatted,
      true,
      now()
    )
    on conflict (tenant_id, source_kind, provider, reference)
    do update set
      process_id = excluded.process_id,
      active = true,
      paused_reason = null,
      next_sync_at = case
        when not public.legal_sync_sources.active then now()
        else public.legal_sync_sources.next_sync_at
      end;
  end loop;

  return new;
end;
$$;

-- Fontes oficiais para cadastros já existentes. `distinct on` escolhe uma
-- referência válida quando a mesma OAB aparece em mais de um membro do tenant.
insert into public.legal_sync_sources (
  tenant_id,
  source_kind,
  provider,
  lawyer_registration_id,
  reference,
  active,
  next_sync_at
)
select distinct on (
  registration.tenant_id,
  btrim(registration.oab_number),
  upper(btrim(registration.oab_state))
)
  registration.tenant_id,
  'oab',
  'djen',
  registration.id,
  btrim(registration.oab_number) || '/' || upper(btrim(registration.oab_state)),
  registration.status not in ('disabled', 'invalid'),
  now()
from public.lawyer_registrations registration
where btrim(registration.oab_number) <> ''
  and length(btrim(registration.oab_state)) = 2
order by
  registration.tenant_id,
  btrim(registration.oab_number),
  upper(btrim(registration.oab_state)),
  (registration.status not in ('disabled', 'invalid')) desc,
  registration.updated_at desc
on conflict (tenant_id, source_kind, provider, reference)
do update set
  lawyer_registration_id = excluded.lawyer_registration_id,
  active = excluded.active,
  paused_reason = case when excluded.active then null else 'registration_disabled' end,
  next_sync_at = now();

insert into public.legal_sync_sources (
  tenant_id,
  source_kind,
  provider,
  process_id,
  reference,
  active,
  next_sync_at
)
select
  process.tenant_id,
  'process',
  'djen',
  process.id,
  substring(digits.value from 1 for 7) || '-' ||
  substring(digits.value from 8 for 2) || '.' ||
  substring(digits.value from 10 for 4) || '.' ||
  substring(digits.value from 14 for 1) || '.' ||
  substring(digits.value from 15 for 2) || '.' ||
  substring(digits.value from 17 for 4),
  true,
  now()
from public.processos process
cross join lateral (
  select regexp_replace(coalesce(process.numero, ''), '[^0-9]', '', 'g') as value
) as digits
where process.tenant_id is not null
  and length(digits.value) = 20
on conflict (tenant_id, source_kind, provider, reference)
do update set
  process_id = excluded.process_id,
  active = true,
  paused_reason = null,
  next_sync_at = now();

comment on table public.legal_sync_sources is
  'Fontes por escritório: OAB/processo no DJEN, OAB no Escavador e processo no DataJud.';

-- O mesmo job atende o DJEN a cada dez minutos e ignora fontes ainda não
-- vencidas. A função valida o segredo `x-cron-secret` antes de trabalhar.
select cron.unschedule('reconciliacao-juridica')
where exists (
  select 1 from cron.job where jobname = 'reconciliacao-juridica'
);

select cron.schedule(
  'reconciliacao-juridica',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (where name = 'cron_secret') as cron_secret
    from vault.decrypted_secrets
  ) as secrets
  where secrets.project_url is not null
    and secrets.cron_secret is not null;
  $job$
);

revoke all on function private.sync_source_for_lawyer_registration()
from public, anon, authenticated;
revoke all on function private.sync_source_for_processo()
from public, anon, authenticated;

commit;
