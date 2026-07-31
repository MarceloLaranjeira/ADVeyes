\set ON_ERROR_STOP on

begin read only;

do $$
declare
  expected_tenant_id uuid;
  inspected_table text;
  invalid_rows bigint;
  expected_tenant_tables constant text[] := array[
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
  select id into strict expected_tenant_id
  from public.tenants
  where slug = 'albertino';

  for inspected_table in select unnest(expected_tenant_tables) loop
    execute format(
      'select count(*) from public.%I
       where tenant_id is null or tenant_id <> $1',
      inspected_table
    )
    into invalid_rows
    using expected_tenant_id;

    if invalid_rows > 0 then
      raise exception 'invalid tenant rows in public.%: %',
        inspected_table,
        invalid_rows;
    end if;
  end loop;
end;
$$;

select
  action,
  metadata ->> 'rows_backfilled' as rows_backfilled
from public.tenant_audit_events
where action = 'tenant.backfilled'
order by occurred_at desc
limit 1;

rollback;
