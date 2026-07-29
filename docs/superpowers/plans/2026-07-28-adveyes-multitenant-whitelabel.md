# ADVeyes multiempresa e white-label — plano de implementação

**Data:** 2026-07-28
**Status:** aprovado pelo usuário em 2026-07-28; execução iniciada pela Fase 0
**Especificação:** `docs/superpowers/specs/2026-07-28-adveyes-multitenant-whitelabel-pricing-design.md`

## Objetivo

Transformar o ADVeyes atual em SaaS multiempresa com isolamento por tenant,
papéis e equipes, marca white-label, cobrança por escritório, novos planos e
limites, sem perder os dados existentes nem interromper a integração Google
Calendar.

## Restrições obrigatórias

- Não aplicar a primeira versão diretamente em produção.
- Não remover colunas `user_id` durante a migração inicial.
- Não alterar ou descartar mudanças locais não relacionadas.
- Não habilitar bloqueios comerciais antes de validar os contadores em modo
  observação.
- Não executar purge automático sem validação da política de retenção.
- Não liberar service role, segredos ou tokens para o frontend.
- Cada tarefa termina com teste e commit próprio.
- Migrations são somente aditivas até a janela de estabilização.

## Stack

React 18, TypeScript, Vite, React Router, Supabase Auth/Postgres/RLS/Storage,
Supabase Edge Functions, Asaas, Google Calendar, Vitest.

## Pré-condições para começar

1. Consolidar ou separar o worktree sujo atual.
2. Criar branch `codex/multitenant-whitelabel`.
3. Ter ambiente Supabase local com Docker **ou** projeto separado de
   homologação.
4. Confirmar backup e teste de restauração.
5. Configurar em homologação:
   - `ASAAS_API_KEY`;
   - `ASAAS_WEBHOOK_TOKEN`;
   - secrets Google Calendar já usados em produção;
   - `APP_URL`;
   - demais APIs necessárias para testes integrados.
6. Gerar credenciais Asaas de sandbox; nunca testar cobrança com produção.

---

## Fase 0 — proteger o estado atual

### Tarefa 0.1 — consolidar o baseline

**Arquivos:** nenhum código novo.

- [ ] Revisar `git status --short` com o usuário.
- [ ] Identificar quais arquivos sujos pertencem às correções já homologadas.
- [ ] Commitar ou mover mudanças do usuário somente com autorização explícita.
- [ ] Confirmar que `npm test`, `npx tsc --noEmit` e `npm run build` passam.
- [ ] Registrar os 106 erros de lint existentes como dívida preexistente para
      não confundi-los com regressões desta implementação.
- [ ] Criar a branch:

```powershell
git switch -c codex/multitenant-whitelabel
```

**Aceite:** branch criada a partir de um baseline reproduzível; nenhuma
alteração do usuário perdida.

### Tarefa 0.2 — preparar homologação e backup

**Criar:**

- `docs/operations/multitenant-rollout-checklist.md`
- `scripts/multitenant-preflight.sql`

**Passos:**

- [ ] Documentar IDs de homologação e produção sem armazenar secrets.
- [ ] Exportar schema e dados de produção por método suportado pelo Supabase.
- [ ] Restaurar o backup em homologação/local.
- [ ] Executar `scripts/multitenant-preflight.sql` para contar registros,
      policies, triggers, funções, buckets e linhas sem proprietário.
- [ ] Guardar o resultado datado em `docs/operations/`.
- [ ] Confirmar que homologação contém os 60 registros esperados no inventário
      original ou explicar a diferença.

**Aceite:** backup restaurável confirmado e inventário anexado.

### Tarefa 0.3 — testes sentinela do comportamento atual

**Criar:**

- `src/test/current-auth-baseline.test.tsx`
- `src/test/current-subscription-baseline.test.ts`
- `supabase/tests/current-rls-baseline.sql`

**Passos:**

- [ ] Cobrir login protegido e redirecionamento atual.
- [ ] Cobrir leitura da assinatura atual por `user_id`.
- [ ] Cobrir acesso próprio e rejeição de outro `user_id` nas tabelas-chave.
- [ ] Executar testes antes de qualquer migration.

