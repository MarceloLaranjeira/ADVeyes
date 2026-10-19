-- Correção do fluxo de solicitação e decisão de acesso (DIAG-7B5DFCE7)
--
-- 1. Redefine as funções de solicitação e decisão de acesso como SECURITY DEFINER
--    com search_path seguro, garantindo autoridade administrativa mesmo quando
--    chamadas via service_role através de Edge Functions.
-- 2. Protege o envio e atualização de notificações para que eventuais restrições
--    ou triggers em `public.notificacoes` nunca abortem a criação da solicitação
--    ou a sua aprovação.
-- 3. Atualiza o trigger de compatibilidade `private.assign_legacy_tenant()` para
--    isentar a tabela `notificacoes` da checagem de identidade do autor, já que
--    notificações apontam para o destinatário (`user_id`), que naturalmente difere
--    do solicitante ou do processo automático disparador.

begin;

-- ---------------------------------------------------------------------------
-- 1. Isenção segura em private.assign_legacy_tenant() para a tabela notificacoes
-- ---------------------------------------------------------------------------

create or replace function private.assign_legacy_tenant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  row_data jsonb := to_jsonb(new);
  request_user_id uuid := auth.uid();
  row_user_id uuid;
  actor_user_id uuid;
  supplied_tenant_id uuid := new.tenant_id;
  parent_tenant_ids uuid[];
  parent_tenant_id uuid;
  membership_tenant_ids uuid[];
  reference_id uuid;
  entity_type text;
