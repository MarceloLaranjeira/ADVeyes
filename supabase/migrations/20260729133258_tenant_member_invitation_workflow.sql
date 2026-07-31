alter table public.equipe
  add column membership_id uuid;

alter table public.equipe
  add constraint equipe_tenant_id_id_key unique (tenant_id, id);

alter table public.equipe
  add constraint equipe_membership_fk
  foreign key (tenant_id, membership_id)
  references public.tenant_memberships(tenant_id, id)
  on delete set null (membership_id);

create unique index equipe_tenant_membership_key
  on public.equipe (tenant_id, membership_id)
  where membership_id is not null;

create unique index equipe_tenant_email_key
  on public.equipe (tenant_id, lower(email))
  where email is not null and btrim(email) <> '';

-- Link existing professional profiles only when tenant + e-mail identifies
-- exactly one membership. Ambiguous or account-less profiles stay preserved.
with exact_membership as (
  select
    professional.id as equipe_id,
    professional.tenant_id,
    (array_agg(membership.id))[1] as membership_id
  from public.equipe professional
  join auth.users account
    on lower(account.email) = lower(professional.email)
  join public.tenant_memberships membership
    on membership.tenant_id = professional.tenant_id
    and membership.user_id = account.id
  where professional.membership_id is null
  group by professional.id, professional.tenant_id
  having count(*) = 1
)
update public.equipe professional
set membership_id = exact_membership.membership_id,
    ativo = exists (
      select 1
      from public.tenant_memberships membership
      where membership.id = exact_membership.membership_id
        and membership.status = 'active'
    ),
    updated_at = now()
from exact_membership
where professional.id = exact_membership.equipe_id
  and professional.tenant_id = exact_membership.tenant_id;

alter table public.tenant_invitations
  add column equipe_id uuid,
  add column team_id uuid;

alter table public.tenant_invitations
  add constraint tenant_invitations_equipe_fk
  foreign key (tenant_id, equipe_id)
  references public.equipe(tenant_id, id)
  on delete set null (equipe_id);

alter table public.tenant_invitations
  add constraint tenant_invitations_team_fk
  foreign key (tenant_id, team_id)
  references public.tenant_teams(tenant_id, id)
  on delete set null (team_id);

create or replace function public.tenant_invite_member_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_profile jsonb,
  p_role text,
  p_data_scope text,
  p_team_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  normalized_email text;
  professional_id uuid;
  invitation_id uuid;
  tenant_name text;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'permission_denied';
  end if;

  if p_role not in ('admin', 'lawyer', 'assistant', 'finance') then
    raise exception using
      errcode = '22023',
      message = 'invalid_role';
  end if;

  if p_data_scope not in ('tenant', 'team', 'assigned') then
    raise exception using
      errcode = '22023',
      message = 'invalid_data_scope';
  end if;

  if p_data_scope = 'team' and p_team_id is null then
    raise exception using
      errcode = '22023',
      message = 'team_required';
  end if;

  if p_data_scope <> 'team' then
    p_team_id := null;
  elsif not exists (
    select 1
    from public.tenant_teams team
    where team.id = p_team_id
      and team.tenant_id = p_tenant_id
      and team.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_team';
  end if;

  normalized_email := lower(btrim(coalesce(p_profile ->> 'email', '')));

  if normalized_email = ''
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_email';
  end if;

  if length(coalesce(p_token_hash, '')) <> 64
    or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'invalid_token_hash';
  end if;

  if p_expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'invalid_expiration';
  end if;

  if exists (
    select 1
    from public.tenant_memberships membership
    join auth.users account on account.id = membership.user_id
    where membership.tenant_id = p_tenant_id
      and membership.status = 'active'
      and lower(account.email) = normalized_email
  ) then
    raise exception using
      errcode = '23505',
      message = 'member_already_active';
  end if;

  insert into public.equipe (
    tenant_id,
    user_id,
    nome,
    email,
    telefone,
    cargo,
    oab,
    valor_hora,
    meta_horas_mes,
    ativo
  ) values (
    p_tenant_id,
    p_actor_user_id,
    btrim(coalesce(p_profile ->> 'name', '')),
    normalized_email,
    nullif(btrim(coalesce(p_profile ->> 'phone', '')), ''),
    coalesce(nullif(btrim(p_profile ->> 'jobTitle'), ''), 'advogado'),
    nullif(btrim(coalesce(p_profile ->> 'oab', '')), ''),
    nullif(p_profile ->> 'hourlyRate', '')::numeric,
    coalesce(nullif(p_profile ->> 'monthlyHoursTarget', '')::numeric, 160),
    true
  )
  on conflict (tenant_id, lower(email))
    where email is not null and btrim(email) <> ''
  do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    cargo = excluded.cargo,
    oab = excluded.oab,
    valor_hora = excluded.valor_hora,
    meta_horas_mes = excluded.meta_horas_mes,
    ativo = true,
    updated_at = now()
  returning id into professional_id;

  update public.tenant_invitations invitation
  set
    status = 'revoked',
    revoked_at = now(),
    updated_at = now()
  where invitation.tenant_id = p_tenant_id
    and lower(invitation.email::text) = normalized_email
    and invitation.status = 'pending';

  insert into public.tenant_invitations (
    tenant_id,
    email,
    role,
    data_scope,
    status,
    token_hash,
    equipe_id,
    team_id,
    invited_by,
    expires_at
  ) values (
    p_tenant_id,
    normalized_email,
    p_role,
    p_data_scope,
    'pending',
    p_token_hash,
    professional_id,
    p_team_id,
    p_actor_user_id,
    p_expires_at
  )
  returning id into invitation_id;

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
    'member.invited',
    'tenant_invitation',
    invitation_id::text,
    jsonb_build_object(
      'email', normalized_email,
      'role', p_role,
      'data_scope', p_data_scope,
      'equipe_id', professional_id
    )
  );

  select tenant.display_name
  into tenant_name
  from public.tenants tenant
  where tenant.id = p_tenant_id;

  return jsonb_build_object(
    'invitation_id', invitation_id,
    'member_id', professional_id,
    'email', normalized_email,
    'name', p_profile ->> 'name',
    'tenant_name', tenant_name,
    'role', p_role,
    'data_scope', p_data_scope,
    'expires_at', p_expires_at
  );
