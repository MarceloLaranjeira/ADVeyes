alter table public.tenant_record_assignments
  drop constraint if exists tenant_record_assignments_module_check;

alter table public.tenant_record_assignments
  add constraint tenant_record_assignments_module_check check (
    module in (
      'clientes', 'processos', 'financeiro', 'eventos', 'documentos',
      'tarefas', 'audiencias', 'tribunal_credenciais',
      'processo_monitoramento', 'notificacoes', 'portal_acessos',
      'honorario_parcelas', 'publicacoes', 'andamentos',
      'tarefa_checklist', 'tarefa_comentarios', 'time_entries', 'leads',
      'equipe', 'contratos_templates', 'documentos_gerados',
      'despesas_escritorio', 'metas_financeiras'
    )
  );

create or replace function private.can_access_tenant_record(
  p_user_id uuid,
  p_tenant_id uuid,
  p_module text,
  p_record_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  current_membership_id uuid;
  membership_role text;
  membership_scope text;
begin
  if p_record_id is null then
    return false;
  end if;

  select membership.id, membership.role, membership.data_scope
  into current_membership_id, membership_role, membership_scope
  from public.tenant_memberships membership
  where membership.user_id = p_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then
    return false;
  end if;

  if membership_role in ('owner', 'admin') then
    return true;
  end if;

  if membership_role = 'finance' then
    return p_module in (
      'financeiro', 'honorario_parcelas', 'time_entries',
      'despesas_escritorio', 'metas_financeiras',
      'contratos_templates', 'documentos_gerados'
    );
  end if;

  if membership_role not in ('lawyer', 'assistant') then
    return false;
  end if;

  if membership_scope = 'tenant' then
    return true;
  end if;

  if membership_scope = 'assigned' then
    return exists (
      select 1
      from public.tenant_record_assignments assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.module = p_module
        and assignment.record_id = p_record_id
        and assignment.membership_id = current_membership_id
    );
  end if;

  if membership_scope = 'team' then
    return exists (
      select 1
      from public.tenant_record_assignments assignment
      join public.tenant_team_members team_member
        on team_member.tenant_id = assignment.tenant_id
        and team_member.team_id = assignment.team_id
      where assignment.tenant_id = p_tenant_id
        and assignment.module = p_module
        and assignment.record_id = p_record_id
        and team_member.membership_id = current_membership_id
    );
  end if;

  return false;
end;
$$;

revoke all on function private.can_access_tenant_record(
  uuid, uuid, text, uuid
) from public, anon;
grant execute on function private.can_access_tenant_record(
  uuid, uuid, text, uuid
) to authenticated, service_role;

-- Documents inherit the process assignment so a lawyer can upload and then
-- immediately read the document without a second manual assignment.
drop policy if exists tenant_v1_select on public.documentos;
drop policy if exists tenant_v1_update on public.documentos;
drop policy if exists tenant_v1_delete on public.documentos;

create policy tenant_v2_select on public.documentos
for select to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
  )
);
create policy tenant_v2_update on public.documentos
for update to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
  )
) with check (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
  )
);
create policy tenant_v2_delete on public.documentos
for delete to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'delete')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
  )
);

-- Root records use their own assignment. Child records additionally inherit
-- access from their parent process, client, task, or template.
do $$
declare
  target record;
  policy_row record;
begin
  for target in
    select *
    from (values
      ('tribunal_credenciais', 'legal'),
      ('publicacoes', 'legal'),
      ('leads', 'legal'),
      ('despesas_escritorio', 'finance'),
      ('metas_financeiras', 'finance'),
      ('contratos_templates', 'contracts')
    ) as configured(table_name, permission_module)
  loop
    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target.table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        target.table_name
      );
    end loop;

    execute format(
      'create policy tenant_v2_select on public.%I
       for select to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''read'')
         and private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         )
       )',
      target.table_name,
      target.permission_module,
      target.table_name
    );
    execute format(
      'create policy tenant_v2_insert on public.%I
       for insert to authenticated with check (
         private.has_tenant_permission(tenant_id, %L, ''create'')
         and private.is_active_tenant_member(auth.uid(), tenant_id)
       )',
      target.table_name,
      target.permission_module
    );
    execute format(
      'create policy tenant_v2_update on public.%I
       for update to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''update'')
         and private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         )
       ) with check (
         private.has_tenant_permission(tenant_id, %L, ''update'')
         and private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         )
       )',
      target.table_name,
      target.permission_module,
      target.table_name,
      target.permission_module,
      target.table_name
    );
    execute format(
      'create policy tenant_v2_delete on public.%I
       for delete to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''delete'')
         and private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         )
       )',
      target.table_name,
      target.permission_module,
      target.table_name
    );
  end loop;
end;
$$;

do $$
declare
  target record;
  policy_row record;
  access_expression text;
