create or replace function public.convert_lead_to_client(
  p_tenant_id uuid,
  p_lead_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lead_row public.leads%rowtype;
  client_id uuid;
begin
  select *
    into lead_row
    from public.leads
   where id = p_lead_id
     and tenant_id = p_tenant_id
   for update;

  if not found then
    raise exception 'lead_not_found'
      using errcode = 'P0002';
  end if;

  if lead_row.cliente_id is not null then
    return lead_row.cliente_id;
  end if;

  insert into public.clientes (
    tenant_id,
    user_id,
    nome,
    email,
    telefone,
    observacoes
  ) values (
    p_tenant_id,
    (select auth.uid()),
    lead_row.nome,
    lead_row.email,
    lead_row.telefone,
    concat_ws(' ', 'Convertido do CRM.', concat('Origem: ', coalesce(lead_row.origem, 'não informada') || '.'), lead_row.descricao)
  )
  returning id into client_id;

  update public.leads
     set cliente_id = client_id,
         convertido = true,
         status = 'convertido',
         updated_at = now()
   where id = p_lead_id
     and tenant_id = p_tenant_id;

  return client_id;
end;
$$;

revoke all on function public.convert_lead_to_client(uuid, uuid) from public;
grant execute on function public.convert_lead_to_client(uuid, uuid) to authenticated;

comment on function public.convert_lead_to_client(uuid, uuid) is
  'Converte um lead do tenant em cliente na mesma transação, respeitando as políticas RLS do chamador.';
