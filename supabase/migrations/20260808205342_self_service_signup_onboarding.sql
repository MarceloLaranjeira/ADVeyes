create table public.tenant_onboarding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  flow_version integer not null default 1 check (flow_version > 0),
  current_step text not null default 'welcome' check (
    current_step in ('welcome', 'oab', 'team', 'complete')
  ),
  office_completed_at timestamptz,
  oab_completed_at timestamptz,
  oab_skipped_at timestamptz,
  team_completed_at timestamptz,
  team_skipped_at timestamptz,
  dismissed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_onboarding_oab_state check (
    oab_completed_at is null or oab_skipped_at is null
  ),
  constraint tenant_onboarding_team_state check (
    team_completed_at is null or team_skipped_at is null
  ),
  constraint tenant_onboarding_completion_valid check (
    completed_at is null
    or (office_completed_at is not null and oab_completed_at is not null)
  )
);

comment on table public.tenant_onboarding is
  'Progresso retomável da primeira experiência de cada escritório.';

create trigger tenant_onboarding_touch_updated_at
before update on public.tenant_onboarding
for each row execute function private.touch_tenant_updated_at();

alter table public.tenant_onboarding enable row level security;

revoke all privileges on table public.tenant_onboarding
  from anon, authenticated;
grant select, update on table public.tenant_onboarding
  to authenticated;
grant all privileges on table public.tenant_onboarding
  to service_role;

create policy tenant_onboarding_read_member
on public.tenant_onboarding
for select
to authenticated
using (
  private.is_active_tenant_member((select auth.uid()), tenant_id)
);

create policy tenant_onboarding_update_manager
on public.tenant_onboarding
for update
to authenticated
using (
  private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin')
)
with check (
  private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin')
);

