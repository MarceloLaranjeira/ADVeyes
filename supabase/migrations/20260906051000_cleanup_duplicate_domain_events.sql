begin;

with ranked as (
  select event.id,
    row_number() over (
      partition by event.tenant_id, event.type, event.aggregate_id, (event.payload - 'updated_at')
      order by event.occurred_at desc, event.id desc
    ) as version_rank
  from public.domain_events event
  where not exists (
    select 1 from public.webhook_deliveries delivery where delivery.event_id = event.id
  )
)
delete from public.domain_events event
using ranked
where event.id = ranked.id and ranked.version_rank > 1;

commit;
