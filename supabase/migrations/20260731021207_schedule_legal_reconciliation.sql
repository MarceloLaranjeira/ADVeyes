-- Reconciliação jurídica a cada seis horas, sem expor service_role.
-- Pré-requisitos no Supabase Vault (já usados pelo monitoramento existente):
--   select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('MESMO_VALOR_DO_EDGE_SECRET_CRON_SECRET', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('reconciliacao-juridica')
where exists (
  select 1
  from cron.job
  where jobname = 'reconciliacao-juridica'
);

select cron.schedule(
  'reconciliacao-juridica',
  '15 */6 * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/legal-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
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
