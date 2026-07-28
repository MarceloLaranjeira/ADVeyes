-- ADVeyes multiempresa: inventário somente leitura.
-- Execute com uma conexão administrativa em local/homologação.
-- Não compartilhe a saída publicamente: ela contém metadados operacionais.

\echo '== Ambiente =='
select
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  current_timestamp as captured_at;

\echo '== Contagem de usuários =='
select count(*) as auth_users from auth.users;

\echo '== Contagem exata das tabelas empresariais =='
select 'asaas_subscriptions' as table_name, count(*) as row_count from public.asaas_subscriptions
union all select 'audiencias', count(*) from public.audiencias
union all select 'clientes', count(*) from public.clientes
union all select 'contratos_templates', count(*) from public.contratos_templates
union all select 'despesas_escritorio', count(*) from public.despesas_escritorio
union all select 'documentos', count(*) from public.documentos
union all select 'documentos_gerados', count(*) from public.documentos_gerados
union all select 'email_send_log', count(*) from public.email_send_log
union all select 'email_send_state', count(*) from public.email_send_state
union all select 'email_unsubscribe_tokens', count(*) from public.email_unsubscribe_tokens
union all select 'equipe', count(*) from public.equipe
union all select 'eventos', count(*) from public.eventos
union all select 'financeiro', count(*) from public.financeiro
union all select 'honorario_parcelas', count(*) from public.honorario_parcelas
union all select 'leads', count(*) from public.leads
union all select 'metas_financeiras', count(*) from public.metas_financeiras
union all select 'notificacoes', count(*) from public.notificacoes
union all select 'portal_acessos', count(*) from public.portal_acessos
union all select 'processo_monitoramento', count(*) from public.processo_monitoramento
union all select 'processos', count(*) from public.processos
union all select 'profiles', count(*) from public.profiles
union all select 'publicacoes', count(*) from public.publicacoes
union all select 'suppressed_emails', count(*) from public.suppressed_emails
union all select 'tarefas', count(*) from public.tarefas
union all select 'time_entries', count(*) from public.time_entries
union all select 'tribunal_credenciais', count(*) from public.tribunal_credenciais
order by table_name;

\echo '== Tabelas públicas, RLS e estimativa de linhas =='
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce(s.n_live_tup, 0) as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s
  on s.schemaname = n.nspname and s.relname = c.relname
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

\echo '== Tabelas públicas sem RLS =='
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by c.relname;

\echo '== Policies =='
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

\echo '== Funções SECURITY DEFINER e search_path =='
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  coalesce(
    array_to_string(
      array(
        select setting
        from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      ),
      ', '
    ),
    ''
  ) as search_path_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosecdef
order by n.nspname, p.proname;

\echo '== Extensões =='
select extname, extversion, n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by extname;

\echo '== Jobs pg_cron =='
select jobid, jobname, schedule, active, database, username, command
from cron.job
order by jobid;

\echo '== Storage =='
select
  b.id as bucket_id,
  b.public,
  count(o.id) as object_count,
  coalesce(sum((o.metadata ->> 'size')::bigint), 0) as total_bytes
from storage.buckets b
left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public
order by b.id;

\echo '== Colunas user_id e tenant_id =='
select table_schema, table_name, column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and column_name in ('user_id', 'tenant_id')
order by table_name, column_name;

\echo '== Linhas com user_id nulo nas tabelas que possuem a coluna =='
select 'asaas_subscriptions' as table_name, count(*) as null_user_ids
from public.asaas_subscriptions where user_id is null
union all select 'audiencias', count(*) from public.audiencias where user_id is null
union all select 'clientes', count(*) from public.clientes where user_id is null
union all select 'documentos', count(*) from public.documentos where user_id is null
union all select 'eventos', count(*) from public.eventos where user_id is null
union all select 'financeiro', count(*) from public.financeiro where user_id is null
union all select 'notificacoes', count(*) from public.notificacoes where user_id is null
union all select 'processo_monitoramento', count(*) from public.processo_monitoramento where user_id is null
union all select 'processos', count(*) from public.processos where user_id is null
union all select 'publicacoes', count(*) from public.publicacoes where user_id is null
union all select 'tarefas', count(*) from public.tarefas where user_id is null
union all select 'tribunal_credenciais', count(*) from public.tribunal_credenciais where user_id is null
order by table_name;

\echo '== Histórico de migrations =='
select version, name
from supabase_migrations.schema_migrations
order by version;
