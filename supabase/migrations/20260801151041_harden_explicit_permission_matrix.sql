begin;

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
  current_user_id uuid := auth.uid();
  membership_role text;
  overrides jsonb;
  override_value text;
  base_allowed boolean := false;
  known_permission boolean;
begin
  known_permission := (p_module, p_action) in (
    ('ownership', 'transfer'),
    ('subscription', 'read'), ('subscription', 'manage'),
    ('members', 'read'), ('members', 'manage'),
    ('brand', 'read'), ('brand', 'manage'),
    ('legal', 'read'), ('legal', 'create'), ('legal', 'update'),
    ('legal', 'delete'),
    ('finance', 'read'), ('finance', 'create'), ('finance', 'update'),
    ('finance', 'delete'),
    ('contracts', 'read'), ('contracts', 'create'), ('contracts', 'update'),
    ('contracts', 'delete'),
    ('reports', 'read'),
    ('critical_delete', 'execute')
  );

  if current_user_id is null or not known_permission then
    return false;
  end if;

  if private.is_platform_admin(current_user_id) then
    if p_module = 'ownership' then return false; end if;
    if p_action = 'read' then return true; end if;
    return private.has_active_support_session(current_user_id, p_tenant_id);
  end if;

  select membership.role, membership.permission_overrides
  into membership_role, overrides
  from public.tenant_memberships membership
  where membership.user_id = current_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then return false; end if;

  if p_module = 'ownership' and p_action = 'transfer' then
    return membership_role = 'owner';
  end if;

  override_value := lower(coalesce(
    overrides #>> array[p_module, p_action],
    case when p_action = 'create'
      then overrides #>> array[p_module, 'update']
      else null
    end,
    ''
  ));

  -- The owner is governed only by the explicit matrix and cannot be denied by
  -- an accidental/stale per-member override.
  if membership_role <> 'owner' and override_value = 'deny' then
    return false;
  end if;

  if p_module = 'subscription' and p_action = 'read' then
    base_allowed := membership_role in ('owner', 'admin');
  elsif p_module = 'subscription' and p_action = 'manage' then
    base_allowed := membership_role = 'owner';
  elsif p_module in ('members', 'brand')
    and p_action in ('read', 'manage') then
    base_allowed := membership_role in ('owner', 'admin');
  elsif p_module = 'legal'
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('owner', 'admin', 'lawyer', 'assistant');
  elsif p_module = 'legal' and p_action = 'delete' then
    base_allowed := membership_role = 'owner';
  elsif p_module in ('finance', 'contracts')
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('owner', 'admin', 'finance');
  elsif p_module in ('finance', 'contracts') and p_action = 'delete' then
    base_allowed := membership_role = 'owner';
  elsif p_module = 'reports' and p_action = 'read' then
    base_allowed := membership_role in (
      'owner', 'admin', 'lawyer', 'assistant', 'finance'
    );
  elsif p_module = 'critical_delete' and p_action = 'execute' then
    base_allowed := membership_role = 'owner';
  end if;

  return base_allowed
    or (membership_role <> 'owner' and override_value in ('allow', 'true'));
end;
$$;

revoke all on function private.has_tenant_permission(uuid, text, text)
from public, anon;
grant execute on function private.has_tenant_permission(uuid, text, text)
to authenticated, service_role;

commit;
