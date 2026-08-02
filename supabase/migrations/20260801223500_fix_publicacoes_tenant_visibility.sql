-- Official publications belong to the tenant feed. Requiring a record-level
-- assignment made provider-ingested publications invisible to every user.
-- Module permissions still govern each operation and tenant_id keeps tenants
-- fully isolated.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'publicacoes'
  loop
    execute format(
      'drop policy if exists %I on public.publicacoes',
      policy_row.policyname
    );
  end loop;
end;
$$;

create policy tenant_publicacoes_select on public.publicacoes
for select to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

create policy tenant_publicacoes_insert on public.publicacoes
for insert to authenticated with check (
  private.has_tenant_permission(tenant_id, 'legal', 'create')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

create policy tenant_publicacoes_update on public.publicacoes
for update to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
) with check (
  private.has_tenant_permission(tenant_id, 'legal', 'update')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

create policy tenant_publicacoes_delete on public.publicacoes
for delete to authenticated using (
  private.has_tenant_permission(tenant_id, 'legal', 'delete')
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);
