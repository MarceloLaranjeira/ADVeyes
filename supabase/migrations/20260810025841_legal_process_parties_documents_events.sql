begin;

-- Processo: metadados oficiais e estado de sincronização.
alter table public.processos
  add column if not exists tribunal text,
  add column if not exists class_code text,
  add column if not exists class_name text,
  add column if not exists subjects jsonb not null default '[]'::jsonb,
  add column if not exists adjudicating_body text,
  add column if not exists procedural_system text,
  add column if not exists court_level text,
  add column if not exists public_secrecy_level integer,
  add column if not exists legal_sync_status text not null default 'pending',
  add column if not exists last_legal_sync_at timestamptz,
  add column if not exists legal_data_source text,
  add column if not exists legal_metadata jsonb not null default '{}'::jsonb;

alter table public.processos
  drop constraint if exists processos_subjects_array_check,
  add constraint processos_subjects_array_check
    check (jsonb_typeof(subjects) = 'array'),
  drop constraint if exists processos_legal_metadata_object_check,
  add constraint processos_legal_metadata_object_check
    check (jsonb_typeof(legal_metadata) = 'object'),
  drop constraint if exists processos_public_secrecy_level_check,
  add constraint processos_public_secrecy_level_check
    check (public_secrecy_level is null or public_secrecy_level between 0 and 5),
  drop constraint if exists processos_legal_sync_status_check,
  add constraint processos_legal_sync_status_check
    check (legal_sync_status in ('pending', 'syncing', 'synced', 'partial', 'failed', 'paused'));

-- Contato canônico. Cadastros existentes são considerados manuais e ficam
-- protegidos contra sobrescrita automática.
alter table public.clientes
  add column if not exists normalized_name text,
  add column if not exists person_type text,
  add column if not exists relationship_type text not null default 'cliente',
  add column if not exists source_provider text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists document_hash text,
  add column if not exists classification_locked boolean not null default true,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

update public.clientes
set normalized_name = upper(
  regexp_replace(
    upper(translate(nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')),
    '[^A-Z0-9]+', ' ', 'g'
  )
)
where normalized_name is null;

alter table public.clientes
  drop constraint if exists clientes_person_type_check,
  add constraint clientes_person_type_check
    check (person_type is null or person_type in ('pessoa_fisica', 'pessoa_juridica', 'orgao_publico', 'desconhecido')),
  drop constraint if exists clientes_relationship_type_check,
  add constraint clientes_relationship_type_check
    check (relationship_type in ('cliente', 'parte_contraria', 'terceiro')),
  drop constraint if exists clientes_source_metadata_object_check,
  add constraint clientes_source_metadata_object_check
    check (jsonb_typeof(source_metadata) = 'object'),
  add constraint clientes_tenant_id_id_key unique (tenant_id, id);

create index if not exists clientes_tenant_normalized_name_idx
  on public.clientes (tenant_id, normalized_name, person_type);
create unique index if not exists clientes_tenant_provider_external_unique
  on public.clientes (tenant_id, source_provider, external_id)
  where external_id is not null;
create index if not exists clientes_tenant_document_hash_idx
  on public.clientes (tenant_id, document_hash)
  where document_hash is not null;

-- Partes processuais, separadas do contato canônico.
create table public.process_parties (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  contact_id uuid,
  display_name text not null check (length(btrim(display_name)) > 0),
  normalized_name text not null check (length(btrim(normalized_name)) > 0),
  person_type text not null default 'desconhecido' check (
    person_type in ('pessoa_fisica', 'pessoa_juridica', 'orgao_publico', 'desconhecido')
  ),
  document_masked text,
  document_hash text,
  side text not null default 'desconhecido' check (
    side in ('ativo', 'passivo', 'interessado', 'terceiro', 'desconhecido')
  ),
  procedural_role text,
  internal_classification text not null default 'terceiro' check (
    internal_classification in ('cliente', 'parte_contraria', 'terceiro')
  ),
  classification_locked boolean not null default false,
  related_lawyers jsonb not null default '[]'::jsonb check (
    jsonb_typeof(related_lawyers) = 'array'
  ),
  provider text not null check (provider in ('datajud', 'djen', 'escavador', 'manual', 'legacy')),
  external_id text,
  identity_hash text not null,
  source_references jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_references) = 'object'
  ),
  provider_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provider_payload) = 'object'
  ),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id)
    references public.clientes(tenant_id, id) on delete set null (contact_id)
);

create unique index process_parties_provider_external_unique
  on public.process_parties (tenant_id, process_id, provider, external_id)
  where external_id is not null;
create unique index process_parties_identity_unique
  on public.process_parties (tenant_id, process_id, identity_hash);
create index process_parties_contact_idx
  on public.process_parties (tenant_id, contact_id);
