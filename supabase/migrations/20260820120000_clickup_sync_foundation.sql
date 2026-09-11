-- Ponte ADVeyes -> ClickUp.
--
-- O ClickUp é superfície de trabalho, não fonte da verdade: o escritório
-- enxerga e movimenta a carteira lá, mas o dado processual continua vivendo
-- aqui. Se o board for apagado, ele se reconstrói a partir destas tabelas.
--
-- A forma é deliberadamente a mesma do sync do Google Calendar, que já roda em
-- produção: fila com retry e lock, tabela de vínculo com hash de payload, e um
-- worker acionado por pg_cron. A API do ClickUp não tem upsert — criar e
-- atualizar são chamadas distintas —, então é o vínculo em clickup_task_links
-- que impede um retry de duplicar card.

-- ---------------------------------------------------------------------------
-- Segredo de justiça
-- ---------------------------------------------------------------------------

-- Processo em segredo de justiça não sai desta base. O ClickUp é servidor de
-- terceiro, fora do país e fora do controle do escritório; espelhar autos
-- restritos lá violaria o sigilo que o próprio juízo impôs. A coluna é
-- avaliada no enfileiramento, antes de o job existir — nunca no worker, onde
-- um erro de lógica já teria vazado o dado.
alter table public.processos
  add column if not exists segredo_justica boolean not null default false;

comment on column public.processos.segredo_justica is
  'Impede o espelhamento do processo em integrações externas (ClickUp). '
  'Avaliado em public.enqueue_clickup_sync antes do job ser criado.';

-- ---------------------------------------------------------------------------
-- Conexão por tenant
-- ---------------------------------------------------------------------------

create table public.clickup_connections (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  -- Workspace do próprio escritório: o dado fica com quem é dono dele, e a
  -- cota de rate limit é individual em vez de compartilhada entre clientes.
  workspace_id text not null check (length(btrim(workspace_id)) > 0),
  space_id text not null check (length(btrim(space_id)) > 0),
  encrypted_token text not null,
  template_version text not null default 'v1',
  -- nome lógico do campo -> field_id do ClickUp. A API não expõe criação de
  -- custom field, então os campos nascem de um Space-modelo clonado e os ids
  -- são descobertos uma vez, na conexão.
  field_map jsonb not null default '{}'::jsonb check (
    jsonb_typeof(field_map) = 'object'
  ),
  -- área do processo -> list_id.
  list_map jsonb not null default '{}'::jsonb check (
    jsonb_typeof(list_map) = 'object'
  ),
  status text not null default 'active' check (
    status in ('active', 'paused', 'revoked')
  ),
  last_error_code text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clickup_connections is
  'Conexão ClickUp de um escritório. Revogar é mudar status para revoked: '
  'o enfileiramento para imediatamente, sem tocar no que já foi espelhado.';

-- ---------------------------------------------------------------------------
-- Fila de saída
-- ---------------------------------------------------------------------------

create table public.clickup_sync_queue (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (
    entity_type in ('processo', 'prazo', 'audiencia', 'movimentacao', 'tarefa')
  ),
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  snapshot jsonb not null default '{}'::jsonb check (
    jsonb_typeof(snapshot) = 'object'
  ),
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'retry', 'completed', 'failed')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Colapsa rajadas: 40 movimentações do mesmo processo viram um job só.
  constraint clickup_sync_queue_entity_key
    unique (tenant_id, entity_type, entity_id)
);

create index clickup_sync_queue_ready_idx
  on public.clickup_sync_queue (next_attempt_at)
  where status in ('pending', 'retry');

create index clickup_sync_queue_tenant_idx
  on public.clickup_sync_queue (tenant_id, status);

-- ---------------------------------------------------------------------------
-- Vínculo
-- ---------------------------------------------------------------------------

