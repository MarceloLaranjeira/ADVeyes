create table public.tenant_record_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module text not null check (
    module in (
      'clientes',
      'processos',
      'financeiro',
      'eventos',
      'documentos',
      'tarefas',
      'audiencias'
    )
  ),
  record_id uuid not null,
  membership_id uuid,
  team_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((membership_id is null) <> (team_id is null)),
  foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, team_id)
    references public.tenant_teams(tenant_id, id)
    on delete cascade
);

create unique index tenant_record_assignments_member_key
  on public.tenant_record_assignments (
    tenant_id,
    module,
    record_id,
    membership_id
  )
  where membership_id is not null;
create unique index tenant_record_assignments_team_key
  on public.tenant_record_assignments (
    tenant_id,
    module,
    record_id,
    team_id
  )
  where team_id is not null;
create index tenant_record_assignments_lookup_idx
  on public.tenant_record_assignments (tenant_id, module, record_id);

alter table public.tenant_record_assignments enable row level security;
revoke all on public.tenant_record_assignments from anon, authenticated;
grant all on public.tenant_record_assignments to service_role;

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
    return p_module = 'financeiro';
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
  uuid,
  uuid,
  text,
  uuid
) from public, anon;
grant execute on function private.can_access_tenant_record(
  uuid,
  uuid,
  text,
  uuid
) to authenticated, service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'clientes',
    'processos',
    'eventos',
    'documentos',
    'tarefas',
    'audiencias'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Users can select own ' || target_table,
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'Users can insert own ' || target_table,
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'Users can update own ' || target_table,
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'Users can delete own ' || target_table,
      target_table
    );

    execute format(
      'create policy tenant_v1_select on public.%I
       for select to authenticated
       using (
         (select private.has_tenant_permission(
           tenant_id, ''legal'', ''read''
         ))
         and (select private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         ))
       )',
      target_table,
      target_table
    );
    execute format(
      'create policy tenant_v1_insert on public.%I
       for insert to authenticated
       with check (
         (select private.has_tenant_permission(
           tenant_id, ''legal'', ''create''
         ))
         and (select private.is_active_tenant_member(
           auth.uid(), tenant_id
         ))
       )',
      target_table
    );
    execute format(
      'create policy tenant_v1_update on public.%I
       for update to authenticated
       using (
         (select private.has_tenant_permission(
           tenant_id, ''legal'', ''update''
         ))
         and (select private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         ))
       )
       with check (
         (select private.has_tenant_permission(
           tenant_id, ''legal'', ''update''
         ))
         and (select private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         ))
       )',
      target_table,
      target_table,
      target_table
    );
    execute format(
      'create policy tenant_v1_delete on public.%I
       for delete to authenticated
       using (
         (select private.has_tenant_permission(
           tenant_id, ''legal'', ''delete''
         ))
         and (select private.can_access_tenant_record(
           auth.uid(), tenant_id, %L, id
         ))
       )',
      target_table,
      target_table
    );
  end loop;
end;
$$;

drop policy if exists "Users can select own financeiro"
  on public.financeiro;
drop policy if exists "Users can insert own financeiro"
  on public.financeiro;
drop policy if exists "Users can update own financeiro"
  on public.financeiro;
drop policy if exists "Users can delete own financeiro"
  on public.financeiro;

create policy tenant_v1_select on public.financeiro
for select to authenticated
using (
  (select private.has_tenant_permission(tenant_id, 'finance', 'read'))
  and (select private.can_access_tenant_record(
    auth.uid(), tenant_id, 'financeiro', id
  ))
);
create policy tenant_v1_insert on public.financeiro
for insert to authenticated
with check (
  (select private.has_tenant_permission(tenant_id, 'finance', 'create'))
  and (select private.is_active_tenant_member(auth.uid(), tenant_id))
);
create policy tenant_v1_update on public.financeiro
for update to authenticated
using (
  (select private.has_tenant_permission(tenant_id, 'finance', 'update'))
  and (select private.can_access_tenant_record(
    auth.uid(), tenant_id, 'financeiro', id
  ))
)
with check (
  (select private.has_tenant_permission(tenant_id, 'finance', 'update'))
  and (select private.can_access_tenant_record(
    auth.uid(), tenant_id, 'financeiro', id
  ))
);
create policy tenant_v1_delete on public.financeiro
for delete to authenticated
using (
  (select private.has_tenant_permission(tenant_id, 'finance', 'delete'))
  and (select private.can_access_tenant_record(
    auth.uid(), tenant_id, 'financeiro', id
  ))
);
