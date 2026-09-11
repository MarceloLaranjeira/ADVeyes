-- Solicitações de acesso por link privado.
--
-- O integrante autentica-se, informa seus dados e fica pendente sem receber
-- nenhuma membership. Somente o proprietário decide a entrada e as permissões.
-- O convite continua funcionando durante a transição.

begin;

-- ---------------------------------------------------------------------------
-- 1. Link privado por escritório
-- ---------------------------------------------------------------------------

create table public.tenant_access_links (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint tenant_access_links_revocation check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

-- Um único link vigente por escritório; revogar e gerar outro é o caminho.
create unique index tenant_access_links_active_key
  on public.tenant_access_links (tenant_id)
  where status = 'active';

create index tenant_access_links_tenant_idx
  on public.tenant_access_links (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Solicitações
-- ---------------------------------------------------------------------------

create table public.tenant_access_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  link_id uuid references public.tenant_access_links(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (
    email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  name text not null check (length(btrim(name)) between 2 and 200),
  phone text,
  oab text,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  membership_id uuid,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  rejection_reason text check (
    rejection_reason is null or length(btrim(rejection_reason)) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_access_requests_membership_fk
    foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id)
    on delete set null (membership_id),
  constraint tenant_access_requests_decision check (
    (status in ('pending', 'cancelled')) = (decided_at is null)
  ),
  constraint tenant_access_requests_approval check (
    status <> 'approved' or membership_id is not null
  )
);

-- Uma solicitação pendente por pessoa e escritório.
create unique index tenant_access_requests_pending_key
  on public.tenant_access_requests (tenant_id, user_id)
  where status = 'pending';

create index tenant_access_requests_tenant_status_idx
  on public.tenant_access_requests (tenant_id, status, created_at desc);

create index tenant_access_requests_user_idx
  on public.tenant_access_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS: o solicitante lê o próprio pedido; o proprietário lê os do tenant.
--    Toda escrita passa pelas funções server-only.
-- ---------------------------------------------------------------------------

alter table public.tenant_access_links enable row level security;
alter table public.tenant_access_requests enable row level security;

create policy "Owner reads tenant access links"
  on public.tenant_access_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = tenant_access_links.tenant_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = 'owner'
    )
  );

create policy "Requester reads own access request"
  on public.tenant_access_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Owner reads tenant access requests"
  on public.tenant_access_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = tenant_access_requests.tenant_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = 'owner'
    )
  );

-- Sem uma referencia, a notificacao nao pode ser encerrada quando a
-- solicitacao e decidida. As colunas sao opcionais e nao afetam quem ja usa
-- a tabela.
alter table public.notificacoes
  add column if not exists origem text,
  add column if not exists referencia_id uuid;

create index if not exists notificacoes_origem_referencia_idx
  on public.notificacoes (origem, referencia_id)
  where origem is not null;

revoke all on public.tenant_access_links from public, anon;
revoke all on public.tenant_access_requests from public, anon;
grant select on public.tenant_access_links to authenticated;
grant select on public.tenant_access_requests to authenticated;
grant all on public.tenant_access_links to service_role;
grant all on public.tenant_access_requests to service_role;

-- ---------------------------------------------------------------------------
-- 4. Matriz de autorização: decidir acesso e administrar permissões passam a
--    ser autoridades exclusivas do proprietário e não aceitam exceção.
-- ---------------------------------------------------------------------------