**Aceite:** baseline verde ou falhas preexistentes documentadas.

---

## Fase 1 — fundação de tenant

### Tarefa 1.1 — criar tipos e tabelas centrais

**Criar:**

- `supabase/migrations/20260729_000001_multitenant_foundation.sql`
- `supabase/tests/multitenant_foundation.sql`

**Tabelas:**

- `tenants`;
- `tenant_memberships`;
- `tenant_teams`;
- `tenant_team_members`;
- `tenant_brand_settings`;
- `platform_admins`;
- `tenant_invitations`;
- `tenant_audit_events`;
- `tenant_admin_overrides`.

**Passos:**

- [ ] Habilitar `citext` no schema de extensões, se ainda não existir, e
      qualificar o tipo usado pelo slug.
- [ ] Criar enums/check constraints descritos na especificação.
- [ ] Criar FKs, uniques e índices por `tenant_id`.
- [ ] Habilitar RLS em todas as tabelas.
- [ ] Revogar escrita direta de `anon` e `authenticated` nas tabelas
      administrativas.
- [ ] Criar trigger de `updated_at` em schema privado com `search_path` fixo.
- [ ] Não criar policy permissiva temporária.
- [ ] Testar duplicidade de slug, último owner e status inválido.

**Aceite:** migrations reversíveis por nova migration corretiva; nenhuma tabela
empresarial alterada ainda.

### Tarefa 1.2 — criar o primeiro tenant e associações

**Criar:**

- `supabase/migrations/20260729_000002_seed_albertino_tenant.sql`

**Passos:**

- [ ] Resolver usuários por e-mail em `auth.users`, sem inventar UUIDs.
- [ ] Criar tenant “Albertino Advogados Associados” com slug `albertino`.
- [ ] Tornar `marcelolaranjeira33@gmail.com` owner.
- [ ] Adicionar os outros usuários atuais com papel definido no checklist de
      implantação.
- [ ] Fazer a migration falhar com mensagem clara se owner não existir.
- [ ] Criar registro inicial de marca a partir da identidade Albertino atual.
- [ ] Registrar auditoria de migração.

**Aceite:** três usuários associados, exatamente um owner e nenhum acesso
anônimo.

### Tarefa 1.3 — helpers privados de autorização

**Criar:**

- `supabase/migrations/20260729_000003_tenant_authorization_helpers.sql`
- `supabase/tests/tenant_authorization_helpers.sql`

**Funções conceituais:**

- `private.is_platform_admin(uuid)`;
- `private.is_active_tenant_member(uuid, uuid)`;
- `private.tenant_role(uuid, uuid)`;
- `private.has_tenant_permission(uuid, text, text)`;
- `private.can_access_tenant_record(uuid, uuid, text, uuid)`.

**Passos:**

- [ ] Implementar sem depender de `user_metadata`.
- [ ] Evitar recursão de RLS em `tenant_memberships`.
- [ ] Fixar `search_path`.
- [ ] Revogar `EXECUTE` público.
- [ ] Conceder somente as funções necessárias a `authenticated`.
- [ ] Testar owner, admin, lawyer, assistant, finance, suspenso e usuário de
      outro tenant.

**Aceite:** helpers negam por padrão e passam testes de matriz.

---

## Fase 2 — adicionar `tenant_id` sem interromper o sistema

### Tarefa 2.1 — classificar e preparar tabelas

**Criar:**

- `docs/operations/tenant-table-inventory.md`
- `supabase/migrations/20260729_000004_add_nullable_tenant_ids.sql`

**Tabelas empresariais iniciais:**

- `clientes`, `processos`, `financeiro`, `eventos`, `documentos`, `tarefas`;
- `audiencias`, `tribunal_credenciais`, `processo_monitoramento`;
- `notificacoes`, `portal_acessos`, `honorario_parcelas`;
- `publicacoes`, `andamentos`, `tarefa_checklist`, `tarefa_comentarios`;
- `time_entries`, `leads`, `equipe`, `contratos_templates`;
- `documentos_gerados`, `despesas_escritorio`, `metas_financeiras`;
- `email_send_log`.

