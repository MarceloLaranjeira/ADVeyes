begin;

create table public.tipos_tarefa (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null check (length(pg_catalog.btrim(nome)) between 1 and 120),
  categoria text check (categoria is null or length(pg_catalog.btrim(categoria)) between 1 and 80),
  pontos integer not null default 0 check (pontos >= 0),
  prazo_padrao_dias integer check (prazo_padrao_dias is null or prazo_padrao_dias >= 0),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nome),
  unique (tenant_id, id)
);

create index tipos_tarefa_tenant_active_idx
  on public.tipos_tarefa (tenant_id, ativo, nome);

create table public.workflows_tarefa (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null check (length(pg_catalog.btrim(nome)) between 1 and 120),
  descricao text,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nome),
  unique (tenant_id, id)
);

create index workflows_tarefa_tenant_active_idx
  on public.workflows_tarefa (tenant_id, ativo, nome);

create table public.workflow_tarefa_etapas (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  workflow_id uuid not null,
  tipo_tarefa_id uuid not null,
  ordem integer not null check (ordem >= 0),
  prazo_offset_dias integer not null default 0 check (prazo_offset_dias >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, ordem),
  foreign key (tenant_id, workflow_id)
    references public.workflows_tarefa(tenant_id, id) on delete cascade,
  foreign key (tenant_id, tipo_tarefa_id)
    references public.tipos_tarefa(tenant_id, id) on delete restrict
);

create index workflow_tarefa_etapas_workflow_idx
  on public.workflow_tarefa_etapas (tenant_id, workflow_id, ordem);

create trigger tipos_tarefa_touch_updated_at
before update on public.tipos_tarefa
for each row execute function private.touch_tenant_updated_at();

create trigger workflows_tarefa_touch_updated_at
before update on public.workflows_tarefa
for each row execute function private.touch_tenant_updated_at();

create trigger workflow_tarefa_etapas_touch_updated_at
before update on public.workflow_tarefa_etapas
for each row execute function private.touch_tenant_updated_at();

alter table public.tipos_tarefa enable row level security;
alter table public.workflows_tarefa enable row level security;
alter table public.workflow_tarefa_etapas enable row level security;

revoke all on table public.tipos_tarefa, public.workflows_tarefa, public.workflow_tarefa_etapas from anon, authenticated;
grant select, insert, update, delete on table public.tipos_tarefa, public.workflows_tarefa, public.workflow_tarefa_etapas to authenticated;
grant all on table public.tipos_tarefa, public.workflows_tarefa, public.workflow_tarefa_etapas to service_role;

