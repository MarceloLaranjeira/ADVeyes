begin;

create or replace function public.claim_public_api_webhook_deliveries(batch_size integer default 20)
returns table (
  delivery_id uuid,
  tenant_id uuid,
  attempt_count integer,
  event_id uuid,
  event_type text,
  event_payload jsonb,
  event_occurred_at timestamptz,
  endpoint_id uuid,
  endpoint_url text,
  endpoint_secret_ciphertext text,
  endpoint_active boolean
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select delivery.id
    from public.webhook_deliveries delivery
    where (
      delivery.status = 'pending'
      and delivery.next_attempt_at <= now()
    ) or (
      delivery.status = 'delivering'
      and delivery.locked_at < now() - interval '10 minutes'
    )
    order by delivery.next_attempt_at, delivery.created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 50)
  ), claimed as (
    update public.webhook_deliveries delivery
    set
      status = 'delivering',
      attempt_count = delivery.attempt_count + 1,
      locked_at = now(),
      updated_at = now()
    from candidates
    where delivery.id = candidates.id
      and delivery.attempt_count < 6
    returning delivery.*
  )
  select
    claimed.id,
    claimed.tenant_id,
    claimed.attempt_count,
    event.id,
    event.type,
    event.payload,
    event.occurred_at,
    endpoint.id,
    endpoint.url,
    endpoint.secret_ciphertext,
    endpoint.active
  from claimed
  join public.domain_events event on event.id = claimed.event_id
  join public.webhook_endpoints endpoint on endpoint.id = claimed.endpoint_id;
$$;

revoke all on function public.claim_public_api_webhook_deliveries(integer)
from public, anon, authenticated;
grant execute on function public.claim_public_api_webhook_deliveries(integer)
to service_role;

select cron.unschedule('adveyes-public-api-webhooks')
where exists (select 1 from cron.job where jobname = 'adveyes-public-api-webhooks');

select cron.schedule(
  'adveyes-public-api-webhooks',
  '* * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/public-api-webhook-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secrets.cron_secret
    ),
    body := '{"limit":20}'::jsonb,
    timeout_milliseconds := 55000
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

comment on function public.claim_public_api_webhook_deliveries(integer) is
  'Reserva atomicamente entregas de webhook vencidas para o worker da API pública.';

commit;