**Globais ou especiais:**

- `profiles` e `push_subscriptions`: por pessoa;
- `suppressed_emails` e `email_send_state`: plataforma;
- `google_calendar_connections`, `google_calendar_credentials` e
  `google_calendar_oauth_states`: por pessoa;
- `google_calendar_event_links` e `google_calendar_sync_queue`: pessoa+tenant;
- `asaas_subscriptions`: legado a migrar;
- `gcal_event_map`: legado a aposentar após validação.

**Passos:**

- [ ] Confirmar a classificação contra schema remoto.
- [ ] Adicionar `tenant_id uuid null` com FK e índice nas empresariais.
- [ ] Adicionar `tenant_id` nas filas/vínculos Google, ainda anulável.
- [ ] Não alterar policies existentes nesta tarefa.

**Aceite:** aplicação antiga continua funcionando sem mudança.

### Tarefa 2.2 — backfill transacional

**Criar:**

- `supabase/migrations/20260729_000005_backfill_albertino_tenant.sql`
- `scripts/verify-tenant-backfill.sql`

**Passos:**

- [ ] Preencher registros existentes com o tenant Albertino.
- [ ] Para tabelas filhas, preferir derivação pelo pai e validar divergências.
- [ ] Preencher filas e vínculos Google pela entidade de origem.
- [ ] Detectar e abortar se existir pai em outro tenant.
- [ ] Verificar contagem antes/depois por tabela.
- [ ] Não tornar colunas `not null` ainda.

**Aceite:** zero linhas empresariais sem tenant e contagens preservadas.

### Tarefa 2.3 — triggers temporários de compatibilidade

**Criar:**

- `supabase/migrations/20260729_000006_tenant_compatibility_triggers.sql`
- `supabase/tests/tenant_compatibility_triggers.sql`

**Passos:**

- [ ] Em inserts legados, resolver tenant pela associação ativa do `user_id`.
- [ ] Rejeitar usuário com zero ou múltiplos tenants quando a origem não
      informar contexto inequívoco.
- [ ] Nunca aceitar `tenant_id` incompatível com a associação.
- [ ] Marcar triggers como temporários no comentário SQL.

**Aceite:** frontend legado grava no tenant Albertino sem permitir spoofing.

---

## Fase 3 — RLS por tenant

### Tarefa 3.1 — policies das tabelas principais

**Criar:**

- `supabase/migrations/20260729_000007_tenant_rls_core.sql`
- `supabase/tests/tenant_rls_core.sql`

**Cobertura:** `clientes`, `processos`, `financeiro`, `eventos`, `documentos`,
`tarefas`, `audiencias`.

**Passos:**

- [ ] Criar policies novas com nomes versionados.
- [ ] Testar leitura/escrita de dois tenants sintéticos.
- [ ] Testar escopos `tenant`, `team` e `assigned`.
- [ ] Comparar resultados com policies legadas.
- [ ] Remover policies antigas somente após os testes.

**Aceite:** zero acesso cruzado e módulos principais funcionais.

### Tarefa 3.2 — policies dos módulos restantes

**Criar:**

- `supabase/migrations/20260729_000008_tenant_rls_modules.sql`
- `supabase/tests/tenant_rls_modules.sql`

**Passos:**

- [ ] Cobrir todas as tabelas listadas na Tarefa 2.1.
- [ ] Definir pais para checklist, comentários, parcelas e andamentos.
- [ ] Validar realtime sob RLS.
- [ ] Negar tabelas sem regra explícita.

**Aceite:** inventário sem tabela empresarial exposta por policy antiga.

### Tarefa 3.3 — Storage por tenant

**Criar:**

- `supabase/migrations/20260729_000009_tenant_storage.sql`
- `src/lib/tenant-storage.ts`
- `src/test/tenant-storage.test.ts`

**Passos:**

- [ ] Padronizar caminho `{tenant_id}/{classe}/{record_id}/{arquivo}`.
- [ ] Criar policies do bucket `documentos`.
- [ ] Migrar objetos existentes, caso existam; o inventário atual indica zero.
- [ ] Impedir `..`, prefixo arbitrário e acesso a outro tenant.