begin
  for target in
    select *
    from (values
      ('processo_monitoramento', 'legal', 'processos', 'processo_id'),
      ('andamentos', 'legal', 'processos', 'processo_id'),
      ('honorario_parcelas', 'finance', 'processos', 'processo_id'),
      ('portal_acessos', 'legal', 'clientes', 'cliente_id'),
      ('tarefa_checklist', 'legal', 'tarefas', 'tarefa_id'),
      ('tarefa_comentarios', 'legal', 'tarefas', 'tarefa_id')
    ) as configured(
      table_name, permission_module, parent_module, parent_column
    )
  loop
    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target.table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        target.table_name
      );
    end loop;

    access_expression := format(
      '(private.can_access_tenant_record(auth.uid(), tenant_id, %L, id)
        or private.can_access_tenant_record(
          auth.uid(), tenant_id, %L, %I
        ))',
      target.table_name,
      target.parent_module,
      target.parent_column
    );

    execute format(
      'create policy tenant_v2_select on public.%I
       for select to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''read'')
         and %s
       )',
      target.table_name, target.permission_module, access_expression
    );
    execute format(
      'create policy tenant_v2_insert on public.%I
       for insert to authenticated with check (
         private.has_tenant_permission(tenant_id, %L, ''create'')
         and %s
       )',
      target.table_name, target.permission_module, access_expression
    );
    execute format(
      'create policy tenant_v2_update on public.%I
       for update to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''update'')
         and %s
       ) with check (
         private.has_tenant_permission(tenant_id, %L, ''update'')
         and %s
       )',
      target.table_name, target.permission_module, access_expression,
      target.permission_module, access_expression
    );
    execute format(
      'create policy tenant_v2_delete on public.%I
       for delete to authenticated using (
         private.has_tenant_permission(tenant_id, %L, ''delete'')
         and %s
       )',
      target.table_name, target.permission_module, access_expression
    );
  end loop;
end;
$$;

-- Generated documents and time entries may inherit from either linked parent.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('documentos_gerados', 'time_entries')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end;
$$;

create policy tenant_v2_select on public.documentos_gerados
for select to authenticated using (
  private.has_tenant_permission(tenant_id, 'contracts', 'read')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos_gerados', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'contratos_templates', template_id
    )
  )
);
create policy tenant_v2_insert on public.documentos_gerados
for insert to authenticated with check (
  private.has_tenant_permission(tenant_id, 'contracts', 'create')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);
create policy tenant_v2_update on public.documentos_gerados
for update to authenticated using (
  private.has_tenant_permission(tenant_id, 'contracts', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos_gerados', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'contratos_templates', template_id
    )
  )
) with check (
  private.has_tenant_permission(tenant_id, 'contracts', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos_gerados', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'contratos_templates', template_id
    )
  )
);
create policy tenant_v2_delete on public.documentos_gerados
for delete to authenticated using (
  private.has_tenant_permission(tenant_id, 'contracts', 'delete')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'documentos_gerados', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'contratos_templates', template_id
    )
  )
);

create policy tenant_v2_select on public.time_entries
for select to authenticated using (
  private.has_tenant_permission(tenant_id, 'finance', 'read')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'time_entries', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
  )
);
create policy tenant_v2_insert on public.time_entries
for insert to authenticated with check (
  private.has_tenant_permission(tenant_id, 'finance', 'create')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);
create policy tenant_v2_update on public.time_entries
for update to authenticated using (
  private.has_tenant_permission(tenant_id, 'finance', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'time_entries', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
  )
) with check (
  private.has_tenant_permission(tenant_id, 'finance', 'update')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'time_entries', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
  )
);
create policy tenant_v2_delete on public.time_entries
for delete to authenticated using (
  private.has_tenant_permission(tenant_id, 'finance', 'delete')
  and (
    private.can_access_tenant_record(
      auth.uid(), tenant_id, 'time_entries', id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'processos', processo_id
    )
    or private.can_access_tenant_record(
      auth.uid(), tenant_id, 'clientes', cliente_id
    )
  )
);

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'equipe'
  loop
    execute format(
      'drop policy if exists %I on public.equipe',
      policy_row.policyname
    );
  end loop;
end;
$$;

create policy tenant_v2_select on public.equipe
for select to authenticated using (
  private.has_tenant_permission(tenant_id, 'members', 'read')
);
create policy tenant_v2_insert on public.equipe
for insert to authenticated with check (
  private.has_tenant_permission(tenant_id, 'members', 'manage')
);
create policy tenant_v2_update on public.equipe
for update to authenticated using (
  private.has_tenant_permission(tenant_id, 'members', 'manage')
) with check (
  private.has_tenant_permission(tenant_id, 'members', 'manage')
);
create policy tenant_v2_delete on public.equipe
for delete to authenticated using (
  private.has_tenant_permission(tenant_id, 'members', 'manage')
);

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'notificacoes'
  loop
    execute format(
      'drop policy if exists %I on public.notificacoes',
      policy_row.policyname
    );
  end loop;
end;
$$;

create policy tenant_v2_select on public.notificacoes
for select to authenticated using (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);
create policy tenant_v2_insert on public.notificacoes
for insert to authenticated with check (
  user_id = auth.uid()
  and private.has_tenant_permission(tenant_id, 'legal', 'create')
);
create policy tenant_v2_update on public.notificacoes
for update to authenticated using (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
) with check (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);
create policy tenant_v2_delete on public.notificacoes
for delete to authenticated using (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

-- Delivery logs are backend-only. RLS remains enabled and no browser role gets
-- a policy, even if table privileges are accidentally widened later.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'email_send_log'
  loop
    execute format(
      'drop policy if exists %I on public.email_send_log',
      policy_row.policyname
    );
  end loop;
end;
$$;

revoke all on public.email_send_log from anon, authenticated;
grant all on public.email_send_log to service_role;
