insert into public.process_intelligence_queue (
  tenant_id, process_id, reason, status, attempts, available_at, updated_at
)
select p.tenant_id, p.id, 'backfill', 'pending', 0, now(), now()
from public.processos p
where p.tenant_id is not null
on conflict (tenant_id, process_id) do update set
  reason = excluded.reason,
  status = 'pending',
  attempts = 0,
  available_at = now(),
  locked_at = null,
  last_error_code = null,
  updated_at = now();
