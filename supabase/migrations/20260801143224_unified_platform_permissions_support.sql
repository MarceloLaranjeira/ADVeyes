-- Unified tenant authorization, tri-state member overrides and audited
-- platform support sessions.

begin;

-- The original policy passed the helper arguments in reverse order, making
-- every authenticated tenant member fail the brand settings SELECT.
drop policy if exists tenant_brand_settings_tenant_read
on public.tenant_brand_settings;

create policy tenant_brand_settings_tenant_read
on public.tenant_brand_settings
for select
to authenticated
using (
  private.is_active_tenant_member((select auth.uid()), tenant_id)
  or private.is_platform_admin((select auth.uid()))
);

create table if not exists public.platform_support_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  platform_admin_user_id uuid not null
    references auth.users(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 10 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_support_sessions_window_valid check (
    expires_at > started_at
  ),
  constraint platform_support_sessions_end_valid check (
    ended_at is null or ended_at >= started_at
  )
);

create index if not exists platform_support_sessions_lookup_idx
on public.platform_support_sessions (
  platform_admin_user_id,
  tenant_id,
  expires_at desc
);

alter table public.platform_support_sessions enable row level security;
revoke all on table public.platform_support_sessions
from public, anon, authenticated;
grant all on table public.platform_support_sessions to service_role;

alter table public.equipe
  add column if not exists avatar_url text;

