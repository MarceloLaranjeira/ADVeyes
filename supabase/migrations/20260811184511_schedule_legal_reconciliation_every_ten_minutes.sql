begin;

-- O reconciliador é barato quando não há fontes vencidas: cada fonte mantém
-- seu próprio next_sync_at (DJEN 10 min; DataJud/Escavador 6 h). Chamá-lo a
-- cada dez minutos elimina a dependência do botão manual sem multiplicar as
-- consultas pagas.
select cron.unschedule('reconciliacao-juridica')
where exists (
  select 1 from cron.job where jobname = 'reconciliacao-juridica'
);

select cron.schedule(
  'reconciliacao-juridica',
  '*/10 * * * *',
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

commit;
