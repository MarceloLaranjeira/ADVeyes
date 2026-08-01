-- Exceções de permissão por membro, editáveis pelo escritório.
-- A matriz base por perfil continua definida no banco. O que passa a ser
-- editável são as liberações pontuais que `private.has_tenant_permission` já
-- consultava em `permission_overrides`, mas que nenhuma tela conseguia gravar.

begin;

-- Somente as combinações que a matriz base realmente honra podem ser
-- liberadas. Qualquer outra chave é descartada, para a tela nunca prometer
-- um acesso que o banco ignoraria.
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
    ('subscription', 'read'),
    ('subscription', 'manage'),
    ('legal', 'delete'),
    ('finance', 'read'),
    ('finance', 'create'),
    ('finance', 'update'),
    ('finance', 'delete'),
    ('contracts', 'read'),
    ('contracts', 'create'),
    ('contracts', 'update'),
    ('contracts', 'delete'),
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
  result jsonb := '{}'::jsonb;
begin
  if p_overrides is null or jsonb_typeof(p_overrides) <> 'object' then
    return '{}'::jsonb;
  end if;

  for module_key in select jsonb_object_keys(p_overrides) loop
    actions := p_overrides -> module_key;
    continue when jsonb_typeof(actions) <> 'object';

    for action_key in select jsonb_object_keys(actions) loop
      if private.allowed_permission_override(module_key, action_key)
        and lower(coalesce(actions ->> action_key, 'false')) = 'true'
      then
        result := jsonb_set(
          result,
          array[module_key, action_key],
          'true'::jsonb,
          true
        );
      end if;
    end loop;
  end loop;

  return result;
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
  target_membership public.tenant_memberships%rowtype;
  sanitized jsonb;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'permission_denied';
  end if;

  select membership.*
  into target_membership
  from public.tenant_memberships membership
  where membership.id = p_membership_id
    and membership.tenant_id = p_tenant_id
  for update;

  if target_membership.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'member_not_found';
  end if;

  -- O proprietário já tem acesso total; exceções não se aplicam a ele.
  if target_membership.role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'owner_requires_transfer';
  end if;

  sanitized := private.sanitize_permission_overrides(p_permission_overrides);

  -- Liberar a gestão da assinatura é decisão de quem é dono do escritório.
  if actor_role <> 'owner'
    and coalesce(sanitized #>> array['subscription', 'manage'], 'false') = 'true'
  then
    raise exception using
      errcode = '42501',
      message = 'owner_required_for_subscription';
  end if;

  update public.tenant_memberships
  set permission_overrides = sanitized, updated_at = now()
  where id = p_membership_id;

  insert into public.tenant_audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    p_tenant_id,
    p_actor_user_id,
    'member.update_permissions',
    'tenant_membership',
    p_membership_id::text,
    jsonb_build_object('overrides', sanitized)
  );

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'permission_overrides', sanitized
  );
end;
$$;

-- Leitura das exceções vigentes, para a tela mostrar o estado real.
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

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'permission_denied';
  end if;

  return coalesce((
    select jsonb_object_agg(
      membership.id::text,
      membership.permission_overrides
    )
    from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.status <> 'removed'
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.tenant_member_permissions_server(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.tenant_member_permissions_server(uuid, uuid)
to service_role;

revoke all on function private.allowed_permission_override(text, text)
from public, anon, authenticated;
revoke all on function private.sanitize_permission_overrides(jsonb)
from public, anon, authenticated;
revoke all on function public.tenant_set_member_permissions_server(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.tenant_set_member_permissions_server(
  uuid, uuid, uuid, jsonb
) to service_role;

comment on function private.sanitize_permission_overrides(jsonb) is
  'Mantém apenas exceções que a matriz base honra; o resto é descartado.';

commit;
