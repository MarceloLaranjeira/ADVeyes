begin;

-- Dados de contato publicamente fornecidos pelo provedor ficam separados do
-- payload bruto e podem ser usados pelo reconciliador sem expor documentos
-- completos. O objeto aceita apenas telefone, e-mail e endereço normalizados.
alter table public.process_parties
  add column if not exists contact_data jsonb not null default '{}'::jsonb;

alter table public.process_parties
  drop constraint if exists process_parties_contact_data_object_check,
  add constraint process_parties_contact_data_object_check
    check (jsonb_typeof(contact_data) = 'object');

grant select (contact_data) on public.process_parties to authenticated;

-- Toda OAB mantém três fontes independentes. Antes desta correção, o fallback
-- DataJud só existia na requisição síncrona; o cadastro em segundo plano criava
-- DJEN e Escavador, ficando sem descoberta quando o token pago não existia.
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
  ) into source_active;

  foreach source_provider in array array['escavador', 'datajud', 'djen']
  loop
    insert into public.legal_sync_sources (
      tenant_id,
      source_kind,
      provider,
      lawyer_registration_id,
      reference,
      active,
      failure_count,
      paused_reason,
      next_sync_at
    ) values (
      new.tenant_id,
      'oab',
      source_provider,
      new.id,
      canonical_reference,
      source_active,
      0,
      case when source_active then null else 'registration_disabled' end,
      now()
    )
    on conflict (tenant_id, source_kind, provider, reference)
    do update set
      lawyer_registration_id = excluded.lawyer_registration_id,
      active = excluded.active,
      failure_count = case
        when public.legal_sync_sources.paused_reason = 'max_retries' then 0
        else public.legal_sync_sources.failure_count
      end,
      paused_reason = case
        when excluded.active then null
        else 'registration_disabled'
      end,
      next_sync_at = case
        when excluded.active then now()
        else public.legal_sync_sources.next_sync_at
      end;
  end loop;

  return new;
end;
$$;

revoke all on function private.sync_source_for_lawyer_registration()
from public, anon, authenticated;

-- Cria o fallback oficial para todas as inscrições existentes.
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
  'datajud',
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
  failure_count = 0,
  paused_reason = case when excluded.active then null else 'registration_disabled' end,
  next_sync_at = now();

-- A política antiga desligava fontes após cinco falhas transitórias. Fontes
-- ainda válidas voltam à fila; credenciais inválidas e inscrições desativadas
-- continuam exigindo ação administrativa.
update public.legal_sync_sources source
set
  active = true,
  failure_count = 0,
  paused_reason = null,
  next_sync_at = now()
where source.paused_reason = 'max_retries'
  and (
    (
      source.source_kind = 'oab'
      and exists (
        select 1
        from public.lawyer_registrations registration
        where registration.tenant_id = source.tenant_id
          and registration.id = source.lawyer_registration_id
          and registration.status not in ('disabled', 'invalid')
      )
    )
    or (
      source.source_kind = 'process'
      and exists (
        select 1
        from public.processos process
        where process.tenant_id = source.tenant_id
          and process.id = source.process_id
      )
    )
  );

-- Execuções interrompidas pelo encerramento do worker não podem permanecer
-- indefinidamente como "running" no painel operacional.
update public.legal_sync_runs
set
  status = 'failed',
  error_code = 'worker_interrupted',
  error_message = 'A execução foi interrompida antes da conclusão e será repetida.',
  finished_at = now()
where status = 'running'
  and started_at < now() - interval '30 minutes';

comment on column public.process_parties.contact_data is
  'Telefone, e-mail e endereço entregues publicamente pela fonte; dados ausentes não são inferidos.';

commit;

;