end;
$$;

create or replace function public.tenant_accept_invite_server(
  p_user_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation public.tenant_invitations%rowtype;
  authenticated_email text;
  target_membership_id uuid;
begin
  select lower(account.email)
  into authenticated_email
  from auth.users account
  where account.id = p_user_id;

  if authenticated_email is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_identity';
  end if;

  select candidate.*
  into invitation
  from public.tenant_invitations candidate
  where candidate.token_hash = p_token_hash
  for update;

  if invitation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'invalid_invitation';
  end if;

  if invitation.status = 'accepted' then
    raise exception using
      errcode = 'P0001',
      message = 'already_accepted';
  end if;

  if invitation.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'invitation_unavailable';
  end if;

  if invitation.expires_at <= now() then
    update public.tenant_invitations
    set status = 'expired', updated_at = now()
    where id = invitation.id;

    raise exception using
      errcode = 'P0001',
      message = 'invitation_expired';
  end if;

  if lower(invitation.email::text) <> authenticated_email then
    raise exception using
      errcode = '42501',
      message = 'email_mismatch';
  end if;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    data_scope,
    invited_by,
    activated_at
  ) values (
    invitation.tenant_id,
    p_user_id,
    invitation.role,
    'active',
    invitation.data_scope,
    invitation.invited_by,
    now()
  )
  on conflict (tenant_id, user_id)
  do update set
    role = case
      when public.tenant_memberships.role = 'owner'
        then public.tenant_memberships.role
      else excluded.role
    end,
    status = 'active',
    data_scope = case
      when public.tenant_memberships.role = 'owner'
        then public.tenant_memberships.data_scope
      else excluded.data_scope
    end,
    invited_by = excluded.invited_by,
    activated_at = coalesce(
      public.tenant_memberships.activated_at,
      excluded.activated_at
    ),
    suspended_at = null,
    removed_at = null,
    updated_at = now()
  returning id into target_membership_id;

  delete from public.tenant_team_members team_member
  where team_member.tenant_id = invitation.tenant_id
    and team_member.membership_id = target_membership_id;

  if invitation.data_scope = 'team' and invitation.team_id is not null then
    insert into public.tenant_team_members (
      tenant_id,
      team_id,
      membership_id,
      created_by
    ) values (
      invitation.tenant_id,
      invitation.team_id,
      target_membership_id,
      invitation.invited_by
    )
    on conflict (team_id, membership_id) do nothing;
  end if;

  update public.equipe professional
  set
    membership_id = target_membership_id,
    ativo = true,
    updated_at = now()
  where professional.id = invitation.equipe_id
    and professional.tenant_id = invitation.tenant_id;

  update public.tenant_invitations
  set
    status = 'accepted',
    membership_id = target_membership_id,
    accepted_at = now(),
    updated_at = now()
  where id = invitation.id;

  insert into public.tenant_audit_events (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    invitation.tenant_id,
    p_user_id,
    'member.invite_accepted',
    'tenant_membership',
    target_membership_id::text,
    jsonb_build_object('invitation_id', invitation.id)
  );

  return jsonb_build_object(
    'tenant_id', invitation.tenant_id,
    'membership_id', target_membership_id,
    'status', 'active'
  );
