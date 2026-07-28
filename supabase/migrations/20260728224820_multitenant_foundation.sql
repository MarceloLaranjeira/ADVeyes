create extension if not exists citext with schema extensions;

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  legal_name text not null check (length(btrim(legal_name)) between 2 and 180),
  display_name text not null check (
    length(btrim(display_name)) between 2 and 100
  ),
  slug extensions.citext not null unique check (
    slug::text = lower(slug::text)
    and slug::text ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
    and slug::text not in (
      'admin',
      'api',
      'app',
      'auth',
      'billing',
      'help',
      'login',
      'portal',
      'status',
      'support',
      'www'
    )
  ),
  status text not null default 'trialing' check (
    status in (
      'trialing',
      'active',
      'past_due',
      'suspended',
      'canceled',
      'archived'
    )
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  suspended_at timestamptz,
  canceled_at timestamptz,
  retention_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_trial_window_valid check (
    trial_started_at is null
    or trial_ends_at is null
    or trial_ends_at > trial_started_at
  )
);

create table public.tenant_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in ('owner', 'admin', 'lawyer', 'assistant', 'finance')
  ),
  status text not null default 'invited' check (
    status in ('invited', 'active', 'suspended', 'removed')
  ),
  data_scope text not null default 'assigned' check (
    data_scope in ('tenant', 'team', 'assigned')
  ),
  permission_overrides jsonb not null default '{}'::jsonb check (
    jsonb_typeof(permission_overrides) = 'object'
  ),
  invited_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  suspended_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id),
  constraint tenant_memberships_state_dates check (
    (status <> 'active' or activated_at is not null)
    and (status <> 'suspended' or suspended_at is not null)
    and (status <> 'removed' or removed_at is not null)
  )
);

create table public.tenant_teams (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 100),
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, name)
);

create table public.tenant_team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  team_id uuid not null,
  membership_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, membership_id),
  foreign key (tenant_id, team_id)
    references public.tenant_teams(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete cascade
);

create table public.tenant_brand_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  public_name text,
  short_name text,
  logo_light_path text,
  logo_dark_path text,
  favicon_path text,
  icon_path text,
  color_tokens jsonb not null default '{}'::jsonb check (
    jsonb_typeof(color_tokens) = 'object'
  ),
  support_contacts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(support_contacts) = 'object'
  ),
  email_footer text,
  document_footer text,
  email_signature text,
  privacy_url text,
  terms_url text,
  login_config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(login_config) = 'object'
  ),
  portal_config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(portal_config) = 'object'
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email extensions.citext not null,
  role text not null check (
    role in ('owner', 'admin', 'lawyer', 'assistant', 'finance')
  ),
  data_scope text not null default 'assigned' check (
    data_scope in ('tenant', 'team', 'assigned')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'revoked', 'expired')
  ),
  token_hash text not null unique check (length(token_hash) >= 32),
  membership_id uuid,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete set null (membership_id),
  constraint tenant_invitations_expiry_valid check (expires_at > created_at),
  constraint tenant_invitations_state_dates check (
    (status <> 'accepted' or accepted_at is not null)
    and (status <> 'revoked' or revoked_at is not null)
  )
);

create unique index tenant_invitations_pending_email_key
  on public.tenant_invitations (tenant_id, email)
  where status = 'pending';

create table public.tenant_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) between 2 and 120),
  target_type text check (
    target_type is null or length(btrim(target_type)) between 2 and 80
  ),
  target_id text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  occurred_at timestamptz not null default now()
);

create table public.tenant_admin_overrides (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  override_key text not null check (
    length(btrim(override_key)) between 2 and 100
  ),
  override_value jsonb not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_admin_overrides_window_valid check (
    valid_until > valid_from
  ),
  constraint tenant_admin_overrides_revocation_valid check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create index tenant_memberships_user_status_idx
  on public.tenant_memberships (user_id, status, tenant_id);
create index tenant_memberships_tenant_role_status_idx
  on public.tenant_memberships (tenant_id, role, status);
create index tenant_teams_tenant_active_idx
  on public.tenant_teams (tenant_id, is_active);
create index tenant_team_members_membership_idx
  on public.tenant_team_members (tenant_id, membership_id);
create index tenant_invitations_tenant_status_idx
  on public.tenant_invitations (tenant_id, status, expires_at);
create index tenant_audit_events_tenant_time_idx
  on public.tenant_audit_events (tenant_id, occurred_at desc);
create index tenant_admin_overrides_active_idx
  on public.tenant_admin_overrides (tenant_id, override_key, valid_until)
  where revoked_at is null;

create or replace function private.touch_tenant_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.touch_tenant_updated_at()
  from public, anon, authenticated;

create or replace function private.protect_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  loses_active_ownership boolean;
begin
  if tg_op = 'DELETE' then
    loses_active_ownership := old.role = 'owner' and old.status = 'active';
  else
    loses_active_ownership :=
      old.role = 'owner'
      and old.status = 'active'
      and (new.role <> 'owner' or new.status <> 'active');
  end if;

  if loses_active_ownership and not exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = old.tenant_id
      and membership.id <> old.id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'tenant must retain at least one active owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_last_active_owner()
  from public, anon, authenticated;

create trigger tenants_touch_updated_at
before update on public.tenants
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_memberships_touch_updated_at
before update on public.tenant_memberships
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_teams_touch_updated_at
before update on public.tenant_teams
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_brand_settings_touch_updated_at
before update on public.tenant_brand_settings
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_invitations_touch_updated_at
before update on public.tenant_invitations
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_admin_overrides_touch_updated_at
before update on public.tenant_admin_overrides
for each row execute function private.touch_tenant_updated_at();

create trigger tenant_memberships_protect_last_owner
before update of role, status or delete on public.tenant_memberships
for each row execute function private.protect_last_active_owner();

alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_teams enable row level security;
alter table public.tenant_team_members enable row level security;
alter table public.tenant_brand_settings enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_audit_events enable row level security;
alter table public.tenant_admin_overrides enable row level security;

revoke all privileges
  on table
    public.platform_admins,
    public.tenants,
    public.tenant_memberships,
    public.tenant_teams,
    public.tenant_team_members,
    public.tenant_brand_settings,
    public.tenant_invitations,
    public.tenant_audit_events,
    public.tenant_admin_overrides
  from anon, authenticated;

grant all privileges
  on table
    public.platform_admins,
    public.tenants,
    public.tenant_memberships,
    public.tenant_teams,
    public.tenant_team_members,
    public.tenant_brand_settings,
    public.tenant_invitations,
    public.tenant_audit_events,
    public.tenant_admin_overrides
  to service_role;

comment on table public.tenants is
  'Escritórios isolados do ADVeyes; autorização exige membership ativa.';
comment on table public.tenant_memberships is
  'Papel, estado e escopo de uma pessoa dentro de um escritório.';
comment on table public.tenant_audit_events is
  'Log append-only de ações administrativas por tenant.';
