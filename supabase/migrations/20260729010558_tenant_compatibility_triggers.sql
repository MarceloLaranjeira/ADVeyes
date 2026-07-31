create or replace function private.assign_legacy_tenant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  row_data jsonb := to_jsonb(new);
  request_user_id uuid := auth.uid();
  row_user_id uuid;
  actor_user_id uuid;
  supplied_tenant_id uuid := new.tenant_id;
  parent_tenant_ids uuid[];
  parent_tenant_id uuid;
  membership_tenant_ids uuid[];
  reference_id uuid;
  entity_type text;
begin
  if tg_op = 'UPDATE'
    and old.tenant_id is not null
    and new.tenant_id is distinct from old.tenant_id then
    raise exception using
      errcode = '23514',
      message = 'tenant_id cannot be reassigned';
  end if;

  if nullif(row_data ->> 'user_id', '') is not null then
    row_user_id := (row_data ->> 'user_id')::uuid;
  end if;

  if request_user_id is not null
    and row_user_id is not null
    and request_user_id <> row_user_id then
    raise exception using
      errcode = '42501',
      message = 'row user_id must match the authenticated user';
  end if;

  actor_user_id := coalesce(request_user_id, row_user_id);

  case tg_table_name
    when 'processos' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'financeiro' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'eventos', 'documentos', 'audiencias',
      'processo_monitoramento', 'honorario_parcelas', 'andamentos' then
      reference_id := nullif(row_data ->> 'processo_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.processos
      where id = reference_id and tenant_id is not null;
    when 'portal_acessos' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'tarefa_checklist', 'tarefa_comentarios' then
      reference_id := nullif(row_data ->> 'tarefa_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.tarefas
      where id = reference_id and tenant_id is not null;
    when 'time_entries' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'leads' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'documentos_gerados' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
        union
        select tenant_id from public.contratos_templates
        where id = nullif(row_data ->> 'template_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'google_calendar_event_links', 'google_calendar_sync_queue' then
      reference_id := nullif(row_data ->> 'entity_id', '')::uuid;
      entity_type := row_data ->> 'entity_type';
      case entity_type
        when 'evento' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.eventos where id = reference_id;
        when 'audiencia' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.audiencias where id = reference_id;
        when 'tarefa' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.tarefas where id = reference_id;
        when 'financeiro' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.financeiro where id = reference_id;
        else
          parent_tenant_ids := null;
      end case;
    else
      parent_tenant_ids := null;
  end case;

  if coalesce(cardinality(parent_tenant_ids), 0) > 1 then
    raise exception using
      errcode = '23514',
      message = 'referenced parent rows belong to different tenants';
  end if;

  parent_tenant_id := parent_tenant_ids[1];

  if supplied_tenant_id is not null
    and parent_tenant_id is not null
    and supplied_tenant_id <> parent_tenant_id then
    raise exception using
      errcode = '23514',
      message = 'tenant_id does not match the referenced parent';
  end if;

  new.tenant_id := coalesce(supplied_tenant_id, parent_tenant_id);

  if new.tenant_id is null then
    if actor_user_id is null then
      raise exception using
        errcode = '23514',
        message = 'tenant context is required for internal records';
    end if;

    select array_agg(tenant_id order by tenant_id)
    into membership_tenant_ids
    from public.tenant_memberships
    where user_id = actor_user_id
      and status = 'active';

    if coalesce(cardinality(membership_tenant_ids), 0) <> 1 then
      raise exception using
        errcode = '23514',
        message =
          'legacy insert requires exactly one active tenant membership';
    end if;

    new.tenant_id := membership_tenant_ids[1];
  end if;

  if actor_user_id is not null and not exists (
    select 1
    from public.tenant_memberships
    where user_id = actor_user_id
      and tenant_id = new.tenant_id
      and status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'user is not an active member of the resolved tenant';
  end if;

  return new;
end;
$$;

revoke all on function private.assign_legacy_tenant()
  from public, anon, authenticated, service_role;

create trigger clientes_assign_legacy_tenant
before insert or update of tenant_id on public.clientes
for each row execute function private.assign_legacy_tenant();
create trigger processos_assign_legacy_tenant
before insert or update of tenant_id on public.processos
for each row execute function private.assign_legacy_tenant();
create trigger financeiro_assign_legacy_tenant
before insert or update of tenant_id on public.financeiro
for each row execute function private.assign_legacy_tenant();
create trigger eventos_assign_legacy_tenant
before insert or update of tenant_id on public.eventos
for each row execute function private.assign_legacy_tenant();
create trigger documentos_assign_legacy_tenant
before insert or update of tenant_id on public.documentos
for each row execute function private.assign_legacy_tenant();
create trigger tarefas_assign_legacy_tenant
before insert or update of tenant_id on public.tarefas
for each row execute function private.assign_legacy_tenant();
create trigger audiencias_assign_legacy_tenant
before insert or update of tenant_id on public.audiencias
for each row execute function private.assign_legacy_tenant();
create trigger tribunal_credenciais_assign_legacy_tenant
before insert or update of tenant_id on public.tribunal_credenciais
for each row execute function private.assign_legacy_tenant();
create trigger processo_monitoramento_assign_legacy_tenant
before insert or update of tenant_id on public.processo_monitoramento
for each row execute function private.assign_legacy_tenant();
create trigger notificacoes_assign_legacy_tenant
before insert or update of tenant_id on public.notificacoes
for each row execute function private.assign_legacy_tenant();
create trigger portal_acessos_assign_legacy_tenant
before insert or update of tenant_id on public.portal_acessos
for each row execute function private.assign_legacy_tenant();
create trigger honorario_parcelas_assign_legacy_tenant
before insert or update of tenant_id on public.honorario_parcelas
for each row execute function private.assign_legacy_tenant();
create trigger publicacoes_assign_legacy_tenant
before insert or update of tenant_id on public.publicacoes
for each row execute function private.assign_legacy_tenant();
create trigger andamentos_assign_legacy_tenant
before insert or update of tenant_id on public.andamentos
for each row execute function private.assign_legacy_tenant();
create trigger tarefa_checklist_assign_legacy_tenant
before insert or update of tenant_id on public.tarefa_checklist
for each row execute function private.assign_legacy_tenant();
create trigger tarefa_comentarios_assign_legacy_tenant
before insert or update of tenant_id on public.tarefa_comentarios
for each row execute function private.assign_legacy_tenant();
create trigger time_entries_assign_legacy_tenant
before insert or update of tenant_id on public.time_entries
for each row execute function private.assign_legacy_tenant();
create trigger leads_assign_legacy_tenant
before insert or update of tenant_id on public.leads
for each row execute function private.assign_legacy_tenant();
create trigger equipe_assign_legacy_tenant
before insert or update of tenant_id on public.equipe
for each row execute function private.assign_legacy_tenant();
create trigger contratos_templates_assign_legacy_tenant
before insert or update of tenant_id on public.contratos_templates
for each row execute function private.assign_legacy_tenant();
create trigger documentos_gerados_assign_legacy_tenant
before insert or update of tenant_id on public.documentos_gerados
for each row execute function private.assign_legacy_tenant();
create trigger despesas_escritorio_assign_legacy_tenant
before insert or update of tenant_id on public.despesas_escritorio
for each row execute function private.assign_legacy_tenant();
create trigger metas_financeiras_assign_legacy_tenant
before insert or update of tenant_id on public.metas_financeiras
for each row execute function private.assign_legacy_tenant();
create trigger email_send_log_assign_legacy_tenant
before insert or update of tenant_id on public.email_send_log
for each row execute function private.assign_legacy_tenant();
create trigger google_calendar_event_links_assign_legacy_tenant
before insert or update of tenant_id on public.google_calendar_event_links
for each row execute function private.assign_legacy_tenant();
create trigger google_calendar_sync_queue_assign_legacy_tenant
before insert or update of tenant_id on public.google_calendar_sync_queue
for each row execute function private.assign_legacy_tenant();

comment on function private.assign_legacy_tenant() is
  'TEMPORARY compatibility trigger; remove after all writers pass tenant_id.';
