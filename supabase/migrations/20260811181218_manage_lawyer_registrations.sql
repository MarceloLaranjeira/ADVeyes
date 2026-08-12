begin;

-- Operação interna e transacional para a Edge Function. O navegador não recebe
-- permissão de execução: a função HTTP valida tenant, papel e propriedade antes
-- de chamar esta RPC com service_role.
create or replace function public.manage_lawyer_registration_server(
  p_tenant_id uuid,
  p_registration_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_professional_id uuid default null,
  p_oab_number text default null,
  p_oab_state text default null,
  p_support_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration public.lawyer_registrations%rowtype;
  normalized_number text;
  normalized_state text;
  old_reference text;
  new_reference text;
  target_professional_id uuid;
  profile_oab text;
begin
  if p_action not in ('update', 'disable') then
    raise exception using message = 'invalid_action';
  end if;

  select *
  into registration
  from public.lawyer_registrations
  where tenant_id = p_tenant_id
    and id = p_registration_id
  for update;

  if not found then
    raise exception using message = 'registration_not_found';
  end if;

  old_reference := btrim(registration.oab_number) || '/' ||
    upper(btrim(registration.oab_state));

  if p_action = 'disable' then
    update public.lawyer_registrations
    set status = 'disabled'
    where tenant_id = p_tenant_id
      and id = p_registration_id;

    update public.legal_sync_sources
    set
      active = false,
      paused_reason = 'registration_disabled',
      next_sync_at = now()
    where tenant_id = p_tenant_id
      and source_kind = 'oab'
      and lawyer_registration_id = p_registration_id;

    select candidate.oab_number || '/' || candidate.oab_state
    into profile_oab
    from public.lawyer_registrations candidate
    where candidate.tenant_id = p_tenant_id
      and candidate.professional_id = registration.professional_id
      and candidate.id <> p_registration_id
      and candidate.status not in ('disabled', 'invalid')
    order by candidate.created_at, candidate.id
    limit 1;

    update public.equipe
    set oab = profile_oab
    where tenant_id = p_tenant_id
      and id = registration.professional_id;

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
      'legal.oab_disabled',
      'lawyer_registration',
      p_registration_id,
      jsonb_build_object(
        'oab', old_reference,
        'professional_id', registration.professional_id,
        'support_session_id', p_support_session_id
      )
    );

    return jsonb_build_object(
      'registrationId', p_registration_id,
      'disabled', true,
      'preservedProcesses', true
    );
  end if;

  normalized_number := regexp_replace(coalesce(p_oab_number, ''), '[^0-9]', '', 'g');
  normalized_state := upper(btrim(coalesce(p_oab_state, '')));
  target_professional_id := coalesce(p_professional_id, registration.professional_id);

  if normalized_number = '' or normalized_state !~ '^[A-Z]{2}$' then
    raise exception using message = 'invalid_payload';
  end if;

  if not exists (
    select 1
    from public.equipe professional
    where professional.tenant_id = p_tenant_id
      and professional.id = target_professional_id
      and professional.ativo = true
  ) then
    raise exception using message = 'professional_not_found';
  end if;

  if exists (
    select 1
    from public.lawyer_registrations duplicate
    where duplicate.tenant_id = p_tenant_id
      and duplicate.id <> p_registration_id
      and duplicate.oab_number = normalized_number
      and duplicate.oab_state = normalized_state
      and duplicate.oab_type = registration.oab_type
  ) then
    raise exception using message = 'registration_already_exists';
  end if;

  new_reference := normalized_number || '/' || normalized_state;

  if new_reference <> old_reference then
    update public.legal_sync_sources
    set
      active = false,
      paused_reason = 'registration_replaced'
    where tenant_id = p_tenant_id
      and source_kind = 'oab'
      and lawyer_registration_id = p_registration_id;
  end if;

  update public.lawyer_registrations
  set
    professional_id = target_professional_id,
    oab_number = normalized_number,
    oab_state = normalized_state,
    status = case
      when new_reference <> old_reference then 'pending'
      else registration.status
    end,
    verified_name = case
      when new_reference <> old_reference then null
      else registration.verified_name
    end,
    verified_at = case
      when new_reference <> old_reference then null
      else registration.verified_at
    end,
    last_discovery_at = case
      when new_reference <> old_reference then null
      else registration.last_discovery_at
    end
  where tenant_id = p_tenant_id
    and id = p_registration_id;

  update public.legal_sync_sources
  set
    active = true,
    failure_count = 0,
    last_error_code = null,
    last_error_message = null,
    paused_reason = null,
    next_sync_at = now()
  where tenant_id = p_tenant_id
    and source_kind = 'oab'
    and lawyer_registration_id = p_registration_id
    and reference = new_reference;

  -- O campo legado representa uma inscrição principal; a tabela estruturada
  -- continua sendo a fonte de verdade para uma ou várias OABs.
  update public.equipe
  set oab = new_reference
  where tenant_id = p_tenant_id
    and id = target_professional_id;

  if registration.professional_id <> target_professional_id then
    select candidate.oab_number || '/' || candidate.oab_state
    into profile_oab
    from public.lawyer_registrations candidate
    where candidate.tenant_id = p_tenant_id
      and candidate.professional_id = registration.professional_id
      and candidate.status not in ('disabled', 'invalid')
    order by candidate.created_at, candidate.id
    limit 1;

    update public.equipe
    set oab = profile_oab
    where tenant_id = p_tenant_id
      and id = registration.professional_id;
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
    'legal.oab_updated',
    'lawyer_registration',
    p_registration_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'oab', old_reference,
        'professional_id', registration.professional_id
      ),
      'after', jsonb_build_object(
        'oab', new_reference,
        'professional_id', target_professional_id
      ),
      'support_session_id', p_support_session_id
    )
  );

  return jsonb_build_object(
    'registrationId', p_registration_id,
    'professionalId', target_professional_id,
    'oabNumber', normalized_number,
    'oabState', normalized_state,
    'synchronizationScheduled', true
  );
