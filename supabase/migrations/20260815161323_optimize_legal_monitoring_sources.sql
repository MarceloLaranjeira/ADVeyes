-- Reduz a fila jurídica sem perder cobertura e fornece contadores operacionais
-- exatos ao painel da plataforma.

begin;

-- Publicações consultadas pela OAB já incluem os processos vinculados àquela
-- inscrição. Manter também uma consulta DJEN por processo duplica chamadas,
-- antecipa rate limits do CNJ e impede o DataJud de consumir sua fila.
create or replace function private.refresh_process_djen_source(
  p_tenant_id uuid,
  p_process_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  covered_by_oab boolean;
begin
  select exists (
    select 1
    from public.process_lawyers link
    join public.legal_sync_sources oab_source
      on oab_source.tenant_id = link.tenant_id
     and oab_source.lawyer_registration_id = link.lawyer_registration_id
     and oab_source.source_kind = 'oab'
     and oab_source.provider = 'djen'
     and oab_source.active
    where link.tenant_id = p_tenant_id
      and link.process_id = p_process_id
  ) into covered_by_oab;

  update public.legal_sync_sources source
  set
    active = not covered_by_oab,
    paused_reason = case
      when covered_by_oab then 'covered_by_oab'
      else null
    end,
    next_sync_at = case
      when not covered_by_oab then now()
      else source.next_sync_at
    end
  where source.tenant_id = p_tenant_id
    and source.process_id = p_process_id
    and source.source_kind = 'process'
    and source.provider = 'djen'
    -- Não sobrescreve pausas permanentes por referência inválida/provedor.
    and (source.active or source.paused_reason = 'covered_by_oab');
end;
$$;

create or replace function private.refresh_linked_process_djen_sources()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_process_djen_source(old.tenant_id, old.process_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_process_djen_source(new.tenant_id, new.process_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists process_lawyers_refresh_djen_source
on public.process_lawyers;
create trigger process_lawyers_refresh_djen_source
after insert or update or delete on public.process_lawyers
for each row execute function private.refresh_linked_process_djen_sources();

create or replace function private.refresh_registration_djen_sources()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  registration_id uuid;
  registration_tenant_id uuid;
  linked_process record;
begin
  if tg_op in ('UPDATE', 'DELETE')
    and old.source_kind = 'oab'
    and old.provider = 'djen' then
    for linked_process in
      select link.process_id
      from public.process_lawyers link
      where link.tenant_id = old.tenant_id
        and link.lawyer_registration_id = old.lawyer_registration_id
    loop
      perform private.refresh_process_djen_source(
        old.tenant_id,
        linked_process.process_id
      );
    end loop;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
    and new.source_kind = 'oab'
    and new.provider = 'djen' then
    registration_id := new.lawyer_registration_id;
    registration_tenant_id := new.tenant_id;
    for linked_process in
      select link.process_id
      from public.process_lawyers link
      where link.tenant_id = registration_tenant_id
        and link.lawyer_registration_id = registration_id
    loop
      perform private.refresh_process_djen_source(
        registration_tenant_id,
        linked_process.process_id
      );
    end loop;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists legal_oab_source_refresh_process_sources
on public.legal_sync_sources;
create trigger legal_oab_source_refresh_process_sources
after insert or delete or update of active, lawyer_registration_id
on public.legal_sync_sources
for each row
execute function private.refresh_registration_djen_sources();

-- Corrige imediatamente as fontes redundantes existentes.
update public.legal_sync_sources process_source
set active = false,
    paused_reason = 'covered_by_oab'
where process_source.source_kind = 'process'
  and process_source.provider = 'djen'
  and process_source.active
  and exists (
    select 1
    from public.process_lawyers link
    join public.legal_sync_sources oab_source
      on oab_source.tenant_id = link.tenant_id
     and oab_source.lawyer_registration_id = link.lawyer_registration_id
     and oab_source.source_kind = 'oab'
     and oab_source.provider = 'djen'
     and oab_source.active
    where link.tenant_id = process_source.tenant_id
      and link.process_id = process_source.process_id
  );

-- O PostgREST limita respostas a 1.000 linhas. O painel antigo contava o
-- tamanho da resposta e, por isso, mostrava 1.000 em vez de 1.397 e zero
-- falhas mesmo com fontes em erro. Esta RPC agrega no banco e valida o ator.
create or replace function public.platform_legal_overview_counts(
  p_actor_user_id uuid
)
returns table (
  tenant_id uuid,
  active_members bigint,
  candidate_processes bigint,
  monitored_processes bigint,
  integration_failures bigint,
  last_legal_success_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.platform_admins administrator
    where administrator.user_id = p_actor_user_id
      and administrator.is_active
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query
  select
    tenant.id,
    (select count(*) from public.tenant_memberships membership
      where membership.tenant_id = tenant.id and membership.status = 'active'),
    (select count(*) from public.process_discoveries discovery
      where discovery.tenant_id = tenant.id and discovery.state = 'candidate'),
    (select count(*) from public.processos process
      where process.tenant_id = tenant.id
        and exists (
          select 1 from public.legal_sync_sources source
          where source.tenant_id = tenant.id
            and source.process_id = process.id
            and source.active
        )),
    (
      (select count(*) from public.legal_sync_sources source
        where source.tenant_id = tenant.id
          and source.paused_reason is distinct from 'covered_by_oab'
          and (source.last_error_code is not null or source.paused_reason is not null))
      +
      (select count(*) from public.legal_provider_monitors monitor
        where monitor.tenant_id = tenant.id
          and (monitor.status = 'failed' or monitor.last_error_code is not null))
    ),
    (select max(source.last_success_at) from public.legal_sync_sources source
      where source.tenant_id = tenant.id)
  from public.tenants tenant;
end;
$$;

revoke all on function private.refresh_process_djen_source(uuid, uuid)
from public, anon, authenticated;
revoke all on function private.refresh_linked_process_djen_sources()
from public, anon, authenticated;
revoke all on function private.refresh_registration_djen_sources()
from public, anon, authenticated;
revoke all on function public.platform_legal_overview_counts(uuid)
from public, anon;
grant execute on function public.platform_legal_overview_counts(uuid)
to authenticated, service_role;

comment on function public.platform_legal_overview_counts(uuid) is
  'Contadores jurídicos exatos por escritório; exige administrador da plataforma.';

commit;