**Aceite:** upload, leitura e exclusão isolados.

### Tarefa 3.4 — tornar tenant obrigatório

**Criar:**

- `supabase/migrations/20260729_000010_require_tenant_ids.sql`

**Passos:**

- [ ] Executar verificação final de nulos e divergências.
- [ ] Tornar `tenant_id not null` nas tabelas aprovadas.
- [ ] Adicionar uniques compostos que antes eram apenas por `user_id`.
- [ ] Manter `user_id` quando representar autoria ou atribuição.

**Aceite:** nenhuma linha empresarial pode nascer sem tenant.

---

## Fase 4 — resolução de tenant e frontend base

### Tarefa 4.1 — endpoint público de marca

**Criar:**

- `supabase/functions/tenant-public-config/index.ts`
- `supabase/functions/_shared/tenant.ts`
- `supabase/tests/tenant_public_config.sql`

**Passos:**

- [x] Receber hostname validado, não tenant UUID livre.
- [x] Retornar apenas marca pública e status de disponibilidade.
- [x] Rejeitar hosts fora da allowlist.
- [x] Aplicar cache curto com chave por hostname.
- [x] Não retornar plano, membros ou dados internos.

**Aceite:** pré-login marca corretamente sem vazar informações.

### Tarefa 4.2 — `TenantProvider`

**Criar:**

- `src/contexts/TenantContext.tsx`
- `src/lib/tenant-host.ts`
- `src/test/tenant-host.test.ts`
- `src/test/TenantContext.test.tsx`

**Modificar:**

- `src/App.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/auth/ProtectedRoute.tsx`

**Passos:**

- [x] Resolver slug pelo hostname.
- [x] Buscar marca pública antes do login.
- [x] Após login, carregar memberships ativas.
- [x] Bloquear tenant sem associação.
- [x] No host central, apresentar seletor para múltiplos tenants.
- [x] Navegar ao subdomínio escolhido.

**Aceite:** usuário multi-tenant alterna sem misturar cache ou queries.

**Nota de implementação:** resolução, bloqueio e seleção já estão concluídos.
O uso obrigatório de `tenant_id` em todas as consultas empresariais permanece
na Tarefa 10.2 antes da ativação multi-tenant em produção.

### Tarefa 4.3 — `BrandProvider` e tokens

**Criar:**

- `src/contexts/BrandContext.tsx`
- `src/lib/brand.ts`
- `src/test/brand.test.ts`

**Modificar:**

- `src/components/common/Logo.tsx`
- `src/index.css`
- `src/main.tsx`
- `index.html`

**Passos:**

- [ ] Aplicar nome, logos, favicon e CSS variables.
- [ ] Validar cores e usar fallback ADVeyes.
- [ ] Evitar flash longo da marca errada.
- [ ] Isolar cache por tenant.

**Aceite:** duas abas de tenants diferentes mantêm marcas corretas.

---

## Fase 5 — superadmin e equipe

### Tarefa 5.1 — API superadmin

**Criar:**

- `supabase/functions/platform-admin/index.ts`
- `supabase/functions/_shared/platform-admin.ts`
- `supabase/tests/platform_admin.sql`

**Ações iniciais:**

- criar/editar/suspender/reativar tenant;
- criar owner e convite;
- configurar slug e marca;
- iniciar/estender piloto;
- aplicar override temporário;
- consultar uso e cobrança agregados.

**Passos:**

- [ ] Validar JWT.
- [ ] Confirmar `platform_admins`.
- [ ] Validar cada payload com schema explícito.
- [ ] Auditar toda mutação.
- [ ] Não expor tabelas jurídicas.

**Aceite:** usuário comum recebe `403`; superadmin opera somente metadados.

### Tarefa 5.2 — interface superadmin

**Criar:**

- `src/pages/admin/Tenants.tsx`
- `src/pages/admin/TenantDetail.tsx`
- `src/lib/platform-admin.ts`
- `src/components/admin/TenantForm.tsx`
- `src/test/platform-admin.test.tsx`

