-- Saúde das fontes de monitoramento agrupada por provedor, para o alerta do
-- topo de Intimações ("Escavador com falha, monitorando apenas DJEN").
-- Usa os mesmos critérios de falha de legal_sync_source_summary.

begin;

create or replace view public.legal_sync_provider_health
with (security_invoker = true)
as
select
  tenant_id,
  provider,
  count(*) filter (
    where active and last_error_code is null
  )::bigint as healthy_count,
  count(*) filter (
    where paused_reason is distinct from 'covered_by_oab'
      and (
        (last_error_code is not null
          and last_error_code <> 'integration_not_configured')
        or paused_reason is not null
      )
  )::bigint as failing_count,
  mode() within group (order by coalesce(paused_reason, last_error_code)) filter (
    where paused_reason is distinct from 'covered_by_oab'
      and (
        (last_error_code is not null
          and last_error_code <> 'integration_not_configured')
        or paused_reason is not null
      )
  ) as top_failure_code
from public.legal_sync_sources
group by tenant_id, provider;

revoke all privileges on table public.legal_sync_provider_health
from anon, authenticated;

grant select on table public.legal_sync_provider_health to authenticated;

grant all privileges on table public.legal_sync_provider_health to service_role;

comment on view public.legal_sync_provider_health is
  'Fontes saudáveis e com falha por provedor; herda o RLS de legal_sync_sources.';

commit;