begin
  if tg_op = 'UPDATE'
    and old.tenant_id is not null
    and new.tenant_id is distinct from old.tenant_id then
    raise exception using
      errcode = '23514',
      message = 'tenant_id cannot be reassigned';
  end if;

  -- Notificações são destinadas a um destinatário (user_id do destinatário)
  -- que pode diferir do usuário logado ou ser gerada por automações de sistema.
  if tg_table_name = 'notificacoes' then
    return new;
  end if;

  if nullif(row_data ->> 'user_id', '') is not null then
    row_user_id := (row_data ->> 'user_id')::uuid;
  end if;

  if request_user_id is not null
    and row_user_id is not null
    and request_user_id <> row_user_id then
    raise exception using
      errcode = '42501',
      message = 'row user_id must match the authenticated user';
  end if;

  actor_user_id := coalesce(request_user_id, row_user_id);

  case tg_table_name
    when 'processos' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'financeiro' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'eventos', 'documentos', 'audiencias',
      'processo_monitoramento', 'honorario_parcelas', 'andamentos' then
      reference_id := nullif(row_data ->> 'processo_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.processos
      where id = reference_id and tenant_id is not null;
    when 'portal_acessos' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'tarefa_checklist', 'tarefa_comentarios' then
      reference_id := nullif(row_data ->> 'tarefa_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.tarefas
      where id = reference_id and tenant_id is not null;
    when 'time_entries' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'leads' then
      reference_id := nullif(row_data ->> 'cliente_id', '')::uuid;
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from public.clientes
      where id = reference_id and tenant_id is not null;
    when 'documentos_gerados' then
      select array_agg(distinct tenant_id) into parent_tenant_ids
      from (
        select tenant_id from public.processos
        where id = nullif(row_data ->> 'processo_id', '')::uuid
        union
        select tenant_id from public.clientes
        where id = nullif(row_data ->> 'cliente_id', '')::uuid
        union
        select tenant_id from public.contratos_templates
        where id = nullif(row_data ->> 'template_id', '')::uuid
      ) parents
      where tenant_id is not null;
    when 'google_calendar_event_links', 'google_calendar_sync_queue' then
      reference_id := nullif(row_data ->> 'entity_id', '')::uuid;
      entity_type := row_data ->> 'entity_type';
      case entity_type
        when 'evento' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.eventos where id = reference_id;
        when 'audiencia' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.audiencias where id = reference_id;
        when 'tarefa' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.tarefas where id = reference_id;
        when 'financeiro' then
          select array_agg(tenant_id) into parent_tenant_ids
          from public.financeiro where id = reference_id;
        else
          parent_tenant_ids := null;
      end case;
    else
      parent_tenant_ids := null;
  end case;

  if coalesce(cardinality(parent_tenant_ids), 0) > 1 then
    raise exception using
      errcode = '23514',
      message = 'referenced parent rows belong to different tenants';
  end if;

  parent_tenant_id := parent_tenant_ids[1];

  if supplied_tenant_id is not null
    and parent_tenant_id is not null
    and supplied_tenant_id <> parent_tenant_id then
    raise exception using
      errcode = '23514',
      message = 'tenant_id does not match the referenced parent';
  end if;

  new.tenant_id := coalesce(supplied_tenant_id, parent_tenant_id);

  if new.tenant_id is null then
    if actor_user_id is null then
      raise exception using
        errcode = '23514',
        message = 'tenant context is required for internal records';
    end if;

    select array_agg(tenant_id order by tenant_id)
    into membership_tenant_ids
    from public.tenant_memberships
    where user_id = actor_user_id
      and status = 'active';

    if coalesce(cardinality(membership_tenant_ids), 0) <> 1 then
      raise exception using
        errcode = '23514',
        message =
          'legacy insert requires exactly one active tenant membership';
    end if;

    new.tenant_id := membership_tenant_ids[1];
  end if;

  if actor_user_id is not null and not exists (
    select 1
    from public.tenant_memberships
    where user_id = actor_user_id
      and tenant_id = new.tenant_id
      and status = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'user is not an active member of the resolved tenant';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. public.tenant_request_access_server redefinida como SECURITY DEFINER
-- ---------------------------------------------------------------------------

create or replace function public.tenant_request_access_server(
  p_user_id uuid,
  p_token_hash text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
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
  -- Se houver qualquer falha ao disparar a notificacao interna, a solicitacao
  -- principal nunca e prejudicada.
  begin
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
  exception
    when others then
      null;
  end;

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

-- ---------------------------------------------------------------------------
-- 3. public.tenant_decide_access_server redefinida como SECURITY DEFINER
-- ---------------------------------------------------------------------------

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
security definer
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

    begin
      update public.notificacoes
      set lida = true
      where origem = 'access_request' and referencia_id = request.id;
    exception
      when others then
        null;
    end;

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

  begin
    update public.notificacoes
    set lida = true
    where origem = 'access_request' and referencia_id = request.id;
  exception
    when others then
      null;
  end;

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

-- ---------------------------------------------------------------------------
-- 4. public.tenant_access_link_server redefinida como SECURITY DEFINER
-- ---------------------------------------------------------------------------

create or replace function public.tenant_access_link_server(
  p_actor_user_id uuid,
  p_tenant_id uuid,
  p_action text,
  p_token_hash text default null
)
returns jsonb
language plpgsql
security definer
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

-- ---------------------------------------------------------------------------
-- 5. public.tenant_my_access_requests_server redefinida como SECURITY DEFINER
-- ---------------------------------------------------------------------------

create or replace function public.tenant_my_access_requests_server(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', request.id,
          'tenant_id', request.tenant_id,
          'tenant_name', tenant.display_name,
          'status', request.status,
          'created_at', request.created_at,
          'decided_at', request.decided_at,
          'rejection_reason', request.rejection_reason
        )
        order by request.created_at desc
      )
      from public.tenant_access_requests request
      join public.tenants tenant on tenant.id = request.tenant_id
      where request.user_id = p_user_id
    ),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. public.tenant_access_requests_overview_server redefinida como SECURITY DEFINER
-- ---------------------------------------------------------------------------

create or replace function public.tenant_access_requests_overview_server(
  p_actor_user_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  pending_count integer;
  requests_json jsonb;
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

  select count(*)::integer
  into pending_count
  from public.tenant_access_requests request
  where request.tenant_id = p_tenant_id
    and request.status = 'pending';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', request.id,
        'user_id', request.user_id,
        'email', request.email,
        'name', request.name,
        'phone', request.phone,
        'oab', request.oab,
        'status', request.status,
        'created_at', request.created_at,
        'decided_at', request.decided_at,
        'decided_by', request.decided_by,
        'decided_by_name', coalesce(
          decider.raw_user_meta_data ->> 'full_name',
          decider.raw_user_meta_data ->> 'name',
          decider.email
        ),
        'rejection_reason', request.rejection_reason,
        'membership_id', request.membership_id
      )
      order by
        case request.status when 'pending' then 0 else 1 end,
        request.created_at desc
    ),
    '[]'::jsonb
  )
  into requests_json
  from public.tenant_access_requests request
  left join auth.users decider on decider.id = request.decided_by
  where request.tenant_id = p_tenant_id;

  return jsonb_build_object(
    'pending_count', pending_count,
    'requests', requests_json
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Garantir permissões de execução para a service_role
-- ---------------------------------------------------------------------------

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

commit;
