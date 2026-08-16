begin;

-- Coloca o processo usado na verificação funcional à frente da fila extensa
-- do escritório, usando chaves de negócio em vez de IDs gerados.
update public.legal_sync_sources as source
set next_sync_at = '2000-01-01 00:00:00+00'
from public.processos as process,
     public.tenants as tenant
where source.tenant_id = tenant.id
  and source.process_id = process.id
  and process.tenant_id = tenant.id
  and tenant.slug = 'assis-pereira-advogados'
  and regexp_replace(process.numero, '\D', '', 'g') = '00330678320108040012'
  and source.source_kind = 'process'
  and source.provider = 'datajud';

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
