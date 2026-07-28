create or replace function private.seed_albertino_tenant()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  owner_ids uuid[];
  lawyer_primary_ids uuid[];
  lawyer_secondary_ids uuid[];
  owner_id uuid;
  lawyer_primary_id uuid;
  lawyer_secondary_id uuid;
  albertino_tenant_id uuid;
begin
  select array_agg(id) into owner_ids
  from auth.users
  where lower(email) = 'marcelolaranjeira33@gmail.com';

  if coalesce(cardinality(owner_ids), 0) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Albertino seed requires exactly one owner user: '
        || 'marcelolaranjeira33@gmail.com';
  end if;

  select array_agg(id) into lawyer_primary_ids
  from auth.users
  where lower(email) = 'grazielleag@hotmail.com';

  if coalesce(cardinality(lawyer_primary_ids), 0) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Albertino seed requires exactly one user: '
        || 'grazielleag@hotmail.com';
  end if;

  select array_agg(id) into lawyer_secondary_ids
  from auth.users
  where lower(email) = 'grazielle0705@gmail.com';

  if coalesce(cardinality(lawyer_secondary_ids), 0) <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Albertino seed requires exactly one user: '
        || 'grazielle0705@gmail.com';
  end if;

  owner_id := owner_ids[1];
  lawyer_primary_id := lawyer_primary_ids[1];
  lawyer_secondary_id := lawyer_secondary_ids[1];

  insert into public.platform_admins (user_id, is_active, granted_by)
  values (owner_id, true, owner_id)
  on conflict (user_id) do update
  set is_active = true, updated_at = now();

  insert into public.tenants (
    legal_name,
    display_name,
    slug,
    status,
    created_by
  ) values (
    'Albertino Advogados Associados',
    'Albertino Advogados Associados',
    'albertino',
    'active',
    owner_id
  )
  on conflict (slug) do nothing
  returning id into albertino_tenant_id;

  if albertino_tenant_id is null then
    select id into strict albertino_tenant_id
    from public.tenants
    where slug = 'albertino';
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    data_scope,
    invited_by,
    activated_at
  ) values
    (
      albertino_tenant_id,
      owner_id,
      'owner',
      'active',
      'tenant',
      owner_id,
      now()
    ),
    (
      albertino_tenant_id,
      lawyer_primary_id,
      'lawyer',
      'active',
      'assigned',
      owner_id,
      now()
    ),
    (
      albertino_tenant_id,
      lawyer_secondary_id,
      'lawyer',
      'active',
      'assigned',
      owner_id,
      now()
    )
  on conflict (tenant_id, user_id) do update
  set
    role = excluded.role,
    status = excluded.status,
    data_scope = excluded.data_scope,
    invited_by = excluded.invited_by,
    activated_at = coalesce(
      public.tenant_memberships.activated_at,
      excluded.activated_at
    ),
    suspended_at = null,
    removed_at = null,
    updated_at = now();

  insert into public.tenant_brand_settings (
    tenant_id,
    public_name,
    short_name,
    color_tokens,
    support_contacts,
    email_footer,
    document_footer,
    privacy_url,
    terms_url,
    login_config,
    portal_config,
    published_at
  ) values (
    albertino_tenant_id,
    'Albertino Advogados Associados',
    'Albertino',
    jsonb_build_object(
      'primary', '#1A2A5E',
      'accent', '#C8960C'
    ),
    jsonb_build_object(
      'email', 'marcelolaranjeira33@gmail.com'
    ),
    'Albertino Advogados Associados',
    'Albertino Advogados Associados',
    'https://adveyes.automatikus.com.br/privacidade',
    'https://adveyes.automatikus.com.br/termos',
    jsonb_build_object('show_platform_credit', false),
    jsonb_build_object('enabled', true),
    now()
  )
  on conflict (tenant_id) do update
  set
    public_name = excluded.public_name,
    short_name = excluded.short_name,
    color_tokens = excluded.color_tokens,
    support_contacts = excluded.support_contacts,
    email_footer = excluded.email_footer,
    document_footer = excluded.document_footer,
    privacy_url = excluded.privacy_url,
    terms_url = excluded.terms_url,
    login_config = excluded.login_config,
    portal_config = excluded.portal_config,
    published_at = excluded.published_at,
    updated_at = now();

  if not exists (
    select 1
    from public.tenant_audit_events
    where tenant_id = albertino_tenant_id
      and action = 'tenant.migrated'
      and metadata ->> 'migration_key' =
        '20260728225444_seed_albertino_tenant'
  ) then
    insert into public.tenant_audit_events (
      tenant_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      albertino_tenant_id,
      owner_id,
      'tenant.migrated',
      'tenant',
      albertino_tenant_id::text,
      jsonb_build_object(
        'migration_key',
        '20260728225444_seed_albertino_tenant',
        'source',
        'single_user_legacy'
      )
    );
  end if;

  return albertino_tenant_id;
end;
$$;

revoke execute on function private.seed_albertino_tenant()
  from public, anon, authenticated;
grant execute on function private.seed_albertino_tenant()
  to service_role;

do $$
begin
  -- A fresh local reset has no imported Auth users yet. The local importer
  -- invokes this function after restoring them. Production already has users,
  -- so a missing required account aborts the migration.
  if exists (select 1 from auth.users) then
    perform private.seed_albertino_tenant();
  end if;
end;
$$;
