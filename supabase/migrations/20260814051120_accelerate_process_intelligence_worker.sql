select cron.unschedule('inteligencia-processual')
where exists (select 1 from cron.job where jobname = 'inteligencia-processual');

select cron.schedule(
  'inteligencia-processual',
  '* * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-process-intelligence',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secrets.cron_secret),
    body := '{"action":"work","limit":20}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (where name = 'cron_secret') as cron_secret
    from vault.decrypted_secrets
  ) secrets
  where secrets.project_url is not null and secrets.cron_secret is not null;
  $job$
);
