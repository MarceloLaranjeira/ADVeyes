create or replace function private.backfill_albertino_tenant()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  albertino_tenant_id uuid;
  table_name text;
  affected integer;
  invalid_exists boolean;
  total_affected integer := 0;
  tenant_tables constant text[] := array[
    'clientes',
    'processos',
    'financeiro',
    'eventos',
    'documentos',
    'tarefas',
    'audiencias',
    'tribunal_credenciais',
    'processo_monitoramento',
    'notificacoes',
    'portal_acessos',
    'honorario_parcelas',
    'publicacoes',
    'andamentos',
    'tarefa_checklist',
    'tarefa_comentarios',
    'time_entries',
    'leads',
    'equipe',
    'contratos_templates',
    'documentos_gerados',
    'despesas_escritorio',
    'metas_financeiras',
    'email_send_log',
    'google_calendar_event_links',
    'google_calendar_sync_queue'
  ];
begin
  select id into albertino_tenant_id
  from public.tenants
  where slug = 'albertino';

  if albertino_tenant_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Albertino backfill requires tenant slug albertino';
  end if;

  for table_name in select unnest(tenant_tables) loop
    execute format(
      'update public.%I set tenant_id = $1 where tenant_id is null',
      table_name
    )
    using albertino_tenant_id;
    get diagnostics affected = row_count;
    total_affected := total_affected + affected;
  end loop;

  if exists (
    select 1
    from public.processos child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.financeiro child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.financeiro child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.eventos child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.documentos child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.audiencias child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.processo_monitoramento child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.portal_acessos child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.honorario_parcelas child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.andamentos child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.tarefa_checklist child
    join public.tarefas parent on parent.id = child.tarefa_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.tarefa_comentarios child
    join public.tarefas parent on parent.id = child.tarefa_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.time_entries child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.time_entries child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.leads child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.documentos_gerados child
    join public.processos parent on parent.id = child.processo_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.documentos_gerados child
    join public.clientes parent on parent.id = child.cliente_id
    where child.tenant_id <> parent.tenant_id
  ) or exists (
    select 1
    from public.documentos_gerados child
    join public.contratos_templates parent on parent.id = child.template_id
    where child.tenant_id <> parent.tenant_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'tenant backfill found a parent-child tenant mismatch';
  end if;

  for table_name in select unnest(tenant_tables) loop
    execute format(
      'select exists (
        select 1 from public.%I
        where tenant_id is null or tenant_id <> $1
      )',
      table_name
    )
    into invalid_exists
    using albertino_tenant_id;

    if invalid_exists then
      raise exception using
        errcode = '23514',
        message = format(
          'tenant backfill left invalid rows in public.%I',
          table_name
        );
    end if;
  end loop;

  if not exists (
    select 1
    from public.tenant_audit_events
    where tenant_id = albertino_tenant_id
      and action = 'tenant.backfilled'
      and metadata ->> 'migration_key' =
        '20260729004248_backfill_albertino_tenant'
  ) then
    insert into public.tenant_audit_events (
      tenant_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      albertino_tenant_id,
      'tenant.backfilled',
      'tenant',
      albertino_tenant_id::text,
      jsonb_build_object(
        'migration_key',
        '20260729004248_backfill_albertino_tenant',
        'rows_backfilled',
        total_affected
      )
    );
  end if;

  return total_affected;
end;
$$;

revoke all on function private.backfill_albertino_tenant()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from public.tenants where slug = 'albertino') then
    perform private.backfill_albertino_tenant();
  end if;
end;
$$;
