-- Metadados oficiais do DJEN usados para conferência, certidão e cancelamento.

begin;

alter table public.publicacoes
  add column if not exists available_on date,
  add column if not exists djen_hash text,
  add column if not exists communication_number text,
  add column if not exists document_type text,
  add column if not exists process_class text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

alter table public.publicacoes
  drop constraint if exists publicacoes_status_check;
alter table public.publicacoes
  add constraint publicacoes_status_check
  check (status in ('nova', 'lida', 'urgente', 'processada', 'cancelada'));

update public.publicacoes
set
  available_on = coalesce(
    available_on,
    nullif(provider_payload ->> 'data_disponibilizacao', '')::date,
    nullif(provider_payload ->> 'datadisponibilizacao', '')::date,
    data_publicacao::date
  ),
  djen_hash = coalesce(djen_hash, nullif(provider_payload ->> 'hash', '')),
  communication_number = coalesce(
    communication_number,
    nullif(provider_payload ->> 'numeroComunicacao', ''),
    nullif(provider_payload ->> 'numero_comunicacao', '')
  ),
  document_type = coalesce(document_type, nullif(provider_payload ->> 'tipoDocumento', '')),
  process_class = coalesce(process_class, nullif(provider_payload ->> 'nomeClasse', ''))
where provider = 'djen';

-- Listas de distribuição e atas são informações oficiais importantes, mas não
-- devem ser misturadas com a fila de intimações nem criar prazo por padrão.
update public.publicacoes
set
  review_status = 'no_deadline',
  possible_deadline = false,
  status = case when status = 'urgente' then 'nova' else status end,
  updated_at = now()
where provider = 'djen'
  and review_status = 'pending_review'
  and lower(coalesce(communication_type, tipo, '')) ~ '^(lista|ata)';

-- Conexões legadas sem credencial no Vault não podem ser tratadas como
-- conectadas nem como senha recusada. Elas precisam pedir uma nova conexão.
update public.legal_portal_connections
set
  status = 'pending',
  last_error_code = 'credential_missing',
  last_error_at = now(),
  last_result = jsonb_build_object(
    'code', 'credential_missing',
    'message', 'A credencial protegida não está disponível. Reconecte o acesso ao tribunal.'
  ),
  updated_at = now()
where vault_secret_id is null
  and last_validated_at is null
  and status in ('active', 'invalid', 'validating');

create index if not exists publicacoes_tenant_djen_hash_idx
  on public.publicacoes (tenant_id, djen_hash)
  where provider = 'djen' and djen_hash is not null;

create index if not exists publicacoes_tenant_communication_number_idx
  on public.publicacoes (tenant_id, communication_number)
  where provider = 'djen' and communication_number is not null;

comment on column public.publicacoes.available_on is
  'Data de disponibilização informada pelo provedor; não equivale automaticamente ao início do prazo.';
comment on column public.publicacoes.djen_hash is
  'Hash oficial da comunicação, usado para consultar a certidão pública do DJEN.';
comment on column public.publicacoes.cancelled_at is
  'Data em que o DJEN informou o cancelamento da comunicação.';

commit;
