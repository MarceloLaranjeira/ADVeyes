create or replace function private.is_platform_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.platform_admins administrator
    where administrator.user_id = p_user_id
      and administrator.is_active
  );
$$;

create or replace function private.is_active_tenant_member(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.tenant_memberships membership
    where membership.user_id = p_user_id
      and membership.tenant_id = p_tenant_id
      and membership.status = 'active'
  );
$$;

create or replace function private.tenant_role(
  p_user_id uuid,
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select membership.role
  from public.tenant_memberships membership
  where membership.user_id = p_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;
$$;

create or replace function private.has_tenant_permission(
  p_tenant_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  membership_role text;
  overrides jsonb;
  override_allowed boolean;
begin
  select membership.role, membership.permission_overrides
  into membership_role, overrides
  from public.tenant_memberships membership
  where membership.user_id = auth.uid()
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then
    return false;
  end if;

  override_allowed :=
    lower(coalesce(overrides #>> array[p_module, p_action], 'false')) = 'true';

  if p_module = 'platform' then
    return false;
  end if;

  if p_module = 'ownership' and p_action = 'transfer' then
    return membership_role = 'owner';
  end if;

  if p_module = 'subscription' then
    if p_action = 'read' then
      return membership_role in ('owner', 'admin')
        or (membership_role = 'finance' and override_allowed);
    end if;

    if p_action = 'manage' then
      return membership_role = 'owner'
        or (membership_role = 'finance' and override_allowed);
    end if;

    return false;
  end if;

  if p_module = 'members' and p_action in ('read', 'manage') then
    return membership_role in ('owner', 'admin');
  end if;

  if p_module = 'brand' and p_action in ('read', 'manage') then
    return membership_role in ('owner', 'admin');
  end if;

  if p_module = 'legal' then
    if p_action in ('read', 'create', 'update') then
      return membership_role in ('owner', 'admin', 'lawyer', 'assistant');
    end if;

    if p_action = 'delete' then
      return membership_role = 'owner'
        or (membership_role = 'admin' and override_allowed);
    end if;

    return false;
  end if;

  if p_module in ('finance', 'contracts') then
    if p_action in ('read', 'create', 'update') then
      return membership_role in ('owner', 'admin', 'finance')
        or (
          membership_role in ('lawyer', 'assistant')
          and override_allowed
        );
    end if;

    if p_action = 'delete' then
      return membership_role = 'owner'
        or (
          membership_role in ('admin', 'finance')
          and override_allowed
        );
    end if;

    return false;
  end if;

  if p_module = 'reports' and p_action = 'read' then
    return membership_role in (
      'owner',
      'admin',
      'lawyer',
      'assistant',
      'finance'
    );
  end if;

  if p_module = 'critical_delete' and p_action = 'execute' then
    return membership_role = 'owner'
      or (membership_role = 'admin' and override_allowed);
  end if;

  return false;
end;
$$;

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
  membership_role text;
  membership_scope text;
  overrides jsonb;
  override_allowed boolean;
begin
  if p_record_id is null then
    return false;
  end if;

  select
    membership.role,
    membership.data_scope,
    membership.permission_overrides
  into membership_role, membership_scope, overrides
  from public.tenant_memberships membership
  where membership.user_id = p_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then
    return false;
  end if;

  if membership_role in ('owner', 'admin') then
    return p_module in ('legal', 'finance', 'contracts', 'reports');
  end if;

  if membership_role = 'finance' then
    return p_module in ('finance', 'contracts', 'reports');
  end if;

  override_allowed :=
    lower(coalesce(overrides #>> array[p_module, 'read'], 'false')) = 'true';

  if membership_role in ('lawyer', 'assistant') then
    if p_module in ('legal', 'reports') and membership_scope = 'tenant' then
      return true;
    end if;

    if p_module in ('finance', 'contracts')
      and membership_scope = 'tenant'
      and override_allowed then
      return true;
    end if;

    -- Team and assigned access stays denied until the module has an explicit
    -- assignment mapping. No record ID is trusted by itself.
    return false;
  end if;

  return false;
end;
$$;

revoke all on function private.is_platform_admin(uuid)
  from public, anon, authenticated;
revoke all on function private.is_active_tenant_member(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.tenant_role(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.has_tenant_permission(uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.can_access_tenant_record(
  uuid,
  uuid,
  text,
  uuid
) from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;

grant execute on function private.is_active_tenant_member(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.tenant_role(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.has_tenant_permission(uuid, text, text)
  to authenticated, service_role;
grant execute on function private.can_access_tenant_record(
  uuid,
  uuid,
  text,
  uuid
) to authenticated, service_role;
grant execute on function private.is_platform_admin(uuid)
  to service_role;

comment on function private.can_access_tenant_record(
  uuid,
  uuid,
  text,
  uuid
) is
  'Nega team/assigned até o módulo possuir vínculos de atribuição explícitos.';