**Modificar:** `src/App.tsx`.

**Passos:**

- [ ] Criar rotas separadas `/admin/tenants`.
- [ ] Listar status, plano, uso, cobrança e marca.
- [ ] Criar tenant e owner.
- [ ] Configurar piloto e white-label.
- [ ] Pedir confirmação para suspensão.

**Aceite:** criação completa de um tenant de homologação pela UI.

### Tarefa 5.3 — membros, equipes e convites

**Criar:**

- `supabase/functions/tenant-members/index.ts`
- `src/pages/Equipe.tsx` (refatoração controlada)
- `src/components/team/MemberForm.tsx`
- `src/components/team/TeamForm.tsx`
- `src/components/team/ReassignmentDialog.tsx`
- `src/lib/tenant-members.ts`
- `src/test/tenant-members.test.tsx`

**Passos:**

- [ ] Convidar com papel e escopo.
- [ ] Reservar vaga de convite pendente.
- [ ] Aceitar token hasheado de uso único.
- [ ] Suspender imediatamente.
- [ ] Reatribuir processos/tarefas/clientes em lote.
- [ ] Impedir remoção do último owner.

**Aceite:** fluxo completo de entrada e saída auditado.

---

## Fase 6 — catálogo, direitos e consumo

### Tarefa 6.1 — catálogo versionado

**Criar:**

- `supabase/migrations/20260729_000011_billing_catalog.sql`
- `supabase/migrations/20260729_000012_seed_approved_plans.sql`
- `supabase/tests/billing_catalog.sql`

**Tabelas:**

- `billing_plans`;
- `billing_plan_entitlements`;
- `tenant_subscriptions`;
- `tenant_subscription_items`;
- `tenant_usage_periods`;
- `ai_usage_ledger`;
- `billing_webhook_events`.

**Passos:**

- [ ] Armazenar valores em centavos.
- [ ] Inserir Solo 7900, Profissional 27900, Escritório 61900 e Performance
      109900.
- [ ] Inserir limites aprovados.
- [ ] Inserir white-label e pacotes.
- [ ] Versionar catálogo e impedir alteração silenciosa de contratos.

**Aceite:** snapshots de assinatura preservam preço contratado.

### Tarefa 6.2 — cálculo transacional de entitlements

**Criar:**

- `supabase/migrations/20260729_000013_entitlement_functions.sql`
- `supabase/tests/entitlements.sql`
- `src/lib/entitlements.ts`
- `src/test/entitlements.test.ts`

**Passos:**

- [ ] Calcular plano + itens + override válido.
- [ ] Contar convidados+ativos, monitoramentos e termos.
- [ ] Criar débito atômico de IA.
- [ ] Bloquear concorrência acima do limite.
- [ ] Emitir percentuais de 80/95/100.

**Aceite:** testes concorrentes não ultrapassam franquia.

### Tarefa 6.3 — substituir assinatura por usuário

**Modificar:**

- `src/contexts/SubscriptionContext.tsx`;
- `src/lib/subscription-access.ts`;
- `src/lib/asaas.ts`;
- `src/hooks/usePlan.ts`;
- `src/components/PlanGate.tsx`;
- `src/components/TrialBanner.tsx`;
- `src/pages/Configuracoes.tsx`.

**Criar:**

- `src/contexts/EntitlementsContext.tsx`;
- `src/components/UsageMeter.tsx`;
- `src/test/EntitlementsContext.test.tsx`.

**Passos:**

- [ ] Ler assinatura pelo tenant.
- [ ] Manter adapter temporário para componentes antigos.
- [ ] Trocar planos `starter/profissional/escritorio` pelos códigos aprovados.
- [ ] Mostrar limites, uso, pacotes e estados.
- [ ] Fazer UI negar junto com backend, sem confiar só no `PlanGate`.

**Aceite:** nenhuma tela usa preço ou plano hardcoded como autorização.

---

## Fase 7 — Asaas por escritório

### Tarefa 7.1 — migrar assinatura Albertino

**Criar:**

- `supabase/migrations/20260729_000014_migrate_legacy_subscription.sql`
- `scripts/verify-subscription-migration.sql`

