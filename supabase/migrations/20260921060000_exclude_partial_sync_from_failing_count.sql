-- Uma busca que parou no meio não é uma fonte com falha.
--
-- A varredura do DJEN para quando a cota da API zera, e a do DataJud quando
-- um índice atinge o teto de páginas. Nos dois casos o provedor respondeu, os
-- registros recebidos já estão gravados e a janela não avançou: a execução
-- seguinte retoma do mesmo ponto e traz o restante.
--
-- Esses códigos passaram a ser gravados em last_error_code justamente para
-- que a fonte volte antes e a interface possa avisar que ainda há resultado a
-- caminho. Contá-los junto com falha real produz alarme falso e, pior,
-- esconde no mesmo número as fontes que de fato pararam de funcionar.
--
-- partial_count é exposto separadamente para a interface poder mostrar cada
-- estado com o peso que ele merece.
create or replace view public.legal_sync_source_summary
with (security_invoker = true)
as
with classified as (
  select
    *,
    last_error_code in (
      'djen_rate_limited',
      'djen_max_pages',
      'datajud_max_pages_reached'
    ) as is_partial
  from public.legal_sync_sources
)
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
  -- Busca incompleta: o que chegou é válido, o resto vem sozinho.
  count(*) filter (
    where is_partial
      and active
      and paused_reason is null
  )::bigint as partial_count,
  count(*) filter (
    where paused_reason is distinct from 'covered_by_oab'
      and (
        (last_error_code is not null
          and last_error_code <> 'integration_not_configured'
          and not is_partial)
        or paused_reason is not null
      )
  )::bigint as failing_count,
  count(*) filter (
    where not active
      and paused_reason is distinct from 'covered_by_oab'
  )::bigint as stopped_count,
  min(next_sync_at) filter (where active) as next_run,
  max(last_success_at) as last_success
from classified
group by tenant_id;
