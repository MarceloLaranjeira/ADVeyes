-- Agenda o monitoramento sem expor service_role em configurações do Postgres.
-- Pré-requisitos no Supabase Vault:
--   select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('MESMO_VALOR_DO_EDGE_SECRET_CRON_SECRET', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('monitoramento-processos')
where exists (
  select 1
  from cron.job
  where jobname = 'monitoramento-processos'
);

select cron.schedule(
  'monitoramento-processos',
  '0 * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/cron-monitoramento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (where name = 'cron_secret') as cron_secret
    from vault.decrypted_secrets
  ) as secrets
  where secrets.project_url is not null
    and secrets.cron_secret is not null;
  $job$
);
