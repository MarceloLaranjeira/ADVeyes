begin;

alter table public.legal_portal_connections
  add column if not exists session_expires_at timestamptz;

comment on column public.legal_portal_connections.session_expires_at is
  'Expiração da sessão autenticada mantida de forma criptografada no Vault.';

create or replace function private.emit_public_api_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  tenant_value uuid := (row_data ->> 'tenant_id')::uuid;
  aggregate_value uuid := (row_data ->> 'id')::uuid;
  aggregate_name text;
  event_name text;
  event_payload jsonb;
  old_public_payload jsonb;
  event_value uuid;
begin
  if tenant_value is null or aggregate_value is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  aggregate_name := case tg_table_name
    when 'clientes' then 'contact'
    when 'processos' then 'process'
    when 'tarefas' then 'task'
  end;

  event_payload := case tg_table_name
    when 'clientes' then jsonb_build_object(
      'id', row_data -> 'id', 'name', row_data -> 'nome',
      'document', row_data -> 'cpf', 'email', row_data -> 'email',
      'phone', row_data -> 'telefone', 'person_type', row_data -> 'person_type',
      'relationship_type', row_data -> 'relationship_type',
      'updated_at', row_data -> 'updated_at', 'deleted_at', row_data -> 'deleted_at'
    )
    when 'processos' then jsonb_build_object(
      'id', row_data -> 'id', 'number', row_data -> 'numero',
      'contact_id', row_data -> 'cliente_id', 'client_name', row_data -> 'cliente_nome',
      'status', row_data -> 'status', 'court', row_data -> 'tribunal',
      'updated_at', row_data -> 'updated_at', 'deleted_at', row_data -> 'deleted_at'
    )
    when 'tarefas' then jsonb_build_object(
      'id', row_data -> 'id', 'title', row_data -> 'titulo',
      'status', row_data -> 'status', 'priority', row_data -> 'prioridade',
      'due_at', row_data -> 'data_limite', 'process_id', row_data -> 'processo_id',
      'assignee_id', row_data -> 'responsavel_id', 'completed_at', row_data -> 'concluida_em',
      'updated_at', row_data -> 'updated_at', 'deleted_at', row_data -> 'deleted_at'
    )
  end;

  if tg_op = 'UPDATE' then
    old_public_payload := case tg_table_name
      when 'clientes' then jsonb_build_object(
        'id', old_row -> 'id', 'name', old_row -> 'nome',
        'document', old_row -> 'cpf', 'email', old_row -> 'email',
        'phone', old_row -> 'telefone', 'person_type', old_row -> 'person_type',
        'relationship_type', old_row -> 'relationship_type',
        'deleted_at', old_row -> 'deleted_at'
      )
      when 'processos' then jsonb_build_object(
        'id', old_row -> 'id', 'number', old_row -> 'numero',
        'contact_id', old_row -> 'cliente_id', 'client_name', old_row -> 'cliente_nome',
        'status', old_row -> 'status', 'court', old_row -> 'tribunal',
        'deleted_at', old_row -> 'deleted_at'
      )
      when 'tarefas' then jsonb_build_object(
        'id', old_row -> 'id', 'title', old_row -> 'titulo',
        'status', old_row -> 'status', 'priority', old_row -> 'prioridade',
        'due_at', old_row -> 'data_limite', 'process_id', old_row -> 'processo_id',
        'assignee_id', old_row -> 'responsavel_id', 'completed_at', old_row -> 'concluida_em',
        'deleted_at', old_row -> 'deleted_at'
      )
    end;
    if old_public_payload = event_payload - 'updated_at' then return new; end if;
  end if;

  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and old_row ->> 'deleted_at' is null
         and new_row ->> 'deleted_at' is not null) then
    event_name := aggregate_name || '.deleted';
  elsif tg_op = 'INSERT' then
    event_name := aggregate_name || '.created';
  elsif tg_table_name = 'tarefas'
        and old_row ->> 'status' is distinct from 'concluída'
        and new_row ->> 'status' = 'concluída' then
    event_name := 'task.completed';
  else
    event_name := aggregate_name || '.updated';
  end if;

  insert into public.domain_events (tenant_id, type, aggregate_type, aggregate_id, payload)
  values (tenant_value, event_name, aggregate_name, aggregate_value, event_payload)
  returning id into event_value;

  insert into public.webhook_deliveries (tenant_id, event_id, endpoint_id)
  select tenant_value, event_value, endpoint.id
  from public.webhook_endpoints endpoint
  where endpoint.tenant_id = tenant_value
    and endpoint.active
    and (event_name = any(endpoint.event_types) or '*' = any(endpoint.event_types));

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.run_adveyes_technical_retention(p_batch_size integer default 20000)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_size integer := least(greatest(coalesce(p_batch_size, 20000), 100), 50000);
  domain_deleted integer := 0;
  cron_deleted integer := 0;
  intelligence_deleted integer := 0;
  sync_deleted integer := 0;
begin
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
  ), candidates as (
    select id from ranked where version_rank > 1 limit batch_size
  )
  delete from public.domain_events event
  using candidates
  where event.id = candidates.id;
  get diagnostics domain_deleted = row_count;

  with candidates as (
    select detail.runid
    from cron.job_run_details detail
    where (
      detail.status = 'succeeded' and detail.end_time < now() - interval '3 days'
    ) or (
      detail.status <> 'succeeded' and detail.end_time < now() - interval '30 days'
    )
    order by detail.end_time
    limit batch_size
  )
  delete from cron.job_run_details detail
  using candidates
  where detail.runid = candidates.runid;
  get diagnostics cron_deleted = row_count;

  with ranked as (
    select history.id,
      row_number() over (
        partition by history.tenant_id, history.process_id, history.classifier_version
        order by history.created_at desc, history.id desc
      ) as version_rank
    from public.process_intelligence_history history
    where history.change_kind <> 'manual_correction'
  ), candidates as (
    select id from ranked where version_rank > 5 limit batch_size
  )
  delete from public.process_intelligence_history history
  using candidates
  where history.id = candidates.id;
  get diagnostics intelligence_deleted = row_count;

  with ranked as (
    select run.id, run.status, run.started_at,
      row_number() over (
        partition by run.tenant_id, run.provider, run.sync_kind, coalesce(run.source_id::text, '')
        order by run.started_at desc, run.id desc
      ) as source_rank
    from public.legal_sync_runs run
    where run.status <> 'running'
  ), candidates as (
    select id
    from ranked
    where source_rank > 1 and (
      (status = 'succeeded' and started_at < now() - interval '7 days')
      or (status in ('failed', 'partial') and started_at < now() - interval '30 days')
    )
    limit batch_size
  )
  delete from public.legal_sync_runs run
  using candidates
  where run.id = candidates.id;
  get diagnostics sync_deleted = row_count;

  return jsonb_build_object(
    'domain_events', domain_deleted,
    'cron_runs', cron_deleted,
    'intelligence_history', intelligence_deleted,
    'legal_sync_runs', sync_deleted
  );
end;
$$;

revoke all on function private.run_adveyes_technical_retention(integer) from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'adveyes-technical-retention-daily';

select cron.schedule(
  'adveyes-technical-retention-daily',
  '40 7 * * *',
  $retention$select private.run_adveyes_technical_retention(50000);$retention$
);

comment on function private.run_adveyes_technical_retention(integer) is
  'Retém apenas histórico técnico necessário; não remove registros jurídicos canônicos.';

commit;
