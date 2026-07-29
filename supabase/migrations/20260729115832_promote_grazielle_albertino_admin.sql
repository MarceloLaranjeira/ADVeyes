do $$
declare
  affected_rows integer;
begin
  update public.tenant_memberships tm
  set
    role = 'admin',
    data_scope = 'tenant',
    status = 'active',
    activated_at = coalesce(tm.activated_at, now()),
    suspended_at = null,
    removed_at = null,
    updated_at = now()
  from auth.users u, public.tenants t
  where tm.user_id = u.id
    and tm.tenant_id = t.id
    and lower(u.email) = 'grazielle0705@gmail.com'
    and t.slug = 'albertino';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Expected one Albertino membership for Grazielle, updated %s',
        affected_rows
      );
  end if;
end;
$$;