end;
$$;

create or replace function public.tenant_manage_member_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_membership_id uuid,
  p_action text,
  p_role text default null,
  p_data_scope text default null,
  p_team_id uuid default null,
  p_profile jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  target_membership public.tenant_memberships%rowtype;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role not in ('owner', 'admin') then
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

  if target_membership.role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'owner_requires_transfer';
  end if;

  if p_action = 'update_access' then
    if p_role not in ('admin', 'lawyer', 'assistant', 'finance') then
      raise exception using
        errcode = '22023',
        message = 'invalid_role';
    end if;

    if p_data_scope not in ('tenant', 'team', 'assigned') then
      raise exception using
        errcode = '22023',
        message = 'invalid_data_scope';
    end if;

    if p_data_scope = 'team' and p_team_id is null then
      raise exception using
        errcode = '22023',
        message = 'team_required';
    end if;

    if p_data_scope = 'team' and not exists (
      select 1
      from public.tenant_teams team
      where team.id = p_team_id
        and team.tenant_id = p_tenant_id
        and team.is_active
    ) then
      raise exception using
        errcode = '22023',
        message = 'invalid_team';
    end if;

    update public.tenant_memberships
    set role = p_role, data_scope = p_data_scope, updated_at = now()
    where id = p_membership_id;

    delete from public.tenant_team_members
    where tenant_id = p_tenant_id
      and membership_id = p_membership_id;

    if p_data_scope = 'team' then
      insert into public.tenant_team_members (
        tenant_id,
        team_id,
        membership_id,
        created_by
      ) values (
        p_tenant_id,
        p_team_id,
        p_membership_id,
        p_actor_user_id
      );
    end if;
  elsif p_action = 'suspend' then
    update public.tenant_memberships
    set
      status = 'suspended',
      suspended_at = now(),
      removed_at = null,
      updated_at = now()
    where id = p_membership_id;

    update public.equipe
    set ativo = false, updated_at = now()
    where tenant_id = p_tenant_id
      and membership_id = p_membership_id;
  elsif p_action = 'reactivate' then
    update public.tenant_memberships
    set
      status = 'active',
      activated_at = coalesce(activated_at, now()),
      suspended_at = null,
      removed_at = null,
      updated_at = now()
    where id = p_membership_id;

    update public.equipe
    set ativo = true, updated_at = now()
    where tenant_id = p_tenant_id
      and membership_id = p_membership_id;
  else
    raise exception using
      errcode = '22023',
      message = 'invalid_action';
  end if;

  if p_profile is not null then
    update public.equipe
    set
      nome = coalesce(
        nullif(btrim(p_profile ->> 'name'), ''),
        nome
      ),
      telefone = case
        when p_profile ? 'phone'
          then nullif(btrim(coalesce(p_profile ->> 'phone', '')), '')
        else telefone
      end,
      cargo = coalesce(
        nullif(btrim(p_profile ->> 'jobTitle'), ''),
        cargo
      ),
      oab = case
        when p_profile ? 'oab'
          then nullif(btrim(coalesce(p_profile ->> 'oab', '')), '')
        else oab
      end,
      valor_hora = case
        when p_profile ? 'hourlyRate'
          then nullif(p_profile ->> 'hourlyRate', '')::numeric
        else valor_hora
      end,
      meta_horas_mes = case
        when p_profile ? 'monthlyHoursTarget'
          then coalesce(
            nullif(p_profile ->> 'monthlyHoursTarget', '')::numeric,
            meta_horas_mes
          )
        else meta_horas_mes
      end,
      updated_at = now()
    where tenant_id = p_tenant_id
      and membership_id = p_membership_id;
  end if;

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
    'member.' || p_action,
    'tenant_membership',
    p_membership_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'role', p_role,
      'data_scope', p_data_scope,
      'team_id', p_team_id
    ))
  );

  return jsonb_build_object(
    'membership_id', p_membership_id,
    'action', p_action,
    'status', case
      when p_action = 'suspend' then 'suspended'
      else 'active'
    end
  );
