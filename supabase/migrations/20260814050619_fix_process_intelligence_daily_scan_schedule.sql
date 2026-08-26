select cron.unschedule('inteligencia-processual-varredura')
where exists (select 1 from cron.job where jobname = 'inteligencia-processual-varredura');

select cron.schedule(
  'inteligencia-processual-varredura',
  '15 2 * * *',
  $job$
  insert into public.process_intelligence_queue (
    tenant_id, process_id, reason, status, attempts, available_at, updated_at
  )
  select p.tenant_id, p.id, 'daily_scan', 'pending', 0, now(), now()
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
  $job$
);
