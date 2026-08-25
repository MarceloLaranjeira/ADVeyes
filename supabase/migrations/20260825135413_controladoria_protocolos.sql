-- Controladoria Jurídica: protocolo como registro próprio, marcador de prazo
-- e ciência da intimação.
--
-- Nada migra: prazo continua sendo `tarefas`, distinguido por `tipo`.

begin;

-- ---------------------------------------------------------------------------
-- 1. Protocolos
-- ---------------------------------------------------------------------------

create table public.protocolos (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete set null,
  numero_processo text,
  tipo text not null check (tipo in (
    'peticao', 'contestacao', 'recurso', 'apelacao',
    'embargos', 'manifestacao', 'cumprimento', 'outro'
  )),
  descricao text,
  protocolado_em timestamptz not null default now(),
  protocolo_numero text,
  responsavel_id uuid references auth.users(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  observacoes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Um protocolo sem processo identificado não serve para controle nenhum.
  constraint protocolos_processo_identificado check (
    processo_id is not null or numero_processo is not null
  )
);

create index protocolos_tenant_data_idx
  on public.protocolos (tenant_id, protocolado_em desc);

create index protocolos_processo_idx
  on public.protocolos (tenant_id, processo_id);

create index protocolos_tarefa_idx
  on public.protocolos (tarefa_id)
  where tarefa_id is not null;

drop trigger if exists protocolos_touch_updated_at on public.protocolos;
create trigger protocolos_touch_updated_at
  before update on public.protocolos
  for each row execute function public.touch_updated_at();

-- A visibilidade é a mesma das tabelas irmãs do módulo jurídico. Restrição
-- por registro foi removida do módulo de propósito em
-- 20260807210000_processos_tarefas_tenant_rls.sql; divergir aqui criaria a
-- única tabela invisível para quem foi convidado ontem.
alter table public.protocolos enable row level security;

create policy tenant_read on public.protocolos
  for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

revoke all on public.protocolos from public, anon;
grant select on public.protocolos to authenticated;
grant all on public.protocolos to service_role;

-- ---------------------------------------------------------------------------
-- 2. Acréscimos às tabelas existentes
-- ---------------------------------------------------------------------------

-- Sem marcador, um prazo é indistinguível de "ligar para o cliente".
alter table public.tarefas
  add column if not exists tipo text not null default 'tarefa';

alter table public.tarefas
  drop constraint if exists tarefas_tipo_check,
  add constraint tarefas_tipo_check check (tipo in ('tarefa', 'prazo'));

create index if not exists tarefas_tenant_tipo_idx
  on public.tarefas (tenant_id, tipo, status, data_limite);

alter table public.documentos
  add column if not exists protocolo_id uuid
    references public.protocolos(id) on delete set null;

create index if not exists documentos_protocolo_idx
  on public.documentos (protocolo_id)
  where protocolo_id is not null;

-- `review_status` é a triagem do sistema; ciência é ato do escritório.
alter table public.publicacoes
  add column if not exists ciencia_em timestamptz,
  add column if not exists ciencia_por uuid references auth.users(id) on delete set null;

create index if not exists publicacoes_sem_ciencia_idx
  on public.publicacoes (tenant_id, data_publicacao desc)
  where ciencia_em is null;

-- ---------------------------------------------------------------------------
-- 3. Registro de protocolo: uma operação, uma transação
-- ---------------------------------------------------------------------------

create or replace function public.register_protocol(
  p_tenant_id uuid,
  p_tipo text,
  p_protocolado_em timestamptz,
  p_processo_id uuid default null,
  p_numero_processo text default null,
  p_protocolo_numero text default null,
  p_descricao text default null,
  p_observacoes text default null,
  p_responsavel_id uuid default null,
  p_tarefa_id uuid default null
)
returns public.protocolos
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  novo public.protocolos;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  if not private.has_tenant_permission(p_tenant_id, 'legal', 'create') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_processo_id is not null and not exists (
    select 1 from public.processos
    where id = p_processo_id and tenant_id = p_tenant_id
  ) then
    raise exception 'processo_not_found' using errcode = 'P0002';
  end if;

  if p_tarefa_id is not null and not exists (
    select 1 from public.tarefas
    where id = p_tarefa_id and tenant_id = p_tenant_id
  ) then
    raise exception 'tarefa_not_found' using errcode = 'P0002';
  end if;

  insert into public.protocolos (
    tenant_id, processo_id, numero_processo, tipo, descricao,
    protocolado_em, protocolo_numero, responsavel_id, tarefa_id,
    observacoes, created_by
  ) values (
    p_tenant_id, p_processo_id, p_numero_processo, p_tipo, p_descricao,
    coalesce(p_protocolado_em, now()), p_protocolo_numero,
    p_responsavel_id, p_tarefa_id, p_observacoes, auth.uid()
  )
  returning * into novo;

  -- "Protocolado" não é status: é o prazo concluído com o ato registrado.
  -- As duas escritas vivem na mesma transação de propósito.
  if p_tarefa_id is not null then
    update public.tarefas
      set status = 'concluída'
      where id = p_tarefa_id and tenant_id = p_tenant_id;
  end if;

  return novo;
end;
$$;

revoke all on function public.register_protocol(
  uuid, text, timestamptz, uuid, text, text, text, text, uuid, uuid
) from public, anon;

grant execute on function public.register_protocol(
  uuid, text, timestamptz, uuid, text, text, text, text, uuid, uuid
) to authenticated, service_role;

commit;
