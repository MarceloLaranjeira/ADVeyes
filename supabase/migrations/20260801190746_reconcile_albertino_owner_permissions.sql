-- Albertino is a family-owned tenant. The original seed classified Grazielle's
-- two login identities as lawyers, although both represent the tenant owner.
-- Reconcile the three known owner identities without granting anything to
-- users from other tenants.

begin;

do $$
declare
  albertino_tenant_id uuid;
  affected integer;
begin
  select tenant.id
  into strict albertino_tenant_id
  from public.tenants tenant
  where tenant.slug = 'albertino';

  update public.tenant_memberships membership
  set
    role = 'owner',
    status = 'active',
    data_scope = 'tenant',
    permission_overrides = '{}'::jsonb,
    suspended_at = null,
    removed_at = null,
    activated_at = coalesce(membership.activated_at, now()),
    updated_at = now()
  from auth.users account
  where membership.tenant_id = albertino_tenant_id
    and membership.user_id = account.id
    and lower(account.email) in (
      'marcelolaranjeira33@gmail.com',
      'grazielleag@hotmail.com',
      'grazielle0705@gmail.com'
    );

  get diagnostics affected = row_count;
  if affected <> 3 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected three Albertino owner memberships, updated %s',
        affected
      );
  end if;

  insert into public.tenant_audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  select
    albertino_tenant_id,
    null,
    'membership.owner_reconciled',
    'tenant_membership',
    membership.id::text,
    jsonb_build_object(
      'email', lower(account.email),
      'role', 'owner',
      'source', 'controlled_migration'
    )
  from public.tenant_memberships membership
  join auth.users account on account.id = membership.user_id
  where membership.tenant_id = albertino_tenant_id
    and lower(account.email) in (
      'marcelolaranjeira33@gmail.com',
      'grazielleag@hotmail.com',
      'grazielle0705@gmail.com'
    );
end;
$$;

commit;