create table private.tenant_signup_provisioning (
  user_id uuid primary key references auth.users(id) on delete restrict,
  request_id uuid not null unique,
  tenant_id uuid not null unique references public.tenants(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table private.tenant_signup_provisioning is
  'Chave idempotente do único escritório self-service criado por uma identidade.';

revoke all privileges on table private.tenant_signup_provisioning
  from public, anon, authenticated;
grant all privileges on table private.tenant_signup_provisioning
  to service_role;

create or replace function public.provision_self_service_tenant(
  p_user_id uuid,
  p_request_id uuid,
  p_display_name text
)
returns table (
  tenant_id uuid,
  slug text,
  trial_ends_at timestamptz,
  onboarding_step text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  signup_user auth.users%rowtype;
  existing_tenant_id uuid;
  new_tenant_id uuid;
  plan_row public.billing_plans%rowtype;
  normalized_name text;
  base_slug text;
  selected_slug text;
  trial_start timestamptz := now();
  trial_end timestamptz := now() + interval '14 days';
begin
  if p_user_id is null or p_request_id is null then
    raise exception using
      errcode = '22023',
      message = 'signup_identity_required';
  end if;

  normalized_name := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  if length(normalized_name) < 2 or length(normalized_name) > 100 then
    raise exception using
      errcode = '22023',
      message = 'signup_office_name_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select mapping.tenant_id
    into existing_tenant_id
  from private.tenant_signup_provisioning mapping
  where mapping.user_id = p_user_id;

  if existing_tenant_id is not null then
    return query
    select
      tenant.id,
      tenant.slug::text,
      subscription.trial_ends_at,
      onboarding.current_step
    from public.tenants tenant
    join public.tenant_subscriptions subscription
      on subscription.tenant_id = tenant.id
    join public.tenant_onboarding onboarding
      on onboarding.tenant_id = tenant.id
    where tenant.id = existing_tenant_id;
    return;
  end if;

  select auth_user.*
    into signup_user
  from auth.users auth_user
  where auth_user.id = p_user_id;

  if signup_user.id is null then
    raise exception using
      errcode = '22023',
      message = 'signup_user_not_found';
  end if;

  if signup_user.email_confirmed_at is null then
    raise exception using
      errcode = '28000',
      message = 'signup_email_not_confirmed';
  end if;

  if exists (
    select 1
    from public.tenant_memberships membership
    where membership.user_id = p_user_id
      and membership.status in ('invited', 'active', 'suspended')
  ) then
    raise exception using
      errcode = '23505',
      message = 'signup_user_already_linked';
  end if;

  if exists (
    select 1
    from public.tenant_invitations invitation
    where lower(invitation.email::text) = lower(signup_user.email)
      and invitation.status = 'pending'
      and invitation.expires_at > now()
  ) then
    raise exception using
      errcode = '23505',
      message = 'signup_invitation_pending';
  end if;

  select plan.*
    into plan_row
  from public.billing_plans plan
  where plan.code = 'solo'
    and plan.is_active
    and plan.effective_at <= now()
    and plan.retired_at is null
  order by plan.version desc
  limit 1;

  if plan_row.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'signup_trial_plan_unavailable';
  end if;

  base_slug := translate(
    lower(normalized_name),
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'aaaaaaeeeeiiiiooooouuuucnyy'
  );
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if length(base_slug) < 2 then
    base_slug := 'escritorio';
  end if;
  base_slug := left(base_slug, 55);
  if base_slug in (
    'admin', 'api', 'app', 'auth', 'billing', 'help', 'login', 'portal',
    'status', 'support', 'www'
  ) then
    base_slug := base_slug || '-legal';
  end if;

  selected_slug := base_slug;
  if exists (select 1 from public.tenants tenant where tenant.slug = selected_slug) then
    selected_slug := left(base_slug, 55) || '-' || substr(md5(p_request_id::text), 1, 6);
  end if;

  insert into public.tenants (
    legal_name,
    display_name,
    slug,
    status,
    trial_started_at,
    trial_ends_at,
    created_by
  ) values (
    normalized_name,
    normalized_name,
    selected_slug,
    'trialing',
    trial_start,
    trial_end,
    p_user_id
  )
  returning id into new_tenant_id;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    data_scope,
    invited_by,
    activated_at
  ) values (
    new_tenant_id,
    p_user_id,
    'owner',
    'active',
    'tenant',
    p_user_id,
    trial_start
  );

  insert into public.tenant_brand_settings (
    tenant_id,
    public_name,
    short_name,
    color_tokens,
    support_contacts,
    privacy_url,
    terms_url,
    login_config,
    portal_config,
    published_at
  ) values (
    new_tenant_id,
    normalized_name,
    left(normalized_name, 40),
    jsonb_build_object(
      'primary', '#081B48',
      'secondary', '#153B86',
      'action', '#2563EB',
      'accent', '#F59E0B',
      'success', '#16A34A'
    ),
    '{}'::jsonb,
    'https://adveyes.automatikus.com.br/privacidade',
    'https://adveyes.automatikus.com.br/termos',
    jsonb_build_object('show_platform_credit', true),
    jsonb_build_object('enabled', true),
    trial_start
  );

  insert into public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_cycle,
    price_snapshot,
    trial_ends_at,
    created_by
  ) values (
    new_tenant_id,
    plan_row.id,
    'trialing',
    null,
    jsonb_build_object(
      'plan_code', plan_row.code,
      'plan_version', plan_row.version,
      'plan_name', plan_row.name,
      'entitlements', plan_row.entitlements,
      'features', plan_row.features,
      'trial_days', 14
    ),
    trial_end,
    p_user_id
  );

  insert into public.tenant_onboarding (
    tenant_id,
    current_step,
    office_completed_at
  ) values (
    new_tenant_id,
    'oab',
    trial_start
  );

  insert into private.tenant_signup_provisioning (
    user_id,
    request_id,
    tenant_id
  ) values (
    p_user_id,
    p_request_id,
    new_tenant_id
  );

  insert into public.tenant_audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    new_tenant_id,
    p_user_id,
    'tenant.self_service_provisioned',
    'tenant',
    new_tenant_id::text,
    jsonb_build_object(
      'request_id', p_request_id,
      'plan_code', plan_row.code,
      'trial_days', 14
    )
  );

  return query
  select new_tenant_id, selected_slug, trial_end, 'oab'::text;
end;
$$;

revoke all on function public.provision_self_service_tenant(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.provision_self_service_tenant(uuid, uuid, text)
  to service_role;

comment on function public.provision_self_service_tenant(uuid, uuid, text) is
  'Provisiona tenant self-service de forma atômica e idempotente; uso exclusivo do backend.';
