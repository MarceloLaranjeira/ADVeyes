begin;

-- As políticas de escrita das configurações liam o papel direto de
-- tenant_memberships, o que barra a sessão de suporte da plataforma (que não é
-- membro). has_tenant_permission('members','manage') vale para owner/admin e
-- também para um suporte com sessão ativa.
do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('catalogo_escritorio', 'catalogo_escritorio_manage'),
      ('tipos_tarefa', 'tipos_tarefa_manage'),
      ('workflows_tarefa', 'workflows_tarefa_manage'),
      ('workflow_tarefa_etapas', 'workflow_tarefa_etapas_manage')
    ) as t(table_name, policy_name)
  loop
    execute format('drop policy if exists %I on public.%I', target.policy_name, target.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated
       using (private.has_tenant_permission(tenant_id, ''members'', ''manage''))
       with check (private.has_tenant_permission(tenant_id, ''members'', ''manage''))',
      target.policy_name, target.table_name
    );
  end loop;
end;
$$;

drop policy if exists escritorio_perfil_insert on public.escritorio_perfil;
drop policy if exists escritorio_perfil_update on public.escritorio_perfil;

create policy escritorio_perfil_insert on public.escritorio_perfil
for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'members', 'manage'));

create policy escritorio_perfil_update on public.escritorio_perfil
for update to authenticated
using (private.has_tenant_permission(tenant_id, 'members', 'manage'))
with check (private.has_tenant_permission(tenant_id, 'members', 'manage'));

commit;
