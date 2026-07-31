-- Additive compatibility phase: existing policies and user_id ownership remain
-- unchanged until backfill and tenant-aware RLS have been validated.
alter table public.clientes add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.processos add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.financeiro add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.eventos add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.documentos add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.tarefas add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.audiencias add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.tribunal_credenciais add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.processo_monitoramento add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.notificacoes add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.portal_acessos add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.honorario_parcelas add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.publicacoes add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.andamentos add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.tarefa_checklist add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.tarefa_comentarios add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.time_entries add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.leads add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.equipe add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.contratos_templates add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.documentos_gerados add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.despesas_escritorio add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.metas_financeiras add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.email_send_log add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.google_calendar_event_links add column tenant_id uuid
  references public.tenants(id) on delete restrict;
alter table public.google_calendar_sync_queue add column tenant_id uuid
  references public.tenants(id) on delete restrict;

create index clientes_tenant_id_idx on public.clientes(tenant_id);
create index processos_tenant_id_idx on public.processos(tenant_id);
create index financeiro_tenant_id_idx on public.financeiro(tenant_id);
create index eventos_tenant_id_idx on public.eventos(tenant_id);
create index documentos_tenant_id_idx on public.documentos(tenant_id);
create index tarefas_tenant_id_idx on public.tarefas(tenant_id);
create index audiencias_tenant_id_idx on public.audiencias(tenant_id);
create index tribunal_credenciais_tenant_id_idx
  on public.tribunal_credenciais(tenant_id);
create index processo_monitoramento_tenant_id_idx
  on public.processo_monitoramento(tenant_id);
create index notificacoes_tenant_id_idx on public.notificacoes(tenant_id);
create index portal_acessos_tenant_id_idx on public.portal_acessos(tenant_id);
create index honorario_parcelas_tenant_id_idx
  on public.honorario_parcelas(tenant_id);
create index publicacoes_tenant_id_idx on public.publicacoes(tenant_id);
create index andamentos_tenant_id_idx on public.andamentos(tenant_id);
create index tarefa_checklist_tenant_id_idx
  on public.tarefa_checklist(tenant_id);
create index tarefa_comentarios_tenant_id_idx
  on public.tarefa_comentarios(tenant_id);
create index time_entries_tenant_id_idx on public.time_entries(tenant_id);
create index leads_tenant_id_idx on public.leads(tenant_id);
create index equipe_tenant_id_idx on public.equipe(tenant_id);
create index contratos_templates_tenant_id_idx
  on public.contratos_templates(tenant_id);
create index documentos_gerados_tenant_id_idx
  on public.documentos_gerados(tenant_id);
create index despesas_escritorio_tenant_id_idx
  on public.despesas_escritorio(tenant_id);
create index metas_financeiras_tenant_id_idx
  on public.metas_financeiras(tenant_id);
create index email_send_log_tenant_id_idx on public.email_send_log(tenant_id);
create index google_calendar_event_links_tenant_id_idx
  on public.google_calendar_event_links(tenant_id);
create index google_calendar_sync_queue_tenant_id_idx
  on public.google_calendar_sync_queue(tenant_id);