**Passos:**

- [ ] Mapear assinatura atual do owner para o tenant Albertino.
- [ ] Preservar IDs Asaas, status e próximo vencimento.
- [ ] Não criar nova cobrança.
- [ ] Marcar linha antiga como migrada/read-only.
- [ ] Validar unicidade de assinatura lógica por tenant.

**Aceite:** Albertino mantém o estado pago sem duplicação.

### Tarefa 7.2 — checkout de tenant

**Modificar:**

- `supabase/functions/asaas/index.ts`;
- `src/pages/Checkout.tsx`;
- `src/lib/asaas.ts`.

**Criar:**

- `supabase/functions/_shared/billing.ts`;
- `src/test/checkout-pricing.test.ts`.

**Passos:**

- [ ] Validar owner/admin autorizado.
- [ ] Obter valores do catálogo backend.
- [ ] Cobrir mensal, anual e ativação.
- [ ] Cobrir white-label e pacotes.
- [ ] Usar idempotency key em criação.
- [ ] Nunca aceitar preço enviado pelo navegador.

**Aceite:** sandbox gera valores exatamente aprovados.

### Tarefa 7.3 — webhook idempotente

**Modificar:** `supabase/functions/asaas-webhook/index.ts`.

**Criar:**

- `supabase/tests/asaas_webhook_events.sql`;
- `src/test/asaas-webhook-contract.test.ts`.

**Passos:**

- [ ] Validar token com comparação segura.
- [ ] Registrar/deduplicar evento.
- [ ] Resolver tenant por customer/subscription ID.
- [ ] Atualizar pagamento, assinatura e entitlement em transação.
- [ ] Implementar `past_due`, carência e reativação.
- [ ] Enfileirar falhas temporárias.

**Aceite:** replay do mesmo evento não altera resultado duas vezes.

### Tarefa 7.4 — aposentar trial por usuário

**Criar:**

- `supabase/migrations/20260729_000015_disable_user_subscription_trigger.sql`
- `supabase/tests/auth_profile_trigger.sql`

**Passos:**

- [ ] Confirmar que criação de tenant gera trial.
- [ ] Confirmar que convite não cria assinatura pessoal.
- [ ] Remover `on_auth_user_created_subscription`.
- [ ] Manter `handle_new_user` para `profiles`.
- [ ] Testar login email e Google.

**Aceite:** um usuário em dois tenants não possui assinatura pessoal duplicada.

---

## Fase 8 — adaptar integrações e módulos

### Tarefa 8.1 — Google Calendar com tenant

**Modificar:**

- `supabase/migrations/20260728031641_google_calendar_multiuser.sql` somente
  por nova migration, nunca reescrevendo histórico aplicado;
- `supabase/functions/_shared/google-calendar.ts`;
- `supabase/functions/google-calendar/index.ts`;
- `supabase/functions/google-calendar-callback/index.ts`;
- `supabase/functions/google-calendar-worker/index.ts`;
- `src/lib/google-calendar.ts`;
- `src/test/google-calendar.test.ts`.

**Criar:**

- `supabase/migrations/20260729_000016_google_calendar_tenant.sql`;
- `supabase/tests/google_calendar_tenant.sql`.

**Passos:**

- [ ] Adicionar tenant às filas e vínculos.
- [ ] Validar associação ativa antes de enfileirar/processar.
- [ ] Manter credencial global por usuário.
- [ ] Suspender somente os jobs do tenant de origem.
- [ ] Impedir que saída de um tenant revogue conexão usada em outro.

**Aceite:** um usuário em dois tenants sincroniza sem vazamento ou quebra.

### Tarefa 8.2 — Edge Functions jurídicas

**Modificar:**

- `busca-oab`, `busca-processual`, `capturar-publicacoes`;
- `cron-monitoramento`, `dje-discovery`, `dje-tjam-busca`;
- `oab-sync`, `tribunal-api`, `chat`.

**Criar:** `supabase/functions/_shared/tenant-auth.ts`.

**Passos:**

