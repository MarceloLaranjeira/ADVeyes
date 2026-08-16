begin;

-- As políticas originais repetiram um defeito já corrigido nas tabelas
-- jurídicas principais: passaram o nome da tabela ao helper que espera um
-- módulo. Isso escondia a análise pronta da Conta Geral, embora o processo
-- fosse visível em modo somente leitura.
drop policy if exists process_intelligence_current_tenant_read
on public.process_intelligence_current;
create policy process_intelligence_current_tenant_read
on public.process_intelligence_current
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

drop policy if exists process_intelligence_history_tenant_read
on public.process_intelligence_history;
create policy process_intelligence_history_tenant_read
on public.process_intelligence_history
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

commit;
