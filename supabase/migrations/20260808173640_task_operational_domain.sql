-- Domínio operacional de tarefas em equipe.
--
-- A tarefa pertence ao escritório; leitura e favorita pertencem à pessoa.
-- As referências críticas são validadas no banco para que nenhuma tela ou
-- integração consiga atribuir uma tarefa a outro tenant por engano.

begin;

-- ─── Campos operacionais da tarefa ─────────────────────────────────────────

alter table public.tarefas
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists categoria text,
  add column if not exists pontos integer not null default 0;

-- O backfill anterior já eliminou as linhas órfãs. A partir daqui uma tarefa
-- sem escritório é sempre um erro de integridade.
alter table public.tarefas
  alter column tenant_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'tarefas_pontos_nonnegative'
      and conrelid = 'public.tarefas'::regclass
  ) then
    alter table public.tarefas
      add constraint tarefas_pontos_nonnegative
      check (pontos >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'tarefas_categoria_length'
      and conrelid = 'public.tarefas'::regclass
  ) then
    alter table public.tarefas
      add constraint tarefas_categoria_length
      check (
        categoria is null
        or length(pg_catalog.btrim(categoria)) between 1 and 80
      );
  end if;
end;
$$;

create unique index if not exists tarefas_tenant_id_id_uidx
  on public.tarefas (tenant_id, id);

create index if not exists tarefas_operational_queue_idx
  on public.tarefas (tenant_id, responsavel_id, status, data_limite);

create index if not exists tarefas_operational_completed_idx
  on public.tarefas (tenant_id, concluida_em desc)
  where concluida_em is not null;

drop trigger if exists tarefas_touch_updated_at on public.tarefas;
create trigger tarefas_touch_updated_at
before update on public.tarefas
for each row execute function private.touch_tenant_updated_at();

-- ─── Estado individual: lida e favorita ───────────────────────────────────

create table public.tarefa_user_state (
  tenant_id uuid not null,
  tarefa_id uuid not null,
  user_id uuid not null,
  lida_em timestamptz,
  favorita boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, tarefa_id, user_id),
  foreign key (tenant_id, tarefa_id)
    references public.tarefas(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, user_id)
    references public.tenant_memberships(tenant_id, user_id)
    on delete cascade
);

create index tarefa_user_state_user_idx
  on public.tarefa_user_state (tenant_id, user_id);

create index tarefa_user_state_favorite_idx
  on public.tarefa_user_state (tenant_id, user_id, favorita)
  where favorita;

create index tarefa_user_state_unread_idx
  on public.tarefa_user_state (tenant_id, user_id, tarefa_id)
  where lida_em is null;

create trigger tarefa_user_state_touch_updated_at
before update on public.tarefa_user_state
for each row execute function private.touch_tenant_updated_at();

alter table public.tarefa_user_state enable row level security;

revoke all on table public.tarefa_user_state from anon, authenticated;
grant select, insert, update, delete
  on table public.tarefa_user_state to authenticated;
grant all on table public.tarefa_user_state to service_role;

create policy tarefa_user_state_read
on public.tarefa_user_state
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and private.is_active_tenant_member((select auth.uid()), tenant_id)
);

create policy tarefa_user_state_insert
on public.tarefa_user_state
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and private.is_active_tenant_member((select auth.uid()), tenant_id)
);

create policy tarefa_user_state_update
on public.tarefa_user_state
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and private.is_active_tenant_member((select auth.uid()), tenant_id)
)
with check (
  (select auth.uid()) = user_id
  and private.is_active_tenant_member((select auth.uid()), tenant_id)
);

create policy tarefa_user_state_delete
on public.tarefa_user_state
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and private.is_active_tenant_member((select auth.uid()), tenant_id)
);

-- ─── Integridade das referências operacionais ──────────────────────────────

create or replace function private.validate_task_operational_refs()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  process_tenant_id uuid;
begin
  if new.tenant_id is null then
    raise exception using
      errcode = '23514',
      message = 'task_tenant_required';
  end if;

  if new.responsavel_id is not null
     and not private.is_active_tenant_member(
       new.responsavel_id,
       new.tenant_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'task_assignee_must_be_active_tenant_member';
  end if;

  if new.processo_id is not null then
    select process.tenant_id
      into process_tenant_id
    from public.processos as process
    where process.id = new.processo_id;

    if process_tenant_id is null
       or process_tenant_id is distinct from new.tenant_id then
      raise exception using
        errcode = '23514',
        message = 'task_process_must_belong_to_tenant';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_task_operational_refs()
  from public, anon, authenticated;

drop trigger if exists tarefas_validate_operational_refs on public.tarefas;
create trigger tarefas_validate_operational_refs
before insert or update on public.tarefas
for each row execute function private.validate_task_operational_refs();

-- ─── Auditoria append-only ─────────────────────────────────────────────────

create or replace function private.audit_task_operational_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  task_tenant_id uuid;
begin
  task_tenant_id := case
    when tg_op = 'INSERT' then new.tenant_id
    else coalesce(new.tenant_id, old.tenant_id)
  end;

  -- Chamadas diretas são revogadas; esta defesa adicional impede que uma
  -- sessão autenticada gere auditoria para um tenant do qual não participa.
  if actor_id is not null
     and not private.is_active_tenant_member(actor_id, task_tenant_id)
     and not private.is_platform_admin(actor_id) then
    raise exception using
      errcode = '42501',
      message = 'task_audit_tenant_access_denied';
  end if;

  if tg_op = 'INSERT' then
    insert into public.tenant_audit_events (
      tenant_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      new.tenant_id,
      actor_id,
      'task.created',
      'tarefa',
      new.id::text,
      pg_catalog.jsonb_build_object(
        'responsavel_id', new.responsavel_id,
        'processo_id', new.processo_id,
        'status', new.status,
        'data_limite', new.data_limite
      )
    );
    return new;
  end if;

  if new.responsavel_id is distinct from old.responsavel_id then
    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      new.tenant_id,
      actor_id,
      'task.assignee_changed',
      'tarefa',
      new.id::text,
      pg_catalog.jsonb_build_object(
        'from', old.responsavel_id,
        'to', new.responsavel_id
      )
    );
  end if;

  if new.status is distinct from old.status then
    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      new.tenant_id,
      actor_id,
      case
        when new.status = 'concluída' then 'task.completed'
        when old.status = 'concluída' then 'task.reopened'
        else 'task.status_changed'
      end,
      'tarefa',
      new.id::text,
      pg_catalog.jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if new.data_limite is distinct from old.data_limite then
    insert into public.tenant_audit_events (
      tenant_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      new.tenant_id,
      actor_id,
      'task.deadline_changed',
      'tarefa',
      new.id::text,
      pg_catalog.jsonb_build_object(
        'from', old.data_limite,
        'to', new.data_limite
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_task_operational_changes()
  from public, anon, authenticated;

drop trigger if exists tarefas_audit_operational_changes on public.tarefas;
create trigger tarefas_audit_operational_changes
after insert or update on public.tarefas
for each row execute function private.audit_task_operational_changes();

comment on table public.tarefa_user_state is
  'Estado individual de leitura e favorita; nunca compartilhado pelo tenant.';
comment on column public.tarefas.pontos is
  'Pontos operacionais atribuídos ao responsável quando a tarefa é concluída.';
comment on function private.validate_task_operational_refs() is
  'Rejeita responsável ou processo que não pertençam ao tenant da tarefa.';
comment on function private.audit_task_operational_changes() is
  'Auditoria privada e append-only de mudanças operacionais da tarefa.';

commit;
