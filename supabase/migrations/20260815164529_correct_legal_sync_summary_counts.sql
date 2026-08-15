-- Não apresenta como falha as fontes DJEN desativadas de propósito porque a
-- mesma carteira já está coberta por uma OAB ativa.
create or replace view public.legal_sync_source_summary
with (security_invoker = true)
as
select
  tenant_id,
  count(distinct reference) filter (
    where active and source_kind = 'oab'
  )::bigint as monitored_oabs,
  count(distinct reference) filter (
    where active and source_kind = 'process'
  )::bigint as monitored_processes,
  count(*) filter (
    where last_error_code = 'integration_not_configured'
  )::bigint as pending_count,
  count(*) filter (
    where paused_reason is distinct from 'covered_by_oab'
      and (
        (last_error_code is not null
          and last_error_code <> 'integration_not_configured')
        or paused_reason is not null
      )
  )::bigint as failing_count,
  count(*) filter (
    where not active
      and paused_reason is distinct from 'covered_by_oab'
  )::bigint as stopped_count,
  min(next_sync_at) filter (where active) as next_run,
  max(last_success_at) as last_success
from public.legal_sync_sources
group by tenant_id;