- [ ] Resolver tenant autenticado ou job interno assinado.
- [ ] Filtrar todas as queries por tenant.
- [ ] Debitar termos, monitoramentos e IA.
- [ ] Preservar isolamento em cron/filas.
- [ ] Rejeitar payload com tenant incompatível.

**Aceite:** testes de contrato recebem `401/403` sem contexto válido.

### Tarefa 8.3 — e-mail, portal e documentos

**Modificar:**

- `supabase/functions/process-email-queue/index.ts`;
- `supabase/functions/portal-data/index.ts`;
- `src/lib/pdf-export.ts`;
- `src/pages/portal/PortalLogin.tsx`;
- `src/pages/portal/PortalDashboard.tsx`;
- `src/pages/PortalCliente.tsx`.

**Passos:**

- [ ] Transportar tenant em jobs e tokens.
- [ ] Resolver marca no backend.
- [ ] Gerar links para o subdomínio certo.
- [ ] Isolar PDFs e exports.
- [ ] Não incluir marca errada em retry de fila.

**Aceite:** dois tenants geram comunicações e portal com marca/dados corretos.

### Tarefa 8.4 — queries de todas as páginas

**Modificar:** páginas e componentes que consultam tabelas empresariais.

**Passos:**

- [ ] Criar helper de query com tenant explícito para legibilidade.
- [ ] Migrar módulo a módulo.
- [ ] Remover suposições de `user_id` como proprietário empresarial.
- [ ] Manter `user_id` apenas como autor/responsável.
- [ ] Testar cada módulo com tenant A e B.

**Aceite:** busca global por `.eq("user_id", user.id)` não permanece como
isolamento empresarial.

---

## Fase 9 — superfícies white-label

### Tarefa 9.1 — remover marcas hardcoded

**Modificar:**

- `src/pages/Login.tsx`, `ResetPassword.tsx`;
- componentes de layout e logo;
- portal, PDFs, e-mails e service worker;
- qualquer ocorrência de `ALBERTINO`, `LEXIA` ou variante.

**Criar:** `scripts/audit-brand-hardcoding.mjs`.

**Passos:**

- [ ] Inventariar ocorrências com `rg`.
- [ ] Trocar por `BrandContext` ou snapshot backend.
- [ ] Manter ADVeyes apenas como fallback/plataforma.
- [ ] Fazer o script falhar em CI para novas ocorrências proibidas.

**Aceite:** white-label não exibe marca legada.

### Tarefa 9.2 — editor de marca

**Criar:**

- `src/pages/admin/TenantBranding.tsx`;
- `src/components/admin/BrandPreview.tsx`;
- `src/lib/brand-assets.ts`;
- testes correspondentes.

**Passos:**

- [ ] Upload de logos/favicon em caminho de tenant.
- [ ] Validar formato, tamanho e cor.
- [ ] Pré-visualizar login, portal, e-mail e PDF.
- [ ] Publicar versão da marca com auditoria.

**Aceite:** mudança aparece somente no tenant selecionado.

### Tarefa 9.3 — DNS wildcard e publicação

**Arquivos:** documentação operacional; configuração Cloudflare/Vercel.

- [ ] Configurar `*.adveyes.automatikus.com.br`.
- [ ] Confirmar certificado e roteamento.
- [ ] Reservar slugs de sistema.
- [ ] Testar host inexistente e tenant suspenso.
- [ ] Documentar rollback DNS.

**Aceite:** tenant de homologação abre em HTTPS no subdomínio.

---

## Fase 10 — ciclo de vida, retenção e operação

### Tarefa 10.1 — job de ciclo de vida

**Criar:**

- `supabase/functions/tenant-lifecycle/index.ts`;
- `supabase/migrations/20260729_000017_tenant_lifecycle_cron.sql`;
- testes de transição.

**Passos:**

- [ ] Expirar piloto.
- [ ] Preservar por 30 dias os dados de piloto não convertido, sem executar
      purge automático.
- [ ] Aplicar sete dias de carência.
- [ ] Suspender após carência.
- [ ] Pausar jobs de custo.
- [ ] Reativar após pagamento.
- [ ] Avisar owner/admin antes das transições.

