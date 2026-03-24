-- ADVeyes: Configura o CRON job para execução horária do cron-monitoramento
-- Requer extensões pg_cron e pg_net habilitadas no projeto Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior se existir
SELECT cron.unschedule('monitoramento-processos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitoramento-processos'
);

-- Agendar execução a cada hora
SELECT cron.schedule(
  'monitoramento-processos',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.supabase_url', true) || '/functions/v1/cron-monitoramento'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
