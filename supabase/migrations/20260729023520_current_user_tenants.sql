create or replace function public.current_user_tenants()
returns table (
  tenant_id uuid,
  slug text,
  display_name text,
  status text,
  membership_role text,
  data_scope text,
  public_name text,
  short_name text,
  logo_light_path text,
  logo_dark_path text,
  favicon_path text,
  icon_path text,
  color_tokens jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise insufficient_privilege
      using message = 'Authentication required';
  end if;

  return query
  select
    tenant.id,
    tenant.slug::text,
    tenant.display_name,
    tenant.status,
    membership.role,
    membership.data_scope,
    coalesce(brand.public_name, tenant.display_name),
    coalesce(brand.short_name, brand.public_name, tenant.display_name),
    brand.logo_light_path,
    brand.logo_dark_path,
    brand.favicon_path,
    brand.icon_path,
    coalesce(brand.color_tokens, '{}'::jsonb)
  from public.tenant_memberships membership
  join public.tenants tenant
    on tenant.id = membership.tenant_id
  left join public.tenant_brand_settings brand
    on brand.tenant_id = tenant.id
    and brand.published_at is not null
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and tenant.status in ('active', 'trialing')
  order by tenant.display_name, tenant.id;
end;
$$;

revoke all on function public.current_user_tenants()
  from public, anon;
grant execute on function public.current_user_tenants()
  to authenticated, service_role;

comment on function public.current_user_tenants() is
  'Lista somente memberships ativas e marca pública do usuário autenticado.';