create or replace function private.has_tenant_permission(
  p_tenant_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  membership_role text;
  overrides jsonb;
  override_value text;
  base_allowed boolean := false;
  known_permission boolean;
  owner_only boolean;
begin
  known_permission := (p_module, p_action) in (
    ('ownership', 'transfer'),
    ('access_requests', 'read'), ('access_requests', 'decide'),
    ('permissions', 'manage'),
    ('subscription', 'read'), ('subscription', 'manage'),
    ('members', 'read'), ('members', 'manage'),
    ('brand', 'read'), ('brand', 'manage'),
    ('legal', 'read'), ('legal', 'create'), ('legal', 'update'),
    ('legal', 'delete'),
    ('finance', 'read'), ('finance', 'create'), ('finance', 'update'),
    ('finance', 'delete'),
    ('contracts', 'read'), ('contracts', 'create'), ('contracts', 'update'),
    ('contracts', 'delete'),
    ('reports', 'read'),
    ('critical_delete', 'execute')
  );

  if current_user_id is null or not known_permission then
    return false;
  end if;

  -- Autoridades indelegáveis do proprietário: nem o suporte da plataforma nem
  -- uma exceção individual podem concedê-las.
  owner_only := (p_module, p_action) in (
    ('ownership', 'transfer'),
    ('access_requests', 'decide'),
    ('permissions', 'manage')
  );

  if private.is_platform_admin(current_user_id) then
    if owner_only then return false; end if;
    if p_module = 'ownership' then return false; end if;
    if p_action = 'read' then return true; end if;
    return private.has_active_support_session(current_user_id, p_tenant_id);
  end if;

  select membership.role, membership.permission_overrides
  into membership_role, overrides
  from public.tenant_memberships membership
  where membership.user_id = current_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active'
  limit 1;

  if membership_role is null then return false; end if;

  if owner_only then
    return membership_role = 'owner';
  end if;

  override_value := lower(coalesce(
    overrides #>> array[p_module, p_action],
    case when p_action = 'create'
      then overrides #>> array[p_module, 'update']
      else null
    end,
    ''
  ));

  -- The owner is governed only by the explicit matrix and cannot be denied by
  -- an accidental/stale per-member override.
  if membership_role <> 'owner' and override_value = 'deny' then
    return false;
  end if;

  if p_module = 'access_requests' and p_action = 'read' then
    base_allowed := membership_role = 'owner';
  elsif p_module = 'subscription' and p_action = 'read' then
    base_allowed := membership_role in ('owner', 'admin');
  elsif p_module = 'subscription' and p_action = 'manage' then
    base_allowed := membership_role = 'owner';
  elsif p_module in ('members', 'brand')
    and p_action in ('read', 'manage') then
    base_allowed := membership_role in ('owner', 'admin');
  elsif p_module = 'legal'
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('owner', 'admin', 'lawyer', 'assistant');
  elsif p_module = 'legal' and p_action = 'delete' then
    base_allowed := membership_role = 'owner';
  elsif p_module in ('finance', 'contracts')
    and p_action in ('read', 'create', 'update') then
    base_allowed := membership_role in ('owner', 'admin', 'finance');
  elsif p_module in ('finance', 'contracts') and p_action = 'delete' then
    base_allowed := membership_role = 'owner';
  elsif p_module = 'reports' and p_action = 'read' then
    base_allowed := membership_role in (
      'owner', 'admin', 'lawyer', 'assistant', 'finance'
    );
  elsif p_module = 'critical_delete' and p_action = 'execute' then
    base_allowed := membership_role = 'owner';
  end if;

  return base_allowed
    or (membership_role <> 'owner' and override_value in ('allow', 'true'));
end;
$$;

revoke all on function private.has_tenant_permission(uuid, text, text)
from public, anon;
grant execute on function private.has_tenant_permission(uuid, text, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Operações server-only. As Edge Functions autenticam e chamam com a chave
--    de serviço; nenhuma delas é executável pelo cliente.
-- ---------------------------------------------------------------------------

-- Identidade pública do escritório a partir do link, sem expor o hash nem a
-- lista de escritórios. Usada pela tela de solicitação antes do login.
create or replace function public.tenant_lookup_access_link_server(
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  link public.tenant_access_links%rowtype;
  tenant_name text;
begin
  if length(coalesce(p_token_hash, '')) <> 64
    or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('valid', false, 'reason', 'invalid_token');
  end if;

  select candidate.*
  into link
  from public.tenant_access_links candidate
  where candidate.token_hash = p_token_hash;

  if link.id is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_token');
  end if;

  if link.status <> 'active' then
    return jsonb_build_object('valid', false, 'reason', 'revoked_token');
  end if;

  select tenant.display_name
  into tenant_name
  from public.tenants tenant
  where tenant.id = link.tenant_id;

  return jsonb_build_object(
    'valid', true,
    'tenant_id', link.tenant_id,
    'tenant_name', tenant_name,
    'link_id', link.id
  );
end;
$$;

-- Gerar, revogar ou consultar o link privado. Somente o proprietário.
create or replace function public.tenant_access_link_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_action text,
  p_token_hash text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  link public.tenant_access_links%rowtype;
  new_link_id uuid;
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role is distinct from 'owner' then
    raise exception using
      errcode = '42501',
      message = 'owner_required';
  end if;

  select candidate.*
  into link
  from public.tenant_access_links candidate
  where candidate.tenant_id = p_tenant_id
    and candidate.status = 'active'
  for update;

  if p_action = 'read' then
    if link.id is null then
      return jsonb_build_object('exists', false);
    end if;
    return jsonb_build_object(
      'exists', true,
      'link_id', link.id,
      'created_at', link.created_at
    );
  elsif p_action = 'revoke' then
    if link.id is null then
      raise exception using
        errcode = 'P0001',
        message = 'link_not_found';
    end if;

    update public.tenant_access_links
    set status = 'revoked', revoked_at = now(), revoked_by = p_actor_user_id
    where id = link.id;

    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_tenant_id, p_actor_user_id, 'access_link.revoked',
      'tenant_access_link', link.id::text, '{}'::jsonb
    );

    return jsonb_build_object('link_id', link.id, 'status', 'revoked');
  elsif p_action = 'generate' then
    if length(coalesce(p_token_hash, '')) <> 64
      or p_token_hash !~ '^[0-9a-f]{64}$'
    then
      raise exception using
        errcode = '22023',
        message = 'invalid_token_hash';
    end if;

    -- Revogar o anterior mantém decisões e memberships já concedidas.
    if link.id is not null then
      update public.tenant_access_links
      set status = 'revoked', revoked_at = now(), revoked_by = p_actor_user_id
      where id = link.id;
    end if;

    insert into public.tenant_access_links (
      tenant_id, token_hash, created_by
    ) values (
      p_tenant_id, p_token_hash, p_actor_user_id
    )
    returning id into new_link_id;

    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_tenant_id, p_actor_user_id, 'access_link.generated',
      'tenant_access_link', new_link_id::text,
      jsonb_strip_nulls(jsonb_build_object('replaced_link_id', link.id))
    );

    return jsonb_build_object('link_id', new_link_id, 'status', 'active');
  end if;

  raise exception using errcode = '22023', message = 'invalid_action';
end;
$$;

-- O integrante autenticado solicita acesso. Nada de membership aqui.
create or replace function public.tenant_request_access_server(
  p_user_id uuid,
  p_token_hash text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  link public.tenant_access_links%rowtype;
  account_email text;
  existing public.tenant_access_requests%rowtype;
  request_id uuid;
  tenant_name text;
begin
  select lower(account.email)
  into account_email
  from auth.users account
  where account.id = p_user_id;

  if account_email is null then
    raise exception using errcode = '22023', message = 'invalid_identity';
  end if;

  select candidate.*
  into link
  from public.tenant_access_links candidate
  where candidate.token_hash = p_token_hash
  for update;

  if link.id is null then
    raise exception using errcode = 'P0001', message = 'invalid_token';
  end if;

  if link.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'revoked_token';
  end if;

  if exists (
    select 1
    from public.tenant_memberships membership
    where membership.tenant_id = link.tenant_id
      and membership.user_id = p_user_id
      and membership.status in ('active', 'suspended')
  ) then
    raise exception using errcode = '23505', message = 'already_member';
  end if;

  select candidate.*
  into existing
  from public.tenant_access_requests candidate
  where candidate.tenant_id = link.tenant_id
    and candidate.user_id = p_user_id
    and candidate.status = 'pending';

  if existing.id is not null then
    return jsonb_build_object(
      'request_id', existing.id,
      'tenant_id', existing.tenant_id,
      'status', existing.status,
      'created_at', existing.created_at,
      'already_pending', true
    );
  end if;

  insert into public.tenant_access_requests (
    tenant_id, link_id, user_id, email, name, phone, oab
  ) values (
    link.tenant_id,
    link.id,
    p_user_id,
    account_email,
    btrim(coalesce(p_profile ->> 'name', '')),
    nullif(btrim(coalesce(p_profile ->> 'phone', '')), ''),
    nullif(btrim(coalesce(p_profile ->> 'oab', '')), '')
  )
  returning id into request_id;

  insert into public.tenant_audit_events (
    tenant_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    link.tenant_id, p_user_id, 'access_request.created',
    'tenant_access_request', request_id::text,
    jsonb_build_object('email', account_email)
  );

  -- Avisa os proprietarios: a entrada so avanca com a decisao deles.
  insert into public.notificacoes (
    user_id, tenant_id, titulo, mensagem, tipo, origem, referencia_id
  )
  select
    membership.user_id,
    link.tenant_id,
    'Nova solicitacao de acesso',
    coalesce(nullif(btrim(p_profile ->> 'name'), ''), account_email)
      || ' pediu acesso ao escritorio.',
    'info',
    'access_request',
    request_id
  from public.tenant_memberships membership
  where membership.tenant_id = link.tenant_id
    and membership.role = 'owner'
    and membership.status = 'active';

  select tenant.display_name
  into tenant_name
  from public.tenants tenant
  where tenant.id = link.tenant_id;

  return jsonb_build_object(
    'request_id', request_id,
    'tenant_id', link.tenant_id,
    'tenant_name', tenant_name,
    'status', 'pending',
    'already_pending', false
  );
end;
$$;

-- Situação das solicitações do próprio usuário, para a tela de espera.
create or replace function public.tenant_my_access_requests_server(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'request_id', request.id,
        'tenant_id', request.tenant_id,
        'tenant_name', tenant.display_name,
        'status', request.status,
        'rejection_reason', request.rejection_reason,
        'created_at', request.created_at,
        'decided_at', request.decided_at
      )
      order by request.created_at desc
    )
    from public.tenant_access_requests request
    join public.tenants tenant on tenant.id = request.tenant_id
    where request.user_id = p_user_id
  ), '[]'::jsonb);
