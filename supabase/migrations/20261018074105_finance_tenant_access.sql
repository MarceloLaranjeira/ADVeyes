begin;

-- As políticas legadas passavam o nome da tabela onde a função espera o
-- módulo de permissão, deixando os registros financeiros inacessíveis.
do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'financeiro',
    'despesas_escritorio',
    'metas_financeiras',
    'honorario_parcelas'
  ]
  loop
    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, target_table);
    end loop;

    execute format(
      'create policy tenant_read on public.%I
       for select to authenticated
       using (private.has_tenant_permission(tenant_id, ''finance'', ''read''))',
      target_table
    );
    execute format(
      'create policy tenant_insert on public.%I
       for insert to authenticated
       with check (
         private.has_tenant_permission(tenant_id, ''finance'', ''create'')
         and private.is_active_tenant_member((select auth.uid()), tenant_id)
       )',
      target_table
    );
    execute format(
      'create policy tenant_update on public.%I
       for update to authenticated
       using (private.has_tenant_permission(tenant_id, ''finance'', ''update''))
       with check (private.has_tenant_permission(tenant_id, ''finance'', ''update''))',
      target_table
    );
    execute format(
      'create policy tenant_delete on public.%I
       for delete to authenticated
       using (private.has_tenant_permission(tenant_id, ''finance'', ''delete''))',
      target_table
    );
  end loop;
end;
$$;

create or replace function private.validate_financeiro_tenant_refs()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  referenced_tenant_id uuid;
begin
  if new.processo_id is not null then
    select processo.tenant_id
      into referenced_tenant_id
      from public.processos as processo
     where processo.id = new.processo_id;

    if referenced_tenant_id is null or referenced_tenant_id is distinct from new.tenant_id then
      raise exception 'financial_process_must_belong_to_tenant' using errcode = '23514';
    end if;
  end if;

  if new.cliente_id is not null then
    select cliente.tenant_id
      into referenced_tenant_id
      from public.clientes as cliente
     where cliente.id = new.cliente_id;

    if referenced_tenant_id is null or referenced_tenant_id is distinct from new.tenant_id then
      raise exception 'financial_client_must_belong_to_tenant' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_honorario_parcela_tenant_ref()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  process_tenant_id uuid;
begin
  select processo.tenant_id
    into process_tenant_id
    from public.processos as processo
   where processo.id = new.processo_id;

  if process_tenant_id is null or process_tenant_id is distinct from new.tenant_id then
    raise exception 'honorarium_process_must_belong_to_tenant' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_financeiro_tenant_refs() from public, anon, authenticated;
revoke all on function private.validate_honorario_parcela_tenant_ref() from public, anon, authenticated;

drop trigger if exists financeiro_validate_tenant_refs on public.financeiro;
create trigger financeiro_validate_tenant_refs
before insert or update of tenant_id, processo_id, cliente_id on public.financeiro
for each row execute function private.validate_financeiro_tenant_refs();

drop trigger if exists honorario_parcelas_validate_tenant_ref on public.honorario_parcelas;
create trigger honorario_parcelas_validate_tenant_ref
before insert or update of tenant_id, processo_id on public.honorario_parcelas
for each row execute function private.validate_honorario_parcela_tenant_ref();

commit;
