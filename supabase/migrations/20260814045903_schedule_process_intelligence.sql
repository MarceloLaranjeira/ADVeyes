begin;

select cron.unschedule('inteligencia-processual')
where exists (select 1 from cron.job where jobname = 'inteligencia-processual');

select cron.schedule(
  'inteligencia-processual',
  '* * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-process-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{"action":"work","limit":20}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (where name = 'cron_secret') as cron_secret
    from vault.decrypted_secrets
  ) secrets
  where secrets.project_url is not null
    and secrets.cron_secret is not null;
  $job$
);

select cron.unschedule('inteligencia-processual-varredura')
where exists (select 1 from cron.job where jobname = 'inteligencia-processual-varredura');

select cron.schedule(
  'inteligencia-processual-varredura',
  '15 2 * * *',
  $job$
  insert into public.process_intelligence_queue (
    tenant_id,
    process_id,
    reason,
    status,
    attempts,
    available_at,
    updated_at
  )
  select
    p.tenant_id,
    p.id,
    'daily_scan',
    'pending',
    0,
    now(),
    now()
  from public.processos p
  where p.tenant_id is not null
  on conflict (tenant_id, process_id) do update set
    reason = excluded.reason,
    status = 'pending',
    attempts = 0,
    available_at = now(),
    last_error = null,
    updated_at = now();
  $job$
);

commit;
