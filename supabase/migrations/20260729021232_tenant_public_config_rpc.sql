create or replace function public.resolve_tenant_public_config(
  p_hostname text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  normalized_host text;
  resolved_slug text;
  tenant_row record;
begin
  normalized_host := lower(trim(trailing '.' from trim(p_hostname)));

  if normalized_host in (
    'localhost',
    '127.0.0.1',
    'adveyes.automatikus.com.br'
  ) then
    return jsonb_build_object(
      'hostname', normalized_host,
      'mode', 'central',
      'available', true,
      'slug', null,
      'branding', jsonb_build_object(
        'publicName', 'ADVeyes',
        'shortName', 'ADVeyes',
        'logoLightPath', null,
        'logoDarkPath', null,
        'faviconPath', null,
        'iconPath', null,
        'colorTokens', '{}'::jsonb,
        'privacyUrl', '/privacidade',
        'termsUrl', '/termos'
      )
    );
  end if;

  if normalized_host !~
    '^[a-z0-9]+(?:-[a-z0-9]+)*[.]adveyes[.]automatikus[.]com[.]br$'
  then
    return jsonb_build_object(
      'hostname', normalized_host,
      'mode', 'invalid',
      'available', false,
      'slug', null,
      'branding', null
    );
  end if;

  resolved_slug := split_part(normalized_host, '.', 1);

  select
    tenant.slug::text as slug,
    tenant.status,
    tenant.display_name,
    brand.public_name,
    brand.short_name,
    brand.logo_light_path,
    brand.logo_dark_path,
    brand.favicon_path,
    brand.icon_path,
    brand.color_tokens,
    brand.privacy_url,
    brand.terms_url
  into tenant_row
  from public.tenants tenant
  left join public.tenant_brand_settings brand
    on brand.tenant_id = tenant.id
    and brand.published_at is not null
  where tenant.slug = resolved_slug::extensions.citext
  limit 1;

  if tenant_row.slug is null
    or tenant_row.status not in ('active', 'trialing') then
    return jsonb_build_object(
      'hostname', normalized_host,
      'mode', 'tenant',
      'available', false,
      'slug', resolved_slug,
      'branding', null
    );
  end if;

  return jsonb_build_object(
    'hostname', normalized_host,
    'mode', 'tenant',
    'available', true,
    'slug', tenant_row.slug,
    'branding', jsonb_build_object(
      'publicName', coalesce(
        tenant_row.public_name,
        tenant_row.display_name,
        'ADVeyes'
      ),
      'shortName', coalesce(
        tenant_row.short_name,
        tenant_row.public_name,
        tenant_row.display_name,
        'ADVeyes'
      ),
      'logoLightPath', tenant_row.logo_light_path,
      'logoDarkPath', tenant_row.logo_dark_path,
      'faviconPath', tenant_row.favicon_path,
      'iconPath', tenant_row.icon_path,
      'colorTokens', coalesce(
        tenant_row.color_tokens,
        '{}'::jsonb
      ),
      'privacyUrl', coalesce(
        tenant_row.privacy_url,
        '/privacidade'
      ),
      'termsUrl', coalesce(
        tenant_row.terms_url,
        '/termos'
      )
    )
  );
exception
  when invalid_text_representation then
    return jsonb_build_object(
      'hostname', normalized_host,
      'mode', 'invalid',
      'available', false,
      'slug', null,
      'branding', null
    );
end;
$$;

revoke all on function public.resolve_tenant_public_config(text)
  from public;
grant execute on function public.resolve_tenant_public_config(text)
  to anon, authenticated, service_role;

comment on function public.resolve_tenant_public_config(text) is
  'Resolve somente marca pública e disponibilidade a partir de hostname permitido.';