create table public.clickup_task_links (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  clickup_task_id text not null,
  -- Igual ao last_payload_hash do gcal: se nada mudou, o worker nem chama a
  -- API e não gasta cota de rate limit.
  last_payload_hash text,
  -- Marca d'água das movimentações já publicadas como comentário, para não
  -- reenviar timeline inteira a cada sync.
  last_movement_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, entity_type, entity_id),
  unique (tenant_id, clickup_task_id)
);

comment on table public.clickup_task_links is
  'Substitui o upsert que a API do ClickUp não oferece. Sem este vínculo, '
  'qualquer retry cria um card duplicado.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.clickup_connections enable row level security;
alter table public.clickup_sync_queue enable row level security;
alter table public.clickup_task_links enable row level security;

create policy clickup_connections_tenant_read
on public.clickup_connections
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

-- Fila e vínculo são infraestrutura do worker. O escritório pode auditar o
-- estado da sincronização, mas escrita é exclusiva do service_role.
create policy clickup_sync_queue_tenant_read
on public.clickup_sync_queue
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

create policy clickup_task_links_tenant_read
on public.clickup_task_links
for select
to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
);

-- A conexão contém o token cifrado e seus mapas internos. Mesmo cifrado, o
-- token não pertence à Data API; todas as mutações passam pelas Edge Functions
-- autorizadas e pelo service_role. Usuários recebem apenas metadados seguros.
revoke all privileges on table
  public.clickup_connections,
  public.clickup_sync_queue,
  public.clickup_task_links
from anon, authenticated;

grant select (
  tenant_id, workspace_id, space_id, template_version, status,
  last_error_code, connected_by, created_at, updated_at
) on public.clickup_connections to authenticated;

grant select on public.clickup_sync_queue, public.clickup_task_links
  to authenticated;

-- ---------------------------------------------------------------------------
-- Restrição de sigilo
-- ---------------------------------------------------------------------------

