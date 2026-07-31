begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

create temp table expected_tenant_tables (table_name text primary key);
insert into expected_tenant_tables (table_name) values
  ('clientes'),
  ('processos'),
  ('financeiro'),
  ('eventos'),
  ('documentos'),
  ('tarefas'),
  ('audiencias'),
  ('tribunal_credenciais'),
  ('processo_monitoramento'),
  ('notificacoes'),
  ('portal_acessos'),
  ('honorario_parcelas'),
  ('publicacoes'),
  ('andamentos'),
  ('tarefa_checklist'),
  ('tarefa_comentarios'),
  ('time_entries'),
  ('leads'),
  ('equipe'),
  ('contratos_templates'),
  ('documentos_gerados'),
  ('despesas_escritorio'),
  ('metas_financeiras'),
  ('email_send_log'),
  ('google_calendar_event_links'),
  ('google_calendar_sync_queue');

select is(
  (
    select count(*)
    from information_schema.columns column_definition
    join expected_tenant_tables expected
      on expected.table_name = column_definition.table_name
    where column_definition.table_schema = 'public'
      and column_definition.column_name = 'tenant_id'
  ),
  26::bigint,
  'as 26 tabelas classificadas possuem tenant_id'
);

select is(
  (
    select count(*)
    from information_schema.columns column_definition
    join expected_tenant_tables expected
      on expected.table_name = column_definition.table_name
    where column_definition.table_schema = 'public'
      and column_definition.column_name = 'tenant_id'
      and column_definition.is_nullable = 'YES'
  ),
  26::bigint,
  'tenant_id permanece anulável durante a compatibilidade'
);

select is(
  (
    select count(distinct relation.relname)
    from pg_constraint constraint_definition
    join pg_class relation
      on relation.oid = constraint_definition.conrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    join expected_tenant_tables expected
      on expected.table_name = relation.relname
    where constraint_definition.contype = 'f'
      and namespace.nspname = 'public'
      and constraint_definition.confrelid = 'public.tenants'::regclass
  ),
  26::bigint,
  'cada tenant_id referencia tenants'
);

select * from finish();

rollback;
