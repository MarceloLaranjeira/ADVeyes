-- Fecha os avisos de segurança e desempenho encontrados no preflight do
-- release. Esta migration é incremental porque as funções e políticas abaixo
-- já existem em produção.

-- A trigger só usa NEW/OLD e now(), portanto não precisa resolver objetos pelo
-- search_path da sessão chamadora.
alter function private.stamp_task_completion()
  set search_path = '';

revoke execute on function private.stamp_task_completion()
  from public, anon, authenticated;

-- auth.uid() dentro de políticas deve ser avaliado uma vez por consulta. O
-- subselect vira initplan e evita uma chamada por linha.
drop policy if exists "Owner reads tenant access links"
  on public.tenant_access_links;

create policy "Owner reads tenant access links"
  on public.tenant_access_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = tenant_access_links.tenant_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'owner'
    )
  );

-- Uma única política cobre solicitante e proprietário. Além de evitar duas
-- políticas permissivas concorrentes, mantém exatamente a visibilidade
-- anterior: o usuário lê o próprio pedido e o proprietário lê o tenant.
drop policy if exists "Requester reads own access request"
  on public.tenant_access_requests;

drop policy if exists "Owner reads tenant access requests"
  on public.tenant_access_requests;

create policy "Requester or owner reads tenant access requests"
  on public.tenant_access_requests
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.tenant_memberships membership
      where membership.tenant_id = tenant_access_requests.tenant_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'owner'
    )
  );
