begin;

with ranked as (
  select history.id,
    row_number() over (
      partition by history.tenant_id, history.process_id, history.classifier_version
      order by history.created_at desc, history.id desc
    ) as version_rank
  from public.process_intelligence_history history
  where history.change_kind <> 'manual_correction'
)
delete from public.process_intelligence_history history
using ranked
where history.id = ranked.id and ranked.version_rank > 5;

commit;