-- Resolve, para cada tipo de entidade, se o processo por trás dela corre em
-- segredo de justiça. Prazo e audiência chegam por caminhos diferentes, então
-- a checagem precisa ser explícita — herdar do processo é o comportamento
-- correto, mas não é automático.
create or replace function private.clickup_entity_is_restricted(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  restricted boolean;
begin
  if p_entity_type = 'processo' then
    select p.segredo_justica into restricted
    from public.processos p
    where p.tenant_id = p_tenant_id and p.id = p_entity_id;

  elsif p_entity_type = 'audiencia' then
    select p.segredo_justica into restricted
    from public.audiencias a
    join public.processos p
      on p.tenant_id = a.tenant_id and p.id = a.processo_id
    where a.tenant_id = p_tenant_id and a.id = p_entity_id;

  elsif p_entity_type = 'prazo' then
    -- publicacoes guarda o número do processo como texto, não FK.
    select p.segredo_justica into restricted
    from public.deadline_suggestions d
    join public.publicacoes pub
      on pub.tenant_id = d.tenant_id and pub.id = d.publication_id
    join public.processos p
      on p.tenant_id = pub.tenant_id and p.numero = pub.numero_processo
    where d.tenant_id = p_tenant_id and d.id = p_entity_id;

  else
    restricted := false;
  end if;

  -- Na dúvida, não espelha.
  return coalesce(restricted, false);
end;
$$;

revoke execute on function private.clickup_entity_is_restricted(uuid, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enfileiramento
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_clickup_sync()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tenant uuid;
  v_entity text := tg_argv[0];
  v_id uuid;
  v_op text;
begin
  -- Em PL/pgSQL o registro NEW não existe num trigger de DELETE: tocar em
  -- new.tenant_id ali levanta "record new is not assigned yet". Por isso o
  -- desvio é por tg_op, não por coalesce.
  if tg_op = 'DELETE' then
    v_tenant := old.tenant_id;
    v_id := old.id;
    v_op := 'delete';
  else
    v_tenant := new.tenant_id;
    v_id := new.id;
    v_op := 'upsert';
  end if;

  if v_tenant is null or v_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Sem conexão ativa não há para onde sincronizar.
  if not exists (
    select 1
    from public.clickup_connections c
    where c.tenant_id = v_tenant and c.status = 'active'
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Segredo de justiça barra aqui, antes de o job existir. Um upsert de
  -- processo que passou a correr em segredo vira delete: o card já espelhado
  -- precisa sair do ClickUp.
  if v_op = 'upsert'
     and private.clickup_entity_is_restricted(v_tenant, v_entity, v_id)
  then
    if not exists (
      select 1
      from public.clickup_task_links l
      where l.tenant_id = v_tenant
        and l.entity_type = v_entity
        and l.entity_id = v_id
    ) then
      return new;
    end if;
    v_op := 'delete';
  end if;

  -- O reset vale mesmo para job em 'processing': se o dado mudou enquanto o
  -- worker rodava, a versão dele já nasceu velha. Quem protege contra o worker
  -- sobrescrever este reset é a conclusão condicional lá em clickup.ts, que só
  -- marca 'completed' se o job ainda estiver em 'processing'.
  insert into public.clickup_sync_queue as q
    (tenant_id, entity_type, entity_id, operation)
  values
    (v_tenant, v_entity, v_id, v_op)
  on conflict on constraint clickup_sync_queue_entity_key do update
    set operation = excluded.operation,
        status = 'pending',
        attempts = 0,
        next_attempt_at = now(),
        locked_at = null,
        last_error_code = null,
        updated_at = now();

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Trigger functions are not an application RPC surface.
revoke execute on function public.enqueue_clickup_sync()
  from public, anon, authenticated;

create trigger processos_clickup_sync
  after insert or update or delete on public.processos
  for each row execute function public.enqueue_clickup_sync('processo');

create trigger deadline_suggestions_clickup_sync
  after insert or update on public.deadline_suggestions
  for each row execute function public.enqueue_clickup_sync('prazo');

create trigger audiencias_clickup_sync
  after insert or update or delete on public.audiencias
  for each row execute function public.enqueue_clickup_sync('audiencia');

-- ---------------------------------------------------------------------------
-- Consumo da fila
-- ---------------------------------------------------------------------------

-- Mesma forma de claim_google_calendar_sync_jobs: skip locked para permitir
-- mais de um worker sem disputa, e agrupamento por tenant porque o rate limit
-- do ClickUp é por token, não global.
create or replace function public.claim_clickup_sync_jobs(
  claim_limit integer default 25,
  claim_tenant_id uuid default null
)
returns setof public.clickup_sync_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.clickup_sync_queue q
  set status = 'processing',
      locked_at = now(),
      attempts = q.attempts + 1,
      updated_at = now()
  where q.id in (
    select inner_q.id
    from public.clickup_sync_queue inner_q
    where inner_q.status in ('pending', 'retry')
      and inner_q.next_attempt_at <= now()
      and (claim_tenant_id is null or inner_q.tenant_id = claim_tenant_id)
    order by inner_q.next_attempt_at
    limit greatest(1, least(coalesce(claim_limit, 25), 100))
    for update skip locked
  )
  returning q.*;
end;
$$;

revoke execute on function public.claim_clickup_sync_jobs(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_clickup_sync_jobs(integer, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Agendamento
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.unschedule('clickup-worker')
where exists (
  select 1 from cron.job where jobname = 'clickup-worker'
);

-- A cada dois minutos: intimação do DJEN chega em lote, e o advogado não
-- precisa do card no mesmo segundo — precisa dele antes de o prazo correr.
select cron.schedule(
  'clickup-worker',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/clickup-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', secrets.worker_secret
    ),
    body := '{"limit":25}'::jsonb,
    timeout_milliseconds := 50000
  )
  from (
    select
      max(decrypted_secret) filter (where name = 'project_url') as project_url,
      max(decrypted_secret) filter (
        where name = 'clickup_worker_secret'
      ) as worker_secret
    from vault.decrypted_secrets
  ) as secrets
  where secrets.project_url is not null
    and secrets.worker_secret is not null;
  $job$
);