end;
$$;

-- Lista para o proprietário. Somente o proprietário.
create or replace function public.tenant_access_requests_overview_server(
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

  if actor_role is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;

  return jsonb_build_object(
    'pending',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', request.id,
          'user_id', request.user_id,
          'email', request.email,
          'name', request.name,
          'phone', request.phone,
          'oab', request.oab,
          'created_at', request.created_at
        )
        order by request.created_at
      )
      from public.tenant_access_requests request
      where request.tenant_id = p_tenant_id
        and request.status = 'pending'
    ), '[]'::jsonb),
    'decided',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', request.id,
          'email', request.email,
          'name', request.name,
          'status', request.status,
          'membership_id', request.membership_id,
          'rejection_reason', request.rejection_reason,
          'decided_by', request.decided_by,
          'decided_at', request.decided_at
        )
        order by request.decided_at desc
      )
      from (
        select candidate.*
        from public.tenant_access_requests candidate
        where candidate.tenant_id = p_tenant_id
          and candidate.status in ('approved', 'rejected')
        order by candidate.decided_at desc
        limit 50
      ) request
    ), '[]'::jsonb)
  );
end;
$$;

-- Decisão do proprietário: aprova criando acesso e permissões numa única
-- transação, ou rejeita registrando o motivo. Sempre auditada.
create or replace function public.tenant_decide_access_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_request_id uuid,
  p_decision text,
  p_role text default null,
  p_data_scope text default null,
  p_team_id uuid default null,
  p_overrides jsonb default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  request public.tenant_access_requests%rowtype;
  professional_id uuid;
  target_membership_id uuid;
  previous_overrides jsonb;
  effective_overrides jsonb := coalesce(p_overrides, '{}'::jsonb);
