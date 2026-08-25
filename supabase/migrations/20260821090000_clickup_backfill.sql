-- Carga inicial da carteira no ClickUp.
--
-- Os triggers de 20260820120000 só disparam em insert, update e delete. Um
-- escritório que liga a integração com 800 processos já cadastrados veria um
-- board vazio até alguém editar alguma coisa — a carteira inteira ficaria
-- invisível. Esta função enfileira o que já existe.
--
-- Roda em lotes porque o rate limit do ClickUp é por token: despejar 800 jobs
-- de uma vez só faz o worker bater em 429 e passar a próxima meia hora em
-- backoff. Chame de novo até devolver zero.

create or replace function public.enqueue_clickup_backfill(
  p_tenant_id uuid,
  p_limit integer default 200
)
returns table (entity_type text, enqueued integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 1000));
  v_count integer;
begin
  -- Sem conexão ativa não há para onde sincronizar.
  if not exists (
    select 1
    from public.clickup_connections c
    where c.tenant_id = p_tenant_id and c.status = 'active'
  ) then
    raise exception 'Tenant % nao possui conexao ClickUp ativa', p_tenant_id
      using errcode = 'check_violation';
  end if;

  -- Processos primeiro: prazo e audiência penduram no card do processo, e o
  -- worker devolve parent_not_synced enquanto o pai não existir.
  with candidatos as (
    select p.id
    from public.processos p
    left join public.clickup_task_links l
      on l.tenant_id = p.tenant_id
     and l.entity_type = 'processo'
     and l.entity_id = p.id
    where p.tenant_id = p_tenant_id
      and p.segredo_justica = false
      and l.entity_id is null
    order by p.updated_at desc nulls last
    limit v_limit
  )
  insert into public.clickup_sync_queue (tenant_id, entity_type, entity_id, operation)
  select p_tenant_id, 'processo', c.id, 'upsert'
  from candidatos c
  on conflict on constraint clickup_sync_queue_entity_key do nothing;

  get diagnostics v_count = row_count;
  entity_type := 'processo';
  enqueued := v_count;
  return next;

  -- Prazos ainda pendentes de conferência ou já confirmados. Rejeitado não vai.
  with candidatos as (
    select d.id
    from public.deadline_suggestions d
    left join public.clickup_task_links l
      on l.tenant_id = d.tenant_id
     and l.entity_type = 'prazo'
     and l.entity_id = d.id
    where d.tenant_id = p_tenant_id
      and d.status in ('pending', 'confirmed')
      and l.entity_id is null
      and not private.clickup_entity_is_restricted(p_tenant_id, 'prazo', d.id)
    order by d.created_at desc
    limit v_limit
  )
  insert into public.clickup_sync_queue (tenant_id, entity_type, entity_id, operation)
  select p_tenant_id, 'prazo', c.id, 'upsert'
  from candidatos c
  on conflict on constraint clickup_sync_queue_entity_key do nothing;

  get diagnostics v_count = row_count;
  entity_type := 'prazo';
  enqueued := v_count;
  return next;

  -- Só audiência futura: retroativo polui a agenda sem ajudar ninguém.
  with candidatos as (
    select a.id
    from public.audiencias a
    left join public.clickup_task_links l
      on l.tenant_id = a.tenant_id
     and l.entity_type = 'audiencia'
     and l.entity_id = a.id
    where a.tenant_id = p_tenant_id
      and a.data_hora >= now() - interval '7 days'
      and l.entity_id is null
      and not private.clickup_entity_is_restricted(p_tenant_id, 'audiencia', a.id)
    order by a.data_hora
    limit v_limit
  )
  insert into public.clickup_sync_queue (tenant_id, entity_type, entity_id, operation)
  select p_tenant_id, 'audiencia', c.id, 'upsert'
  from candidatos c
  on conflict on constraint clickup_sync_queue_entity_key do nothing;

  get diagnostics v_count = row_count;
  entity_type := 'audiencia';
  enqueued := v_count;
  return next;

  return;
end;
$$;

revoke execute on function public.enqueue_clickup_backfill(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_clickup_backfill(uuid, integer)
  to service_role;

comment on function public.enqueue_clickup_backfill(uuid, integer) is
  'Enfileira a carteira existente de um tenant para espelhamento inicial. '
  'Idempotente: ignora o que já tem vínculo em clickup_task_links. '
  'Chame repetidamente até todas as linhas devolverem zero.';