end;
$$;

revoke all on function public.manage_lawyer_registration_server(
  uuid, uuid, text, uuid, uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.manage_lawyer_registration_server(
  uuid, uuid, text, uuid, uuid, text, text, uuid
) to service_role;

-- `equipe.oab` continua existindo para telas legadas, mas representa somente
-- a inscrição principal. A lista completa vive em lawyer_registrations.
create or replace function private.sync_professional_primary_oab()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  affected_tenant_id uuid;
  affected_professional_id uuid;
  primary_oab text;
begin
  affected_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  affected_professional_id := coalesce(new.professional_id, old.professional_id);

  select registration.oab_number || '/' || upper(registration.oab_state)
  into primary_oab
  from public.lawyer_registrations registration
  where registration.tenant_id = affected_tenant_id
    and registration.professional_id = affected_professional_id
    and registration.status not in ('disabled', 'invalid')
  order by
    (registration.status = 'verified') desc,
    registration.updated_at desc,
    registration.id
  limit 1;

  update public.equipe
  set oab = primary_oab
  where tenant_id = affected_tenant_id
    and id = affected_professional_id;

  if tg_op = 'UPDATE' and old.professional_id <> new.professional_id then
    select registration.oab_number || '/' || upper(registration.oab_state)
    into primary_oab
    from public.lawyer_registrations registration
    where registration.tenant_id = old.tenant_id
      and registration.professional_id = old.professional_id
      and registration.status not in ('disabled', 'invalid')
    order by
      (registration.status = 'verified') desc,
      registration.updated_at desc,
      registration.id
    limit 1;

    update public.equipe
    set oab = primary_oab
    where tenant_id = old.tenant_id
      and id = old.professional_id;
  end if;

  -- AFTER trigger: o valor retornado é ignorado pelo PostgreSQL.
  return null;
end;
$$;

revoke all on function private.sync_professional_primary_oab()
from public, anon, authenticated;

drop trigger if exists lawyer_registrations_sync_primary_oab
on public.lawyer_registrations;
create trigger lawyer_registrations_sync_primary_oab
after insert or update or delete on public.lawyer_registrations
for each row execute function private.sync_professional_primary_oab();

-- Corrige perfis já existentes, inclusive os de Abraão e Daniel, sem depender
-- de IDs ou nomes específicos e sem apagar inscrições adicionais.
update public.equipe professional
set oab = (
  select registration.oab_number || '/' || upper(registration.oab_state)
  from public.lawyer_registrations registration
  where registration.tenant_id = professional.tenant_id
    and registration.professional_id = professional.id
    and registration.status not in ('disabled', 'invalid')
  order by
    (registration.status = 'verified') desc,
    registration.updated_at desc,
    registration.id
  limit 1
)
where exists (
  select 1
  from public.lawyer_registrations registration
  where registration.tenant_id = professional.tenant_id
    and registration.professional_id = professional.id
    and registration.status not in ('disabled', 'invalid')
);

commit;
