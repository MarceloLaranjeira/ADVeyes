-- Evita recalcular auth.uid() para cada linha avaliada pelas politicas de
-- insercao. O SELECT sem correlacao vira um initPlan e e executado uma vez
-- por consulta, conforme recomendado pelo Database Advisor do Supabase.

begin;

do $$
declare
  alvo record;
begin
  for alvo in
    select *
    from (values
      ('clientes',           'legal'),
      ('processos',          'legal'),
      ('eventos',            'legal'),
      ('tarefas',            'legal'),
      ('audiencias',         'legal'),
      ('documentos',         'legal'),
      ('documentos_gerados', 'contracts'),
      ('time_entries',       'finance')
    ) as t(tabela, modulo)
  loop
    execute format(
      'alter policy tenant_insert on public.%I
         with check (
           private.has_tenant_permission(tenant_id, %L, ''create'')
           and private.is_active_tenant_member((select auth.uid()), tenant_id)
         )',
      alvo.tabela, alvo.modulo
    );
  end loop;
end;
$$;

commit;