begin
  select membership.role
  into actor_role
  from public.tenant_memberships membership
  where membership.user_id = p_actor_user_id
    and membership.tenant_id = p_tenant_id
    and membership.status = 'active';

  if actor_role is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;

  select candidate.*
  into request
  from public.tenant_access_requests candidate
  where candidate.id = p_request_id
    and candidate.tenant_id = p_tenant_id
  for update;

  if request.id is null then
    raise exception using errcode = 'P0001', message = 'request_not_found';
  end if;

  if request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'request_not_pending';
  end if;

  if p_decision = 'reject' then
    update public.tenant_access_requests
    set status = 'rejected',
        rejection_reason = nullif(btrim(coalesce(p_reason, '')), ''),
        decided_by = p_actor_user_id,
        decided_at = now(),
        updated_at = now()
    where id = request.id;

    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_tenant_id, p_actor_user_id, 'access_request.rejected',
      'tenant_access_request', request.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'email', request.email,
        'reason', nullif(btrim(coalesce(p_reason, '')), '')
      ))
    );

    -- A decisao encerra o aviso: nada mais depende do proprietario aqui.
    update public.notificacoes
    set lida = true
    where origem = 'access_request' and referencia_id = request.id;

    return jsonb_build_object('request_id', request.id, 'status', 'rejected');
  end if;

  if p_decision <> 'approve' then
    raise exception using errcode = '22023', message = 'invalid_decision';
  end if;

  if p_role not in ('admin', 'lawyer', 'assistant', 'finance') then
    raise exception using errcode = '22023', message = 'invalid_role';
  end if;

  if p_data_scope not in ('tenant', 'team', 'assigned') then
    raise exception using errcode = '22023', message = 'invalid_data_scope';
  end if;

  if p_data_scope = 'team' and p_team_id is null then
    raise exception using errcode = '22023', message = 'team_required';
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
    raise exception using errcode = '22023', message = 'invalid_team';
  end if;

  if jsonb_typeof(effective_overrides) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_overrides';
  end if;

  if effective_overrides ? 'ownership'
    or effective_overrides ? 'access_requests'
    or effective_overrides ? 'permissions'
  then
    raise exception using errcode = '42501', message = 'forbidden_override';
  end if;

  select membership.permission_overrides
  into previous_overrides
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id
    and membership.user_id = request.user_id;

  insert into public.tenant_memberships (
    tenant_id, user_id, role, status, data_scope,
    permission_overrides, invited_by, activated_at
  ) values (
    p_tenant_id, request.user_id, p_role, 'active', p_data_scope,
    effective_overrides, p_actor_user_id, now()
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
    permission_overrides = case
      when public.tenant_memberships.role = 'owner'
        then public.tenant_memberships.permission_overrides
      else excluded.permission_overrides
    end,
    invited_by = excluded.invited_by,
    activated_at = coalesce(
      public.tenant_memberships.activated_at, excluded.activated_at
    ),
    suspended_at = null,
    removed_at = null,
    updated_at = now()
  returning id into target_membership_id;

  -- O trigger multitenant de equipe exige que o usuario já seja membro ativo
  -- do tenant. Por isso a membership precisa existir antes do perfil
  -- profissional; a transacao continua atomica e qualquer falha posterior
  -- desfaz ambas as operacoes.
  insert into public.equipe (
    tenant_id, user_id, nome, email, telefone, cargo, oab, ativo
  ) values (
    p_tenant_id,
    request.user_id,
    request.name,
    request.email,
    request.phone,
    'advogado',
    request.oab,
    true
  )
  on conflict (tenant_id, lower(email))
    where email is not null and btrim(email) <> ''
  do update set
    nome = excluded.nome,
    telefone = coalesce(excluded.telefone, public.equipe.telefone),
    oab = coalesce(excluded.oab, public.equipe.oab),
    ativo = true,
    updated_at = now()
  returning id into professional_id;

  update public.equipe
  set membership_id = target_membership_id, ativo = true, updated_at = now()
  where id = professional_id
    and tenant_id = p_tenant_id;

  delete from public.tenant_team_members
  where tenant_id = p_tenant_id
    and membership_id = target_membership_id;

  if p_data_scope = 'team' then
    insert into public.tenant_team_members (
      tenant_id, team_id, membership_id, created_by
    ) values (
      p_tenant_id, p_team_id, target_membership_id, p_actor_user_id
    )
    on conflict (team_id, membership_id) do nothing;
  end if;

  update public.tenant_access_requests
  set status = 'approved',
      membership_id = target_membership_id,
      decided_by = p_actor_user_id,
      decided_at = now(),
      updated_at = now()
  where id = request.id;

  insert into public.tenant_audit_events (
    tenant_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_tenant_id, p_actor_user_id, 'access_request.approved',
    'tenant_access_request', request.id::text,
    jsonb_build_object(
      'email', request.email,
      'membership_id', target_membership_id,
      'role', p_role,
      'data_scope', p_data_scope,
      'team_id', p_team_id,
      'permissions_before', coalesce(previous_overrides, '{}'::jsonb),
      'permissions_after', effective_overrides
    )
  );

  update public.notificacoes
  set lida = true
  where origem = 'access_request' and referencia_id = request.id;

  return jsonb_build_object(
    'request_id', request.id,
    'status', 'approved',
    'membership_id', target_membership_id,
    'member_id', professional_id,
    'role', p_role,
    'data_scope', p_data_scope
  );
end;
$$;

-- Nenhuma destas operações é executável pelo cliente: as Edge Functions
-- autenticam o usuário e chamam com a chave de serviço.

revoke all on function public.tenant_lookup_access_link_server(text)
  from public, anon, authenticated;
grant execute on function public.tenant_lookup_access_link_server(text)
  to service_role;

revoke all on function public.tenant_access_link_server(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.tenant_access_link_server(uuid, uuid, text, text)
  to service_role;

revoke all on function public.tenant_request_access_server(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.tenant_request_access_server(uuid, text, jsonb)
  to service_role;

revoke all on function public.tenant_my_access_requests_server(uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_my_access_requests_server(uuid)
  to service_role;

revoke all on function public.tenant_access_requests_overview_server(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_access_requests_overview_server(uuid, uuid)
  to service_role;

revoke all on function public.tenant_decide_access_server(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) from public, anon, authenticated;
grant execute on function public.tenant_decide_access_server(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) to service_role;

comment on table public.tenant_access_links is
  'Link privado por escritorio; guarda apenas o hash do token.';

comment on table public.tenant_access_requests is
  'Solicitacoes de acesso iniciadas pelo integrante e decididas pelo proprietario.';

comment on function public.tenant_decide_access_server(
  uuid, uuid, uuid, text, text, text, uuid, jsonb, text
) is
  'Decisao transacional do proprietario: cria acesso e permissoes ou rejeita.';

commit;
