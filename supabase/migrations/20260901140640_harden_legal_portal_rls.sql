begin;

-- Tabelas internas: a Edge Function usa service_role (bypass RLS) e nenhum
-- papel do navegador recebe privilégio. As políticas negativas deixam essa
-- decisão explícita também para auditoria automatizada.
create policy legal_portal_connections_browser_deny
on public.legal_portal_connections
for all to anon, authenticated
using (false)
with check (false);

create policy legal_portal_sync_jobs_browser_deny
on public.legal_portal_sync_jobs
for all to anon, authenticated
using (false)
with check (false);

commit;
