-- Separate procedural movements from legal publications.
-- DataJud remains an official source for process metadata/movements only.
-- Publications are accepted from Escavador, manual review, or legacy imports.

begin;

alter table public.publicacoes
  add column process_id uuid,
  add column provider text not null default 'legacy',
  add column external_id text,
  add column content_hash text,
  add column origin_system text not null default 'unknown',
  add column source_name text,
  add column source_url text,
  add column provider_payload jsonb not null default '{}'::jsonb,
  add column review_status text not null default 'pending_review',
  add column possible_deadline boolean not null default false,
  add column updated_at timestamptz not null default now();

alter table public.publicacoes
  add constraint publicacoes_tenant_id_id_key unique (tenant_id, id),
  add constraint publicacoes_process_tenant_fkey
    foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id)
    on delete set null (process_id),
  add constraint publicacoes_provider_check
    check (provider in ('escavador', 'manual', 'legacy')),
  add constraint publicacoes_origin_system_check
    check (origin_system in ('pje', 'projudi', 'seeu', 'dje', 'other', 'unknown')),
  add constraint publicacoes_review_status_check
    check (review_status in ('pending_review', 'reviewed', 'dismissed', 'no_deadline')),
  add constraint publicacoes_provider_payload_object_check
    check (jsonb_typeof(provider_payload) = 'object');

update public.publicacoes
set content_hash = md5(
  coalesce(tenant_id::text, '') || ':' ||
  coalesce(numero_processo, '') || ':' ||
  coalesce(data_publicacao::text, '') || ':' ||
  conteudo || ':' ||
  id::text
)
where content_hash is null;

alter table public.publicacoes
  alter column tenant_id set not null,
  alter column content_hash set not null;

create unique index publicacoes_provider_external_unique
  on public.publicacoes (tenant_id, provider, external_id);

create unique index publicacoes_tenant_content_hash_unique
  on public.publicacoes (tenant_id, content_hash);

create index publicacoes_tenant_review_time_idx
  on public.publicacoes (tenant_id, review_status, data_publicacao desc);

create index publicacoes_tenant_process_time_idx
  on public.publicacoes (tenant_id, process_id, data_publicacao desc);

-- Move any publications previously stored as movements to their canonical table.
insert into public.publicacoes (
  tenant_id,
  user_id,
  process_id,
  tipo,
  tribunal,
  numero_processo,
  cliente_nome,
  data_publicacao,
  conteudo,
  conteudo_simplificado,
  status,
  provider,
  external_id,
  content_hash,
  origin_system,
  source_name,
  source_url,
  provider_payload,
  review_status,
  possible_deadline
)
select
  movement.tenant_id,
  process.user_id,
  movement.process_id,
  'intimacao',
  coalesce(movement.source_name, 'Não identificado'),
  process.numero,
  process.cliente_nome,
  coalesce(movement.occurred_at, movement.created_at),
  movement.content,
  movement.title,
  'nova',
  case when movement.provider = 'escavador' then 'escavador' else 'legacy' end,
  movement.provider || ':' || movement.external_id,
  md5(
    movement.tenant_id::text || ':' ||
    movement.process_id::text || ':' ||
    movement.provider || ':' ||
    movement.external_id || ':' ||
    movement.content
  ),
  case
    when lower(coalesce(movement.source_name, '') || ' ' || movement.content) like '%projudi%'
      then 'projudi'
    when lower(coalesce(movement.source_name, '') || ' ' || movement.content) like '%seeu%'
      then 'seeu'
    when lower(coalesce(movement.source_name, '') || ' ' || movement.content) like '%pje%'
      then 'pje'
    when lower(coalesce(movement.source_name, '')) like '%diário%'
      or lower(coalesce(movement.source_name, '')) like '%diario%'
      then 'dje'
    else 'unknown'
  end,
  movement.source_name,
  movement.source_url,
  movement.provider_payload,
  'pending_review',
  false
from public.process_movements movement
join public.processos process
  on process.tenant_id = movement.tenant_id
 and process.id = movement.process_id
where movement.movement_type = 'PUBLICACAO'
on conflict do nothing;

delete from public.process_movements
where movement_type = 'PUBLICACAO';

alter table public.process_movements
  drop constraint if exists process_movements_movement_type_check;

alter table public.process_movements
  add constraint process_movements_movement_type_check
    check (movement_type in ('ANDAMENTO', 'DOCUMENTO'));

alter table public.legal_provider_monitors
  add column next_sync_at timestamptz,
  add column sync_cursor text,
  add column last_success_at timestamptz;

create table public.legal_sync_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('escavador', 'datajud')),
  sync_kind text not null check (
    sync_kind in ('discovery', 'movement', 'publication', 'reconciliation')
  ),
  trigger_type text not null default 'scheduled' check (
    trigger_type in ('scheduled', 'manual', 'webhook')
  ),
  status text not null default 'running' check (
    status in ('running', 'succeeded', 'partial', 'failed')
  ),
  records_received integer not null default 0 check (records_received >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_ignored integer not null default 0 check (records_ignored >= 0),
  cursor_before text,
  cursor_after text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table public.deadline_suggestions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  publication_id uuid not null,
  proposed_date timestamptz,
  proposed_days integer check (proposed_days is null or proposed_days > 0),
  reason text not null,
  evidence text,
  status text not null default 'pending' check (
    status in ('pending', 'confirmed', 'rejected')
  ),
  confirmed_task_id uuid,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, publication_id),
  foreign key (tenant_id, publication_id)
    references public.publicacoes(tenant_id, id)
    on delete cascade,
  constraint deadline_suggestions_review_valid check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (status in ('confirmed', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

alter table public.tarefas
  add constraint tarefas_tenant_id_id_key unique (tenant_id, id);

alter table public.deadline_suggestions
  add constraint deadline_suggestions_task_tenant_fkey
    foreign key (tenant_id, confirmed_task_id)
    references public.tarefas(tenant_id, id)
    on delete set null (confirmed_task_id);

create index legal_sync_runs_tenant_time_idx
  on public.legal_sync_runs (tenant_id, started_at desc);

create index deadline_suggestions_tenant_status_idx
  on public.deadline_suggestions (tenant_id, status, created_at desc);

create trigger publicacoes_touch_updated_at
before update on public.publicacoes
for each row execute function private.touch_tenant_updated_at();

create trigger deadline_suggestions_touch_updated_at
before update on public.deadline_suggestions
for each row execute function private.touch_tenant_updated_at();

alter table public.legal_sync_runs enable row level security;
alter table public.deadline_suggestions enable row level security;

create policy legal_sync_runs_tenant_read
on public.legal_sync_runs
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy deadline_suggestions_tenant_read
on public.deadline_suggestions
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

revoke all privileges
on table
  public.legal_sync_runs,
  public.deadline_suggestions
from anon, authenticated;

grant select
on table
  public.legal_sync_runs,
  public.deadline_suggestions
to authenticated;

grant all privileges
on table
  public.legal_sync_runs,
  public.deadline_suggestions
to service_role;

comment on table public.publicacoes is
  'Publicações e intimações judiciais. Nunca recebe andamentos do DataJud.';

comment on table public.process_movements is
  'Andamentos e documentos processuais; publicações ficam em publicacoes.';

comment on table public.deadline_suggestions is
  'Sugestões de prazo que exigem confirmação humana antes de gerar tarefa.';

commit;