create index process_parties_process_classification_idx
  on public.process_parties (tenant_id, process_id, internal_classification);

-- Andamentos: detalhes normalizados e ligação com documentos públicos.
alter table public.process_movements
  add column if not exists tpu_code text,
  add column if not exists description text,
  add column if not exists complements jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists origin_system text,
  add column if not exists document_type text,
  add column if not exists full_text_available boolean not null default false,
  add column if not exists document_url text,
  add column if not exists content_hash text,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.process_movements
set content_hash = md5(
  tenant_id::text || ':' || process_id::text || ':' || provider || ':' ||
  external_id || ':' || coalesce(occurred_at::text, '') || ':' || content
)
where content_hash is null;

alter table public.process_movements
  drop constraint if exists process_movements_complements_array_check,
  add constraint process_movements_complements_array_check
    check (jsonb_typeof(complements) = 'array'),
  drop constraint if exists process_movements_provenance_object_check,
  add constraint process_movements_provenance_object_check
    check (jsonb_typeof(provenance) = 'object'),
  add constraint process_movements_tenant_id_id_key unique (tenant_id, id);

create index if not exists process_movements_content_hash_idx
  on public.process_movements (tenant_id, process_id, content_hash);
create index if not exists process_movements_tpu_time_idx
  on public.process_movements (tenant_id, process_id, tpu_code, occurred_at desc);

drop trigger if exists process_movements_touch_updated_at on public.process_movements;
create trigger process_movements_touch_updated_at
before update on public.process_movements
for each row execute function private.touch_tenant_updated_at();

-- Documentos públicos encontrados nas fontes. O payload bruto não é concedido
-- ao papel authenticated.
create table public.process_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  movement_id uuid,
  document_type text,
  title text not null,
  text_content text,
  official_url text,
  complementary_url text,
  provider text not null check (provider in ('datajud', 'djen', 'escavador', 'manual', 'legacy')),
  external_id text,
  content_hash text not null,
  occurred_at timestamptz,
  mime_type text,
  availability_status text not null default 'unavailable' check (
    availability_status in ('available', 'link_only', 'unavailable', 'restricted')
  ),
  is_public boolean not null default true,
  source_type text,
  source_id text,
  source_references jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_references) = 'object'
  ),
  provenance jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provenance) = 'object'
  ),
  provider_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(provider_payload) = 'object'
  ),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  foreign key (tenant_id, movement_id)
    references public.process_movements(tenant_id, id) on delete set null (movement_id),
  constraint process_documents_public_restriction_check check (
    is_public or text_content is null
  )
);

create unique index process_documents_provider_external_unique
  on public.process_documents (tenant_id, process_id, provider, external_id)
  where external_id is not null;
create unique index process_documents_content_hash_unique
  on public.process_documents (tenant_id, process_id, content_hash);
create index process_documents_process_time_idx
  on public.process_documents (tenant_id, process_id, occurred_at desc);

create trigger process_documents_touch_updated_at
before update on public.process_documents
for each row execute function private.touch_tenant_updated_at();

-- Divergências entre fonte oficial e complementar ficam explícitas para
-- reconciliação; nunca há sobrescrita silenciosa.
create table public.legal_data_conflicts (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  entity_type text not null check (
    entity_type in ('process', 'party', 'movement', 'document', 'publication', 'hearing', 'contact')
  ),
  entity_id uuid,
  field_name text not null,
  official_provider text not null check (official_provider in ('datajud', 'djen')),
  official_value jsonb,
  complementary_provider text not null default 'escavador' check (
    complementary_provider in ('escavador', 'manual', 'legacy')
  ),
  complementary_value jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'resolved_official', 'resolved_manual', 'dismissed')
  ),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  constraint legal_data_conflicts_resolution_check check (
    (status = 'pending' and resolved_by is null and resolved_at is null)
    or
    (status <> 'pending' and resolved_at is not null)
  )
);

create unique index legal_data_conflicts_open_unique
  on public.legal_data_conflicts (
    tenant_id, process_id, entity_type,
    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    field_name, official_provider, complementary_provider
  )
  where status = 'pending';

create index legal_data_conflicts_tenant_status_idx
  on public.legal_data_conflicts (tenant_id, status, created_at desc);

create trigger legal_data_conflicts_touch_updated_at
before update on public.legal_data_conflicts
for each row execute function private.touch_tenant_updated_at();

-- Comunicações oficiais e candidatos a audiência.
alter table public.publicacoes
  add column if not exists communication_type text,
  add column if not exists recipients jsonb not null default '[]'::jsonb,
  add column if not exists recipient_lawyers jsonb not null default '[]'::jsonb,
  add column if not exists court_body text,
  add column if not exists hearing_evidence text,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

