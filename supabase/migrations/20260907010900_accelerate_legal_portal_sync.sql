begin;

select cron.unschedule('legal-portal-worker')
where exists (
  select 1 from cron.job where jobname = 'legal-portal-worker'
);

select cron.schedule(
  'legal-portal-worker',
  '*/10 * * * *',
  $schedule$
  with secrets as (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as cron_secret
  )
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-portal-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{"scope":"due"}'::jsonb,
    timeout_milliseconds := 120000
  )
  from secrets
  where secrets.project_url is not null
    and secrets.cron_secret is not null;
  $schedule$
);

commit;
