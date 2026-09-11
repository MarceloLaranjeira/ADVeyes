begin;

with ranked as (
  select run.id, run.status, run.started_at,
    row_number() over (
      partition by run.tenant_id, run.provider, run.sync_kind, coalesce(run.source_id::text, '')
      order by run.started_at desc, run.id desc
    ) as source_rank
  from public.legal_sync_runs run
  where run.status <> 'running'
)
delete from public.legal_sync_runs run
using ranked
where run.id = ranked.id
  and ranked.source_rank > 1
  and (
    (ranked.status = 'succeeded' and ranked.started_at < now() - interval '7 days')
    or (ranked.status in ('failed', 'partial') and ranked.started_at < now() - interval '30 days')
  );

commit;
