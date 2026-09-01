begin;

alter table public.processos
  add column if not exists procedural_system_code text,
  add column if not exists procedural_system_conflict boolean not null default false;

alter table public.audiencias
  add column if not exists source_updated_at timestamptz,
  add column if not exists event_timezone text,
  add column if not exists ends_at timestamptz,
  add column if not exists modality text,
  add column if not exists remote_url text,
  add column if not exists event_status text not null default 'scheduled',
  add column if not exists court_code text,
  add column if not exists source_references jsonb not null default '{}'::jsonb,
  add column if not exists manual_locked boolean not null default false;

alter table public.audiencias
  drop constraint if exists audiencias_event_status_check,
  add constraint audiencias_event_status_check
    check (event_status in ('scheduled', 'rescheduled', 'cancelled', 'completed', 'unknown')),
  drop constraint if exists audiencias_modality_check,
  add constraint audiencias_modality_check
    check (modality is null or modality in ('presential', 'remote', 'hybrid', 'unknown')),
  drop constraint if exists audiencias_source_references_object_check,
  add constraint audiencias_source_references_object_check
    check (jsonb_typeof(source_references) = 'object');

create table public.legal_hearing_signals (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  movement_id uuid,
  publication_id uuid,
  source_provider text not null
    check (source_provider in ('datajud', 'djen', 'escavador', 'manual', 'legacy')),
  external_id text not null,
  signal_kind text not null check (signal_kind in ('scheduled', 'review')),
  event_type text not null,
  event_status text not null default 'unknown'
    check (event_status in ('scheduled', 'rescheduled', 'cancelled', 'completed', 'unknown')),
  starts_at timestamptz,
  timezone text,
  evidence text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'corrected', 'dismissed')),
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, source_provider, external_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  foreign key (tenant_id, movement_id)
    references public.process_movements(tenant_id, id) on delete cascade,
  foreign key (tenant_id, publication_id)
    references public.publicacoes(tenant_id, id) on delete cascade,
  constraint legal_hearing_signal_schedule_check check (
    (signal_kind = 'scheduled' and starts_at is not null)
    or (signal_kind = 'review' and starts_at is null)
  )
);

create index legal_hearing_signals_review_idx
  on public.legal_hearing_signals (tenant_id, review_status, created_at desc);
create index legal_hearing_signals_process_idx
  on public.legal_hearing_signals (tenant_id, process_id, starts_at);

drop trigger if exists legal_hearing_signals_touch_updated_at
on public.legal_hearing_signals;
create trigger legal_hearing_signals_touch_updated_at
before update on public.legal_hearing_signals
for each row execute function private.touch_tenant_updated_at();

alter table public.legal_hearing_signals enable row level security;
revoke all on public.legal_hearing_signals from public, anon, authenticated;
grant select, update on public.legal_hearing_signals to authenticated;
grant all on public.legal_hearing_signals to service_role;

create policy legal_hearing_signals_tenant_read
on public.legal_hearing_signals
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy legal_hearing_signals_tenant_review
on public.legal_hearing_signals
for update to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

-- Movimentos históricos sem data/hora comprovadas entram somente na fila de
-- revisão. A data da movimentação não é reutilizada como data da audiência.
insert into public.legal_hearing_signals (
  tenant_id,
  process_id,
  movement_id,
  source_provider,
  external_id,
  signal_kind,
  event_type,
  event_status,
  starts_at,
  timezone,
  evidence,
  confidence,
  review_status,
  source_metadata
)
select
  movement.tenant_id,
  movement.process_id,
  movement.id,
  movement.provider,
  'movimento:' || movement.id::text,
  'review',
  case
    when concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
      ~* 'sess[ãa]o[[:space:]]+de[[:space:]]+julgamento'
      then 'Sessão de julgamento'
    else 'Audiência'
  end,
  case
    when concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
      ~* 'cancelad|desmarcad' then 'cancelled'
    when concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
      ~* 'realizad' then 'completed'
    when concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
      ~* 'redesignad|remarcad' then 'rescheduled'
    when concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
      ~* 'designad|agendad|marcad' then 'scheduled'
    else 'unknown'
  end,
  null,
  coalesce(court.timezone, 'America/Sao_Paulo'),
  left(concat_ws(E'\n', movement.title, movement.content, movement.description, movement.notes), 1000),
  0.55,
  'pending',
  jsonb_build_object(
    'source_name', movement.source_name,
    'movement_external_id', movement.external_id,
    'movement_occurred_at', movement.occurred_at,
    'backfilled_at', now()
  )
from public.process_movements movement
join public.processos process
  on process.tenant_id = movement.tenant_id
 and process.id = movement.process_id
left join public.legal_court_registry court
  on court.court_code = upper(process.tribunal)
where movement.provider = 'datajud'
  and concat_ws(' ', movement.title, movement.content, movement.description, movement.notes)
    ~* '(audi[êe]ncia|sess[ãa]o[[:space:]]+de[[:space:]]+julgamento)'
on conflict (tenant_id, source_provider, external_id) do nothing;

-- Runs abandonados pelo runtime deixam de bloquear a fila.
update public.legal_sync_runs
set
  status = 'failed',
  finished_at = coalesce(finished_at, now()),
  error_code = coalesce(error_code, 'worker_interrupted'),
  error_message = coalesce(error_message, 'Execução interrompida; fonte devolvida para nova tentativa.')
where status = 'running'
  and started_at < now() - interval '30 minutes';

commit;
