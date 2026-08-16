begin;

-- Reprocessa somente processos sem partes cuja descoberta já contém os
-- títulos dos polos ou a capa detalhada. A Edge Function publicada nesta
-- versão materializa esses dados sem realizar outra consulta paga.
update public.legal_sync_sources as source
set
  active = true,
  next_sync_at = least(source.next_sync_at, now() - interval '1 minute'),
  updated_at = now()
where source.source_kind = 'process'
  and source.process_id is not null
  and not exists (
    select 1
    from public.process_parties as party
    where party.tenant_id = source.tenant_id
      and party.process_id = source.process_id
  )
  and exists (
    select 1
    from public.process_discoveries as discovery
    join public.processos as process
      on process.tenant_id = source.tenant_id
     and process.id = source.process_id
     and discovery.tenant_id = process.tenant_id
     and regexp_replace(discovery.numero_cnj, '\D', '', 'g') =
         regexp_replace(process.numero, '\D', '', 'g')
    where discovery.title_active_party is not null
       or discovery.title_passive_party is not null
       or discovery.provider_payload ? 'fontes'
  );

-- Usa o mesmo segredo do agendamento, sem expô-lo na migração ou nos logs.
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

commit;