create or replace function private.active_support_session_id(
  p_user_id uuid,
  p_tenant_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select session.id
  from public.platform_support_sessions session
  join public.platform_admins administrator
    on administrator.user_id = session.platform_admin_user_id
    and administrator.is_active
  where session.platform_admin_user_id = p_user_id
    and session.tenant_id = p_tenant_id
    and session.ended_at is null
    and session.expires_at > now()
  order by session.started_at desc
  limit 1;
$$;

create or replace function private.has_active_support_session(
  p_user_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.active_support_session_id(p_user_id, p_tenant_id) is not null;
$$;

-- Platform administrators may resolve tenant-scoped SELECT policies without
-- receiving a fake membership. Mutations still require has_tenant_permission,
-- which demands an active support session.
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
  select private.is_platform_admin(p_user_id) or exists (
    select 1
    from public.tenant_memberships membership
    where membership.user_id = p_user_id
      and membership.tenant_id = p_tenant_id
      and membership.status = 'active'
  );
$$;

-- Every visible permission may be explicitly allowed or denied. Ownership is
-- deliberately immutable and therefore absent from this list.
create or replace function private.allowed_permission_override(
  p_module text,
  p_action text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select (p_module, p_action) in (
    ('brand', 'manage'),
    ('members', 'manage'),
    ('subscription', 'read'),
    ('subscription', 'manage'),
    ('legal', 'read'),
    ('legal', 'create'),
    ('legal', 'update'),
    ('legal', 'delete'),
    ('finance', 'read'),
    ('finance', 'create'),
    ('finance', 'update'),
    ('finance', 'delete'),
    ('contracts', 'read'),
    ('contracts', 'create'),
    ('contracts', 'update'),
    ('contracts', 'delete'),
    ('reports', 'read'),
    ('critical_delete', 'execute')
  );
$$;

create or replace function private.sanitize_permission_overrides(
  p_overrides jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  module_key text;
  action_key text;
  actions jsonb;
  raw_value text;
  normalized_value text;
  result jsonb := '{}'::jsonb;
begin
  if p_overrides is null or jsonb_typeof(p_overrides) <> 'object' then
    return '{}'::jsonb;
  end if;

  for module_key in select jsonb_object_keys(p_overrides) loop
    actions := p_overrides -> module_key;
    continue when jsonb_typeof(actions) <> 'object';

    for action_key in select jsonb_object_keys(actions) loop
      continue when not private.allowed_permission_override(
        module_key,
        action_key
      );

      raw_value := lower(coalesce(actions ->> action_key, ''));
      normalized_value := case
        when raw_value in ('allow', 'true') then 'allow'
        when raw_value = 'deny' then 'deny'
        else null
      end;

      if normalized_value is not null then
        result := jsonb_set(
          result,
          array[module_key, action_key],
          to_jsonb(normalized_value),
          true
        );
      end if;
    end loop;
  end loop;

  return result;
end;
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
  current_user_id uuid := auth.uid();
  membership_role text;
  overrides jsonb;
  override_value text;
  base_allowed boolean := false;
begin
  if current_user_id is null or p_module = 'platform' then
    return false;
  end if;

  if private.is_platform_admin(current_user_id) then
    if p_module = 'ownership' then
      return false;
    end if;
    if p_action = 'read' then
      return true;
    end if;
    return private.has_active_support_session(current_user_id, p_tenant_id);
  end if;

  select membership.role, membership.permission_overrides
  into membership_role, overrides
  from public.tenant_memberships membership
  where membership.user_id = current_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then
    return false;
  end if;

  if membership_role = 'owner' then
    return p_module <> 'platform';
  end if;

  override_value := lower(coalesce(
    overrides #>> array[p_module, p_action],
    case
      when p_action = 'create'
        then overrides #>> array[p_module, 'update']
      else null
    end,
    ''
  ));

  if override_value = 'deny' then
    return false;
  end if;

  if p_module = 'ownership' and p_action = 'transfer' then
    return false;
  elsif p_module = 'subscription' and p_action = 'read' then
    base_allowed := membership_role = 'admin';
  elsif p_module = 'subscription' and p_action = 'manage' then
    base_allowed := false;
  elsif p_module in ('members', 'brand')
    and p_action in ('read', 'manage') then
    base_allowed := membership_role = 'admin';
  elsif p_module = 'legal'
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('admin', 'lawyer', 'assistant');
  elsif p_module = 'legal' and p_action = 'delete' then
    base_allowed := false;
  elsif p_module in ('finance', 'contracts')
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('admin', 'finance');
  elsif p_module in ('finance', 'contracts') and p_action = 'delete' then
    base_allowed := false;
  elsif p_module = 'reports' and p_action = 'read' then
    base_allowed := membership_role in (
      'admin', 'lawyer', 'assistant', 'finance'
    );
  elsif p_module = 'critical_delete' and p_action = 'execute' then
    base_allowed := false;
  end if;

  return base_allowed or override_value in ('allow', 'true');
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
  override_value text;
begin
  if p_record_id is null then
    return false;
  end if;

  if private.is_platform_admin(p_user_id) then
    return p_module in ('legal', 'finance', 'contracts', 'reports');
  end if;

  select membership.role, membership.data_scope, membership.permission_overrides
  into membership_role, membership_scope, overrides
  from public.tenant_memberships membership
  where membership.user_id = p_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then
    return false;
  end if;

  if membership_role = 'owner' then
    return p_module in ('legal', 'finance', 'contracts', 'reports');
  end if;

  override_value := lower(coalesce(
    overrides #>> array[p_module, 'read'],
    ''
  ));
  if override_value = 'deny' then
    return false;
  end if;

  if membership_role = 'admin' then
    return p_module in ('legal', 'finance', 'contracts', 'reports')
      or override_value in ('allow', 'true');
  end if;

  if membership_role = 'finance' then
    return p_module in ('finance', 'contracts', 'reports')
      or override_value in ('allow', 'true');
  end if;

  if membership_role in ('lawyer', 'assistant') then
    if membership_scope <> 'tenant' then
      return false;
    end if;
    return p_module in ('legal', 'reports')
      or override_value in ('allow', 'true');
  end if;

  return false;
end;
$$;

create or replace function public.tenant_set_member_permissions_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_permission_overrides jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  support_session_id uuid;
  target_membership public.tenant_memberships%rowtype;
  previous_overrides jsonb;
  sanitized jsonb;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  support_session_id := private.active_support_session_id(
    p_actor_user_id,
    p_tenant_id
  );

  if actor_role not in ('owner', 'admin') and support_session_id is null then
    raise exception using errcode = '42501', message = 'permission_denied';
  end if;

  select membership.*
  into target_membership
  from public.tenant_memberships membership
  where membership.id = p_membership_id
    and membership.tenant_id = p_tenant_id
  for update;

  if target_membership.id is null then
    raise exception using errcode = 'P0001', message = 'member_not_found';
  end if;
  if target_membership.role = 'owner' then
    raise exception using errcode = '42501', message = 'owner_requires_transfer';
  end if;

  previous_overrides := target_membership.permission_overrides;
  sanitized := private.sanitize_permission_overrides(p_permission_overrides);

  if actor_role <> 'owner'
    and coalesce(sanitized #>> array['subscription', 'manage'], '') = 'allow'
  then
    raise exception using
      errcode = '42501', message = 'owner_required_for_subscription';
  end if;

  update public.tenant_memberships
  set permission_overrides = sanitized, updated_at = now()
  where id = p_membership_id;

  insert into public.tenant_audit_events (
    tenant_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_tenant_id,
    p_actor_user_id,
    'member.update_permissions',
    'tenant_membership',
    p_membership_id::text,
    jsonb_build_object(
      'before', previous_overrides,
      'after', sanitized,
      'support_session_id', support_session_id
    )
  );

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'permission_overrides', sanitized
  );
end;
$$;

create or replace function public.tenant_member_permissions_server(
  p_actor_user_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  actor_role text;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role not in ('owner', 'admin')
    and not private.is_platform_admin(p_actor_user_id)
  then
    raise exception using errcode = '42501', message = 'permission_denied';
  end if;

  return coalesce((
    select jsonb_object_agg(
      membership.id::text,
      private.sanitize_permission_overrides(membership.permission_overrides)
    )
    from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.status <> 'removed'
  ), '{}'::jsonb);
end;
$$;

create or replace function public.tenant_team_overview_server(
  p_actor_user_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  actor_role text;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role not in ('owner', 'admin')
    and not private.is_platform_admin(p_actor_user_id)
  then
    raise exception using errcode = '42501', message = 'permission_denied';
  end if;

  return jsonb_build_object(
    'members',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', professional.id,
          'membership_id', membership.id,
          'user_id', membership.user_id,
          'name', professional.nome,
          'email', professional.email,
          'phone', professional.telefone,
          'job_title', professional.cargo,
          'oab', professional.oab,
          'hourly_rate', professional.valor_hora,
          'monthly_hours_target', professional.meta_horas_mes,
          'avatar_url', professional.avatar_url,
          'active', professional.ativo,
          'role', membership.role,
          'data_scope', membership.data_scope,
          'status', membership.status,
          'team_id', team_member.team_id
        ) order by professional.nome
      )
      from public.equipe professional
      left join public.tenant_memberships membership
        on membership.tenant_id = professional.tenant_id
        and membership.id = professional.membership_id
      left join public.tenant_team_members team_member
        on team_member.tenant_id = membership.tenant_id
        and team_member.membership_id = membership.id
      where professional.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'invitations',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', invitation.id,
          'member_id', invitation.equipe_id,
          'email', invitation.email,
          'role', invitation.role,
          'data_scope', invitation.data_scope,
          'team_id', invitation.team_id,
          'status', invitation.status,
          'expires_at', invitation.expires_at,
          'created_at', invitation.created_at
        ) order by invitation.created_at desc
      )
      from public.tenant_invitations invitation
      where invitation.tenant_id = p_tenant_id
        and invitation.status = 'pending'
    ), '[]'::jsonb),
    'teams',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', team.id,
          'name', team.name,
          'description', team.description,
          'active', team.is_active
        ) order by team.name
      )
      from public.tenant_teams team
      where team.tenant_id = p_tenant_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.tenant_update_member_profile_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  target_membership public.tenant_memberships%rowtype;
  support_session_id uuid;
  professional public.equipe%rowtype;
  profile_name text;
  profile_email text;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  support_session_id := private.active_support_session_id(
    p_actor_user_id,
    p_tenant_id
  );

  select membership.* into target_membership
  from public.tenant_memberships membership
  where membership.id = p_membership_id
    and membership.tenant_id = p_tenant_id
  for update;

  if target_membership.id is null then
    raise exception using errcode = 'P0001', message = 'member_not_found';
  end if;

  if target_membership.user_id <> p_actor_user_id then
    if support_session_id is null and actor_role not in ('owner', 'admin') then
      raise exception using errcode = '42501', message = 'permission_denied';
    end if;
    if target_membership.role = 'owner' and actor_role <> 'owner' then
      raise exception using errcode = '42501', message = 'owner_requires_transfer';
    end if;
  end if;

  select profile.* into professional
  from public.equipe profile
  where profile.tenant_id = p_tenant_id
    and profile.membership_id = p_membership_id
  for update;

  if professional.id is null then
    raise exception using errcode = 'P0001', message = 'member_not_found';
  end if;

  profile_name := btrim(coalesce(p_profile ->> 'name', ''));
  profile_email := lower(btrim(coalesce(p_profile ->> 'email', '')));
  if length(profile_name) < 2 or length(profile_name) > 140
    or position('@' in profile_email) < 2
  then
    raise exception using errcode = '22023', message = 'invalid_profile';
  end if;

  update public.equipe
  set
    nome = profile_name,
    email = profile_email,
    telefone = nullif(btrim(p_profile ->> 'phone'), ''),
    cargo = left(coalesce(nullif(btrim(p_profile ->> 'jobTitle'), ''), cargo), 100),
    oab = nullif(btrim(p_profile ->> 'oab'), ''),
    avatar_url = case
      when p_profile ? 'avatarUrl' then nullif(btrim(p_profile ->> 'avatarUrl'), '')
      else avatar_url
    end,
    updated_at = now()
  where id = professional.id;

  insert into public.tenant_audit_events (
    tenant_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_tenant_id,
    p_actor_user_id,
    'member.update_profile',
    'equipe',
    professional.id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'name', professional.nome,
        'email', professional.email,
        'phone', professional.telefone,
        'jobTitle', professional.cargo,
        'oab', professional.oab,
        'avatarUrl', professional.avatar_url
      ),
      'support_session_id', support_session_id
    )
  );

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'name', profile_name,
    'email', profile_email
  );
