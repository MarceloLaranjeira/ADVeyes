-- O domínio operacional encontrou índices equivalentes já criados pela
-- fundação multitenant. Mantemos os mais antigos e removemos apenas as cópias.

begin;

drop index if exists public.tarefas_operational_completed_idx;
drop index if exists public.tarefas_tenant_id_id_uidx;

commit;
