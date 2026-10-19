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
  workflow_step record;
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
    from public.workflow_tarefa_etapas as step_row
    join public.tipos_tarefa as type_row
      on type_row.id = step_row.tipo_tarefa_id
     and type_row.tenant_id = step_row.tenant_id
   where step_row.workflow_id = workflow_row.id
     and step_row.tenant_id = p_tenant_id
     and type_row.ativo
  ) then
    raise exception 'task_workflow_without_active_steps' using errcode = '22023';
  end if;

  for workflow_step in
    select step_row.prazo_offset_dias, type_row.nome, type_row.categoria, type_row.pontos
    from public.workflow_tarefa_etapas as step_row
    join public.tipos_tarefa as type_row
      on type_row.id = step_row.tipo_tarefa_id
     and type_row.tenant_id = step_row.tenant_id
   where step_row.workflow_id = workflow_row.id
     and step_row.tenant_id = p_tenant_id
     and type_row.ativo
   order by step_row.ordem
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
      workflow_step.nome,
      concat('Workflow: ', workflow_row.nome),
      'média',
      'pendente',
      start_date + workflow_step.prazo_offset_dias,
      p_processo_id,
      p_responsavel_id,
      workflow_step.categoria,
      workflow_step.pontos
    );
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke all on function public.apply_task_workflow(uuid, uuid, uuid, uuid, date) from public;
grant execute on function public.apply_task_workflow(uuid, uuid, uuid, uuid, date) to authenticated;
