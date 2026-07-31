# Inventário de tabelas por tenant

**Data:** 2026-07-28  
**Estado:** classificação local anterior ao backfill

## Empresariais

Recebem `tenant_id` anulável nesta fase e obrigatório somente depois do
backfill e da validação de RLS:

- núcleo: `clientes`, `processos`, `financeiro`, `eventos`, `documentos`,
  `tarefas` e `audiencias`;
- jurídico: `tribunal_credenciais`, `processo_monitoramento`, `publicacoes`,
  `andamentos`, `honorario_parcelas`;
- relacionamento: `notificacoes`, `portal_acessos`, `leads`, `equipe`;
- tarefas: `tarefa_checklist`, `tarefa_comentarios`;
- gestão: `time_entries`, `contratos_templates`, `documentos_gerados`,
  `despesas_escritorio`, `metas_financeiras`;
- infraestrutura com contexto empresarial: `email_send_log`.

Tabelas filhas derivarão o tenant do pai no backfill. Divergência entre pai e
linha filha deverá abortar a migration.

## Google Calendar

- globais por pessoa: `google_calendar_connections` e
  `google_calendar_credentials`;
- estado OAuth temporário por pessoa:
  `google_calendar_oauth_states`;
- pessoa + tenant: `google_calendar_event_links` e
  `google_calendar_sync_queue`;
- legado a aposentar depois da validação: `gcal_event_map`.

## Globais por pessoa

- `profiles`;
- `push_subscriptions`.

Essas tabelas não recebem tenant porque a mesma pessoa pode participar de
vários escritórios.

## Plataforma ou segredo interno

- cobrança legada: `asaas_subscriptions`, posteriormente migrada para
  assinatura do tenant;
- e-mail: `email_send_state`, `email_unsubscribe_tokens` e
  `suppressed_emails`;
- segredo Google: `google_calendar_credentials`;
- administração multiempresa: `platform_admins`, `tenants`,
  `tenant_memberships`, `tenant_teams`, `tenant_team_members`,
  `tenant_brand_settings`, `tenant_invitations`, `tenant_audit_events` e
  `tenant_admin_overrides`.

Tabelas de plataforma não concedem leitura automática dos dados jurídicos.

## Contagem estrutural

- 45 tabelas públicas após a fundação multiempresa;
- 26 tabelas recebem `tenant_id` nesta fase;
- nenhuma coluna é tornada `not null`;
- nenhuma policy existente é removida ou substituída nesta fase.