end;
$$;

create or replace function public.tenant_manage_invitation_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_invitation_id uuid,
  p_action text,
  p_token_hash text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  invitation public.tenant_invitations%rowtype;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role not in ('owner', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'permission_denied';
  end if;

  select candidate.*
  into invitation
  from public.tenant_invitations candidate
  where candidate.id = p_invitation_id
    and candidate.tenant_id = p_tenant_id
  for update;

  if invitation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'invitation_not_found';
  end if;

  if invitation.status <> 'pending' then
    raise exception using
      errcode = 'P0001',
      message = 'invitation_not_pending';
  end if;

  if p_action = 'resend' then
    if length(coalesce(p_token_hash, '')) <> 64
      or p_token_hash !~ '^[0-9a-f]{64}$'
      or p_expires_at <= now()
    then
      raise exception using
        errcode = '22023',
        message = 'invalid_resend';
    end if;

    update public.tenant_invitations
    set
      token_hash = p_token_hash,
      expires_at = p_expires_at,
      revoked_at = null,
      updated_at = now()
    where id = p_invitation_id;
  elsif p_action = 'revoke' then
    update public.tenant_invitations
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where id = p_invitation_id;
  else
    raise exception using
      errcode = '22023',
      message = 'invalid_action';
  end if;

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
    'invitation.' || p_action,
    'tenant_invitation',
    p_invitation_id::text,
    jsonb_build_object('email', invitation.email)
  );

  return jsonb_build_object(
    'invitation_id', p_invitation_id,
    'action', p_action,
    'email', invitation.email,
    'equipe_id', invitation.equipe_id,
    'role', invitation.role,
    'data_scope', invitation.data_scope,
    'expires_at', case
      when p_action = 'resend' then p_expires_at
      else invitation.expires_at
    end
  );
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

  if actor_role not in ('owner', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'permission_denied';
  end if;

  return jsonb_build_object(
    'members',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', professional.id,
          'membership_id', membership.id,
          'name', professional.nome,
          'email', professional.email,
          'phone', professional.telefone,
          'job_title', professional.cargo,
          'oab', professional.oab,
          'hourly_rate', professional.valor_hora,
          'monthly_hours_target', professional.meta_horas_mes,
          'active', professional.ativo,
          'role', membership.role,
          'data_scope', membership.data_scope,
          'status', membership.status,
          'team_id', team_member.team_id
        )
        order by professional.nome
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
        )
        order by invitation.created_at desc
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
        )
        order by team.name
      )
      from public.tenant_teams team
      where team.tenant_id = p_tenant_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.tenant_invite_member_server(
  uuid, uuid, jsonb, text, text, uuid, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.tenant_invite_member_server(
  uuid, uuid, jsonb, text, text, uuid, text, timestamptz
) to service_role;

revoke all on function public.tenant_accept_invite_server(uuid, text)
  from public, anon, authenticated;
grant execute on function public.tenant_accept_invite_server(uuid, text)
  to service_role;

revoke all on function public.tenant_manage_member_server(
  uuid, uuid, uuid, text, text, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.tenant_manage_member_server(
  uuid, uuid, uuid, text, text, text, uuid, jsonb
) to service_role;

revoke all on function public.tenant_manage_invitation_server(
  uuid, uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.tenant_manage_invitation_server(
  uuid, uuid, uuid, text, text, timestamptz
) to service_role;

revoke all on function public.tenant_team_overview_server(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_team_overview_server(uuid, uuid)
  to service_role;

comment on function public.tenant_invite_member_server(
  uuid, uuid, jsonb, text, text, uuid, text, timestamptz
) is
  'Operação transacional server-only para criar perfil e convite por tenant.';

comment on function public.tenant_accept_invite_server(uuid, text) is
  'Aceita convite server-only após identidade e e-mail serem validados.';
