-- Professional profiles created by an invitation do not belong to the
-- inviter. They remain account-less until the recipient accepts the invite.
alter table public.equipe
  alter column user_id drop not null;

-- Ensure every existing tenant membership is visible in Team Management.
insert into public.equipe (
  tenant_id,
  user_id,
  membership_id,
  nome,
  email,
  cargo,
  ativo
)
select
  membership.tenant_id,
  membership.user_id,
  membership.id,
  coalesce(
    nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
    split_part(account.email, '@', 1)
  ),
  lower(account.email),
  case membership.role
    when 'owner' then 'administrador'
    when 'admin' then 'administrador'
    when 'lawyer' then 'advogado'
    when 'assistant' then 'assistente'
    when 'finance' then 'financeiro'
    else 'advogado'
  end,
  membership.status = 'active'
from public.tenant_memberships membership
join auth.users account on account.id = membership.user_id
where membership.status in ('active', 'suspended')
  and account.email is not null
  and not exists (
    select 1
    from public.equipe professional
    where professional.tenant_id = membership.tenant_id
      and professional.membership_id = membership.id
  )
on conflict (tenant_id, lower(email))
  where email is not null and btrim(email) <> ''
do update set
  user_id = excluded.user_id,
  membership_id = excluded.membership_id,
  ativo = excluded.ativo,
  updated_at = now();

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
    null,
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
    user_id = p_user_id,
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

-- Keep the privileged server-only execution model from the original workflow.
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
