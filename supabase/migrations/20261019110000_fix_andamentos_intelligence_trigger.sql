begin;

-- A função compartilhada lê new.process_id, coluna que andamentos não tem
-- (ali é processo_id); por isso todo insert em andamentos falhava.
create or replace function private.enqueue_process_intelligence_from_andamento()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.tenant_id is null or new.processo_id is null then
    return new;
  end if;

  insert into public.process_intelligence_queue (
    tenant_id, process_id, reason, priority, status, attempts, available_at,
    locked_at, last_error_code, updated_at
  ) values (
    new.tenant_id, new.processo_id, 'source_event', 30, 'pending', 0, now(),
    null, null, now()
  )
  on conflict (tenant_id, process_id) do update set
    reason = 'source_event',
    priority = greatest(public.process_intelligence_queue.priority, 30),
    status = 'pending',
    attempts = 0,
    available_at = now(),
    locked_at = null,
    last_error_code = null,
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.enqueue_process_intelligence_from_andamento()
  from public, anon, authenticated;

drop trigger if exists andamentos_enqueue_intelligence on public.andamentos;

create trigger andamentos_enqueue_intelligence
after insert or update of data_andamento, descricao, tipo on public.andamentos
for each row execute function private.enqueue_process_intelligence_from_andamento();

commit;
