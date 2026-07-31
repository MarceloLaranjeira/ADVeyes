create table private.legal_process_registry (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  numero text not null,
  process_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, numero),
  unique (tenant_id, process_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete cascade
);

insert into private.legal_process_registry (tenant_id, numero, process_id)
select distinct on (tenant_id, numero)
  tenant_id,
  numero,
  id
from public.processos
where tenant_id is not null
order by tenant_id, numero, created_at, id;

create or replace function public.confirm_discovered_process(
  p_tenant_id uuid,
  p_candidate_id uuid,
  p_actor_user_id uuid,
  p_frequency text default 'DIARIA',
  p_include_public_documents boolean default true
)
returns table (
  process_id uuid,
  process_number text,
  tribunal text,
  monitor_id uuid,
  external_id text,
  monitor_status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  candidate public.process_discoveries%rowtype;
  registration public.lawyer_registrations%rowtype;
  selected_process public.processos%rowtype;
  selected_monitor public.legal_provider_monitors%rowtype;
begin
  if p_frequency not in ('DIARIA', 'SEMANAL') then
    raise exception 'invalid_frequency';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_candidate_id::text, 0)
  );

  select *
  into candidate
  from public.process_discoveries
  where tenant_id = p_tenant_id
    and id = p_candidate_id
  for update;

  if candidate.id is null then
    raise exception 'candidate_not_found';
  end if;

  select *
  into registration
  from public.lawyer_registrations
  where tenant_id = p_tenant_id
    and id = candidate.lawyer_registration_id;

  select process.*
  into selected_process
  from private.legal_process_registry registry
  join public.processos process
    on process.tenant_id = registry.tenant_id
   and process.id = registry.process_id
  where registry.tenant_id = p_tenant_id
    and registry.numero = candidate.numero_cnj;

  if selected_process.id is null then
    select *
    into selected_process
    from public.processos
    where tenant_id = p_tenant_id
      and numero = candidate.numero_cnj
    order by created_at, id
    limit 1;
  end if;

  if selected_process.id is null then
    insert into public.processos (
      tenant_id,
      user_id,
      numero,
      cliente_nome,
      area,
      status,
      vara,
      advogado,
      descricao
    )
    values (
      p_tenant_id,
      p_actor_user_id,
      candidate.numero_cnj,
      coalesce(
        candidate.title_active_party,
        candidate.title_passive_party,
        'Cliente a identificar'
      ),
      'A definir',
      case
        when candidate.process_status = 'INATIVO' then 'Arquivado'
        else 'Em andamento'
      end,
      candidate.court_unit,
      coalesce(registration.verified_name, 'Advogado do escritório'),
      case
        when candidate.tribunal is not null
          then 'Descoberto via Escavador (' || candidate.tribunal || ')'
        else 'Descoberto via Escavador'
      end
    )
    returning * into selected_process;
  end if;

  insert into private.legal_process_registry (tenant_id, numero, process_id)
  values (p_tenant_id, candidate.numero_cnj, selected_process.id)
  on conflict (tenant_id, numero) do nothing;

  insert into public.process_lawyers (
    tenant_id,
    process_id,
    lawyer_registration_id,
    source,
    created_by
  )
  values (
    p_tenant_id,
    selected_process.id,
    candidate.lawyer_registration_id,
    'discovery',
    p_actor_user_id
  )
  on conflict (tenant_id, process_id, lawyer_registration_id) do nothing;

  update public.process_discoveries
  set
    state = 'confirmed',
    confirmed_process_id = selected_process.id,
    confirmed_by = p_actor_user_id,
    confirmed_at = now()
  where tenant_id = p_tenant_id
    and id = p_candidate_id;

  insert into public.legal_provider_monitors (
    tenant_id,
    process_id,
    provider,
    frequency,
    include_public_documents,
    requested_by
  )
  values (
    p_tenant_id,
    selected_process.id,
    'escavador',
    p_frequency,
    p_include_public_documents,
    p_actor_user_id
  )
  on conflict (tenant_id, process_id, provider)
  do update set
    frequency = excluded.frequency,
    include_public_documents = excluded.include_public_documents
  returning * into selected_monitor;

  return query select
    selected_process.id,
    selected_process.numero,
    candidate.tribunal,
    selected_monitor.id,
    selected_monitor.external_id,
    selected_monitor.status;
end;
$$;

revoke all on function public.confirm_discovered_process(
  uuid, uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.confirm_discovered_process(
  uuid, uuid, uuid, text, boolean
) to service_role;

comment on function public.confirm_discovered_process(
  uuid, uuid, uuid, text, boolean
) is 'Confirma candidato e cria vínculo/monitor de forma transacional e idempotente.';
