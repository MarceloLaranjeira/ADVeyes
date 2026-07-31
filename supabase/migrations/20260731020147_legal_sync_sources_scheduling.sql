-- Fontes monitoradas por escritório: OABs da equipe e processos informados por
-- número CNJ. Guarda estado de ativação, cursor, última execução bem-sucedida e
-- próximo horário de reconciliação, com retentativa progressiva por falha.

begin;

create table public.legal_sync_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_kind text not null check (source_kind in ('oab', 'process')),
  provider text not null check (provider in ('escavador', 'datajud')),
  lawyer_registration_id uuid,
  process_id uuid,
  reference text not null,
  active boolean not null default true,
  sync_cursor text,
  next_sync_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error_code text,
  last_error_message text,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, source_kind, provider, reference),
  foreign key (tenant_id, lawyer_registration_id)
    references public.lawyer_registrations(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete cascade,
  constraint legal_sync_sources_reference_valid check (
    (
      source_kind = 'oab'
      and lawyer_registration_id is not null
      and process_id is null
    )
    or (
      source_kind = 'process'
      and process_id is not null
      and lawyer_registration_id is null
    )
  )
);

create index legal_sync_sources_due_idx
  on public.legal_sync_sources (next_sync_at)
  where active;

create index legal_sync_sources_tenant_idx
  on public.legal_sync_sources (tenant_id, source_kind, active);

alter table public.legal_sync_runs
  add column source_id uuid,
  add constraint legal_sync_runs_source_tenant_fkey
    foreign key (tenant_id, source_id)
    references public.legal_sync_sources(tenant_id, id)
    on delete set null (source_id);

create trigger legal_sync_sources_touch_updated_at
before update on public.legal_sync_sources
for each row execute function private.touch_tenant_updated_at();

-- Sincroniza a fonte de uma OAB cadastrada para um profissional do escritório.
create or replace function private.sync_source_for_lawyer_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  source_active boolean;
begin
  -- A mesma OAB pode ter mais de um cadastro no escritório.
  -- A fonte só é pausada quando nenhum cadastro daquela OAB continua válido.
  select exists (
    select 1
    from public.lawyer_registrations sibling
    where sibling.tenant_id = new.tenant_id
      and sibling.oab_number = new.oab_number
      and sibling.oab_state = new.oab_state
      and sibling.status not in ('disabled', 'invalid')
  )
  into source_active;

  insert into public.legal_sync_sources (
    tenant_id,
    source_kind,
    provider,
    lawyer_registration_id,
    reference,
    active
  )
  values (
    new.tenant_id,
    'oab',
    'escavador',
    new.id,
    new.oab_number || '/' || new.oab_state,
    source_active
  )
  on conflict (tenant_id, source_kind, provider, reference)
  do update set
    lawyer_registration_id = excluded.lawyer_registration_id,
    active = excluded.active,
    paused_reason = case
      when excluded.active then null
      else 'registration_disabled'
    end;

  return new;
end;
$$;

-- Sincroniza a fonte de um processo com número CNJ válido.
create or replace function private.sync_source_for_processo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  digits text;
  formatted text;
begin
  if new.tenant_id is null then
    return new;
  end if;

  digits := regexp_replace(coalesce(new.numero, ''), '[^0-9]', '', 'g');
  if length(digits) <> 20 then
    return new;
  end if;

  formatted :=
    substring(digits from 1 for 7) || '-' ||
    substring(digits from 8 for 2) || '.' ||
    substring(digits from 10 for 4) || '.' ||
    substring(digits from 14 for 1) || '.' ||
    substring(digits from 15 for 2) || '.' ||
    substring(digits from 17 for 4);

  insert into public.legal_sync_sources (
    tenant_id,
    source_kind,
    provider,
    process_id,
    reference,
    active
  )
  values (new.tenant_id, 'process', 'datajud', new.id, formatted, true)
  on conflict (tenant_id, source_kind, provider, reference)
  do update set
    process_id = excluded.process_id,
    active = true,
    paused_reason = null;

  return new;
end;
$$;

create trigger lawyer_registrations_sync_source
after insert or update of status, oab_number, oab_state
on public.lawyer_registrations
for each row execute function private.sync_source_for_lawyer_registration();

create trigger processos_sync_source
after insert or update of numero
on public.processos
for each row execute function private.sync_source_for_processo();

-- Carga inicial a partir dos cadastros já existentes.
insert into public.legal_sync_sources (
  tenant_id,
  source_kind,
  provider,
  lawyer_registration_id,
  reference,
  active
)
select
  registration.tenant_id,
  'oab',
  'escavador',
  registration.id,
  registration.oab_number || '/' || registration.oab_state,
  registration.status not in ('disabled', 'invalid')
from public.lawyer_registrations registration
on conflict (tenant_id, source_kind, provider, reference) do nothing;

insert into public.legal_sync_sources (
  tenant_id,
  source_kind,
  provider,
  process_id,
  reference,
  active
)
select
  process.tenant_id,
  'process',
  'datajud',
  process.id,
  substring(digits.value from 1 for 7) || '-' ||
  substring(digits.value from 8 for 2) || '.' ||
  substring(digits.value from 10 for 4) || '.' ||
  substring(digits.value from 14 for 1) || '.' ||
  substring(digits.value from 15 for 2) || '.' ||
  substring(digits.value from 17 for 4),
  true
from public.processos process
cross join lateral (
  select regexp_replace(coalesce(process.numero, ''), '[^0-9]', '', 'g') as value
) as digits
where process.tenant_id is not null
  and length(digits.value) = 20
on conflict (tenant_id, source_kind, provider, reference) do nothing;

alter table public.legal_sync_sources enable row level security;

create policy legal_sync_sources_tenant_read
on public.legal_sync_sources
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

revoke all privileges on table public.legal_sync_sources
from anon, authenticated;

grant select on table public.legal_sync_sources to authenticated;

grant all privileges on table public.legal_sync_sources to service_role;

revoke all on function private.sync_source_for_lawyer_registration()
from public, anon, authenticated;
revoke all on function private.sync_source_for_processo()
from public, anon, authenticated;

comment on table public.legal_sync_sources is
  'Fontes monitoradas por escritório: OABs no Escavador e processos no DataJud.';

comment on column public.legal_sync_sources.failure_count is
  'Falhas consecutivas; após cinco a fonte é interrompida e exibida no painel.';

commit;