**Aceite:** relógio simulado cobre todas as transições.

### Tarefa 10.2 — exportação e arquivamento

**Criar:**

- `supabase/functions/tenant-export/index.ts`;
- `supabase/functions/tenant-export-worker/index.ts`;
- `src/pages/Exportacao.tsx`;
- testes de exportação.

**Passos:**

- [ ] Gerar export assíncrono somente do tenant.
- [ ] Usar URL assinada de curta duração.
- [ ] Auditar solicitação e download.
- [ ] Arquivar após cancelamento.
- [ ] Não implementar purge até aprovação jurídica.

**Aceite:** export não contém IDs ou arquivos de outro tenant.

### Tarefa 10.3 — observabilidade

**Criar:**

- `docs/operations/multitenant-runbook.md`;
- consultas de fila, webhook, uso e tenants suspensos.

**Passos:**

- [ ] Padronizar correlation ID.
- [ ] Alertar fila acumulada e webhook parado.
- [ ] Documentar reprocessamento seguro.
- [ ] Documentar reativação e rollback.

**Aceite:** operador consegue diagnosticar sem consultar dados jurídicos.

---

## Fase 11 — homologação e rollout

### Tarefa 11.1 — suíte final

- [ ] `npm test`.
- [ ] `npx tsc --noEmit`.
- [ ] `npm run build`.
- [ ] Lint somente nos arquivos alterados e relatório do baseline global.
- [ ] Testes SQL de RLS.
- [ ] Advisors Supabase.
- [ ] Testes sem JWT/token em todas as Edge Functions.
- [ ] Testes E2E com:
  - dois tenants;
  - cinco papéis;
  - um usuário em dois tenants;
  - dois subdomínios;
  - uma cobrança sandbox;
  - duas contas Google.

**Aceite:** os 31 critérios da especificação estão evidenciados.

### Tarefa 11.2 — ensaio de migração

- [ ] Restaurar novo snapshot de produção em homologação.
- [ ] Cronometrar migrations e backfill.
- [ ] Comparar contagens e amostras.
- [ ] Executar rollback por feature flags.
- [ ] Corrigir o plano se houver etapa manual.

**Aceite:** ensaio repetível e sem perda.

### Tarefa 11.3 — produção gradual

- [ ] Janela de mudança aprovada.
- [ ] Backup final confirmado.
- [ ] Aplicar fundação e backfill.
- [ ] Manter recursos novos desligados.
- [ ] Validar Albertino internamente.
- [ ] Habilitar TenantProvider e RLS por módulo.
- [ ] Ativar cobrança nova em modo observação.
- [ ] Ativar bloqueios somente após conferência.
- [ ] Criar primeiro white-label piloto.
- [ ] Monitorar filas, webhooks, erros e advisors.

**Aceite:** Albertino estável e primeiro cliente white-label homologado.

---

## Pontos de parada obrigatórios

Pedir aprovação do usuário antes de:

1. reorganizar ou commit ar mudanças sujas atuais;
2. criar/usar projeto Supabase de homologação;
3. aplicar qualquer migration no Supabase remoto;
4. configurar secrets ou credenciais de cobrança;
5. alterar DNS wildcard;
6. migrar a assinatura Asaas existente;
7. ativar RLS nova em produção;
8. habilitar bloqueios comerciais;
9. publicar o primeiro white-label;
10. executar exclusão ou purge.

## Sequência de commits sugerida

1. `test: registrar baseline antes do multitenancy`
2. `feat: criar fundação de tenants e memberships`
3. `feat: associar dados existentes ao tenant Albertino`
4. `feat: aplicar isolamento RLS por tenant`
5. `feat: resolver tenant por subdomínio`
6. `feat: adicionar superadmin e gestão de equipe`
7. `feat: criar catálogo e entitlements por tenant`
8. `feat: migrar cobrança Asaas para escritórios`
9. `feat: adaptar Google Calendar e jobs ao tenant`
10. `feat: centralizar experiência white-label`
11. `feat: implementar ciclo de vida e exportação`
12. `test: homologar isolamento e rollout multiempresa`