alter table public.publicacoes
  drop constraint if exists publicacoes_recipients_array_check,
  add constraint publicacoes_recipients_array_check
    check (jsonb_typeof(recipients) = 'array'),
  drop constraint if exists publicacoes_recipient_lawyers_array_check,
  add constraint publicacoes_recipient_lawyers_array_check
    check (jsonb_typeof(recipient_lawyers) = 'array'),
  drop constraint if exists publicacoes_provenance_object_check,
  add constraint publicacoes_provenance_object_check
    check (jsonb_typeof(provenance) = 'object');

alter table public.audiencias
  add column if not exists source_provider text not null default 'manual',
  add column if not exists external_id text,
  add column if not exists publication_id uuid,
  add column if not exists movement_id uuid,
  add column if not exists extraction_confidence numeric(5,4),
  add column if not exists source_evidence text,
  add column if not exists review_status text not null default 'confirmed',
  add column if not exists detected_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.audiencias
  drop constraint if exists audiencias_source_provider_check,
  add constraint audiencias_source_provider_check
    check (source_provider in ('djen', 'datajud', 'escavador', 'manual', 'legacy')),
  drop constraint if exists audiencias_extraction_confidence_check,
  add constraint audiencias_extraction_confidence_check
    check (extraction_confidence is null or extraction_confidence between 0 and 1),
  drop constraint if exists audiencias_review_status_check,
  add constraint audiencias_review_status_check
    check (review_status in ('pending', 'confirmed', 'corrected', 'dismissed')),
  add constraint audiencias_tenant_id_id_key unique (tenant_id, id),
  add constraint audiencias_publication_tenant_fkey
    foreign key (tenant_id, publication_id)
    references public.publicacoes(tenant_id, id) on delete set null (publication_id),
  add constraint audiencias_movement_tenant_fkey
    foreign key (tenant_id, movement_id)
    references public.process_movements(tenant_id, id) on delete set null (movement_id);

create unique index if not exists audiencias_provider_external_unique
  on public.audiencias (tenant_id, source_provider, external_id)
  where external_id is not null;
create index if not exists audiencias_tenant_review_time_idx
  on public.audiencias (tenant_id, review_status, data_hora);

drop trigger if exists audiencias_touch_updated_at on public.audiencias;
create trigger audiencias_touch_updated_at
before update on public.audiencias
for each row execute function private.touch_tenant_updated_at();

-- RLS e privilégios explícitos: grant controla quais objetos/colunas chegam à
-- Data API; RLS controla quais linhas do tenant podem ser lidas/alteradas.
alter table public.process_parties enable row level security;
alter table public.process_documents enable row level security;
alter table public.legal_data_conflicts enable row level security;

create policy process_parties_tenant_read
on public.process_parties
for select to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
);

create policy process_parties_tenant_classify
on public.process_parties
for update to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
)
with check (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
);

create policy process_documents_tenant_read
on public.process_documents
for select to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
  and is_public
);

create policy legal_data_conflicts_tenant_read
on public.legal_data_conflicts
for select to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
);

create policy legal_data_conflicts_tenant_resolve
on public.legal_data_conflicts
for update to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
)
with check (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.can_access_tenant_record(
    auth.uid(), tenant_id, 'processos', process_id
  )
);

revoke all privileges on table
  public.process_parties,
  public.process_documents,
  public.legal_data_conflicts
from public, anon, authenticated;

grant select (
  id, tenant_id, process_id, contact_id, display_name, normalized_name,
  person_type, document_masked, side, procedural_role,
  internal_classification, classification_locked, related_lawyers, provider,
  external_id, identity_hash, source_references, first_seen_at, last_seen_at,
  created_at, updated_at
) on public.process_parties to authenticated;

grant update (
  contact_id, internal_classification, classification_locked, updated_at
) on public.process_parties to authenticated;

grant select (
  id, tenant_id, process_id, movement_id, document_type, title, text_content,
  official_url, complementary_url, provider, external_id, content_hash,
  occurred_at, mime_type, availability_status, is_public, source_type,
  source_id, source_references, provenance, fetched_at, created_at, updated_at
) on public.process_documents to authenticated;

grant select on table public.legal_data_conflicts to authenticated;
grant update (status, resolved_by, resolved_at, updated_at)
  on public.legal_data_conflicts to authenticated;

grant all privileges on table
  public.process_parties,
  public.process_documents,
  public.legal_data_conflicts
to service_role;

comment on table public.process_parties is
  'Partes processuais normalizadas; correções humanas bloqueadas contra sobrescrita automática.';
comment on column public.process_parties.provider_payload is
  'Payload bruto de provedor, acessível somente ao backend service_role.';
comment on table public.process_documents is
  'Metadados e texto de documentos estritamente públicos associados a processos.';
comment on column public.process_documents.provider_payload is
  'Payload bruto de provedor, acessível somente ao backend service_role.';

commit;