create policy tipos_tarefa_read on public.tipos_tarefa
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy tipos_tarefa_manage on public.tipos_tarefa
for all to authenticated
using (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'))
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

create policy workflows_tarefa_read on public.workflows_tarefa
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy workflows_tarefa_manage on public.workflows_tarefa
for all to authenticated
using (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'))
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

create policy workflow_tarefa_etapas_read on public.workflow_tarefa_etapas
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy workflow_tarefa_etapas_manage on public.workflow_tarefa_etapas
for all to authenticated
using (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'))
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

create or replace function public.create_task_workflow(
  p_tenant_id uuid,
  p_nome text,
  p_descricao text default null,
  p_etapas jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workflow_id uuid;
  etapa record;
  task_type_id uuid;
  offset_days integer;
begin
  if private.tenant_role((select auth.uid()), p_tenant_id) not in ('owner', 'admin') then
    raise exception 'task_workflow_management_forbidden' using errcode = '42501';
  end if;

  if length(pg_catalog.btrim(coalesce(p_nome, ''))) = 0 then
    raise exception 'task_workflow_name_required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_etapas) <> 'array' or jsonb_array_length(p_etapas) = 0 then
    raise exception 'task_workflow_requires_steps' using errcode = '22023';
  end if;

  insert into public.workflows_tarefa (tenant_id, nome, descricao, created_by)
  values (p_tenant_id, pg_catalog.btrim(p_nome), nullif(pg_catalog.btrim(p_descricao), ''), (select auth.uid()))
  returning id into workflow_id;

  for etapa in
    select value, ordinality - 1 as ordem
    from jsonb_array_elements(p_etapas) with ordinality
  loop
    task_type_id := nullif(etapa.value ->> 'tipo_tarefa_id', '')::uuid;
    offset_days := coalesce(nullif(etapa.value ->> 'prazo_offset_dias', '')::integer, 0);

    if task_type_id is null or offset_days < 0 then
      raise exception 'task_workflow_invalid_step' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.tipos_tarefa as tipo
      where tipo.id = task_type_id
        and tipo.tenant_id = p_tenant_id
    ) then
      raise exception 'task_workflow_type_not_found' using errcode = 'P0002';
    end if;

    insert into public.workflow_tarefa_etapas (
      tenant_id,
      workflow_id,
      tipo_tarefa_id,
      ordem,
      prazo_offset_dias
    ) values (
      p_tenant_id,
      workflow_id,
      task_type_id,
      etapa.ordem,
      offset_days
    );
  end loop;

  return workflow_id;
end;
$$;

create or replace function public.apply_task_workflow(
  p_tenant_id uuid,
  p_workflow_id uuid,
  p_processo_id uuid default null,
  p_responsavel_id uuid default null,
  p_inicio date default current_date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workflow_row public.workflows_tarefa%rowtype;
  etapa record;
  total integer := 0;
  start_date date := coalesce(p_inicio, current_date);
begin
  if not private.has_tenant_permission(p_tenant_id, 'legal', 'create') then
    raise exception 'task_workflow_apply_forbidden' using errcode = '42501';
  end if;

  select *
    into workflow_row
    from public.workflows_tarefa
   where id = p_workflow_id
     and tenant_id = p_tenant_id
     and ativo
   for share;

  if not found then
    raise exception 'task_workflow_not_found' using errcode = 'P0002';
  end if;

  if p_processo_id is not null and not exists (
    select 1
    from public.processos as processo
    where processo.id = p_processo_id
      and processo.tenant_id = p_tenant_id
  ) then
    raise exception 'task_workflow_process_not_found' using errcode = 'P0002';
  end if;

  if p_responsavel_id is not null
     and not private.is_active_tenant_member(p_responsavel_id, p_tenant_id) then
    raise exception 'task_workflow_assignee_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.workflow_tarefa_etapas as etapa
    join public.tipos_tarefa as tipo
      on tipo.id = etapa.tipo_tarefa_id
     and tipo.tenant_id = etapa.tenant_id
   where etapa.workflow_id = workflow_row.id
     and etapa.tenant_id = p_tenant_id
     and tipo.ativo
  ) then
    raise exception 'task_workflow_without_active_steps' using errcode = '22023';
  end if;

  for etapa in
    select etapa.prazo_offset_dias, tipo.nome, tipo.categoria, tipo.pontos
    from public.workflow_tarefa_etapas as etapa
    join public.tipos_tarefa as tipo
      on tipo.id = etapa.tipo_tarefa_id
     and tipo.tenant_id = etapa.tenant_id
   where etapa.workflow_id = workflow_row.id
     and etapa.tenant_id = p_tenant_id
     and tipo.ativo
   order by etapa.ordem
  loop
    insert into public.tarefas (
      tenant_id,
      user_id,
      titulo,
      descricao,
      prioridade,
      status,
      data_limite,
      processo_id,
      responsavel_id,
      categoria,
      pontos
    ) values (
      p_tenant_id,
      (select auth.uid()),
      etapa.nome,
      concat('Workflow: ', workflow_row.nome),
      'média',
      'pendente',
      start_date + etapa.prazo_offset_dias,
      p_processo_id,
      p_responsavel_id,
      etapa.categoria,
      etapa.pontos
    );
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke all on function public.create_task_workflow(uuid, text, text, jsonb) from public;
revoke all on function public.apply_task_workflow(uuid, uuid, uuid, uuid, date) from public;
grant execute on function public.create_task_workflow(uuid, text, text, jsonb) to authenticated;
grant execute on function public.apply_task_workflow(uuid, uuid, uuid, uuid, date) to authenticated;

comment on table public.tipos_tarefa is
  'Catálogo por escritório para padronizar tarefas internas e sua pontuação.';
comment on table public.workflows_tarefa is
  'Modelos de rotinas internas aplicados à tabela canônica de tarefas.';
comment on column public.workflow_tarefa_etapas.prazo_offset_dias is
  'Dias corridos a partir do início do workflow; não representa prazo jurídico.';

commit;