end;
$$;

revoke all on function private.active_support_session_id(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.has_active_support_session(uuid, uuid)
from public, anon, authenticated;
grant execute on function private.active_support_session_id(uuid, uuid)
to service_role;
grant execute on function private.has_active_support_session(uuid, uuid)
to authenticated, service_role;
grant execute on function private.is_active_tenant_member(uuid, uuid)
to authenticated, service_role;

revoke all on function private.allowed_permission_override(text, text)
from public, anon, authenticated;
revoke all on function private.sanitize_permission_overrides(jsonb)
from public, anon, authenticated;
grant execute on function private.sanitize_permission_overrides(jsonb)
to service_role;

revoke all on function public.tenant_set_member_permissions_server(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.tenant_set_member_permissions_server(
  uuid, uuid, uuid, jsonb
) to service_role;

revoke all on function public.tenant_member_permissions_server(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.tenant_member_permissions_server(uuid, uuid)
to service_role;

revoke all on function public.tenant_team_overview_server(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.tenant_team_overview_server(uuid, uuid)
to service_role;

revoke all on function public.tenant_update_member_profile_server(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.tenant_update_member_profile_server(
  uuid, uuid, uuid, jsonb
) to service_role;

comment on table public.platform_support_sessions is
  'Sessões temporárias e auditáveis para suporte da Conta Geral em um escritório.';
comment on function private.sanitize_permission_overrides(jsonb) is
  'Normaliza exceções tri-state: inherit ausente, allow ou deny.';

commit;
