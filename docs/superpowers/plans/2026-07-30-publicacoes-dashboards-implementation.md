# Plano de implementação: publicações, andamentos e dashboards

## Referência

Especificação aprovada:
`docs/superpowers/specs/2026-07-30-publicacoes-pje-projudi-seeu-design.md`.

## Restrições

- Preservar dados reais e migrations já aplicadas.
- Criar migrations somente por `supabase migration new`.
- Não aplicar migration remota sem verificar SQL, RLS e advisors.
- Não criar monitoramento pago do Escavador enquanto o token não estiver disponível.
- Não chamar movimento do DataJud de publicação.
- Não criar prazo definitivo sem confirmação humana.
- Não expor `service_role`, token Escavador ou chaves de provedores.
- Cada consulta empresarial deve usar o `tenant_id` ativo.

## Estado atual

| Fase | Situação |
|---|---|
| 1 — contexto e dashboards | concluída (`bcbd633`, `69a26cf`) |
| 2 — modelo jurídico | concluída (`5b01b7a`, migration `20260731002104`) |
| 3 — provedores e ingestão | concluída (módulos compartilhados + adaptador DataJud) |
| 4 — automação | 4.1 e 4.2 concluídas; 4.3 concluída na interface |
| 5 — interface jurídica | 5.1, 5.2 e 5.3 entregues em versão inicial |
| 6 — validação e rollout | pendente: testes SQL, advisors e validação em produção |

Pendências conhecidas antes do rollout:

- executar as migrations `20260731020147` e `20260731021207` no projeto remoto;
- registrar `project_url` e `cron_secret` no Vault caso ainda não existam;
- validar uma amostra real do DataJud e o Escavador quando o token existir;
- cobrir isolamento por escritório com testes SQL (Tarefa 2.1) — ainda não escritos.

## Fase 1 — contexto e dashboards

### Tarefa 1.1 — testes de navegação por ambiente

**Criar/alterar:**

- `src/test/HomeEntry.test.tsx`;
- testes de `TenantContext` necessários.

**Aceite:**

- administrador da plataforma não é forçado a `/admin`;
- membro comum entra no escritório;
- `/admin` continua protegido;
- seleção local é revalidada contra memberships.

### Tarefa 1.2 — seletor de ambiente

**Criar/alterar:**

- componente reutilizável de seleção;
- `AppHeader`;
- `PlatformAdmin`;
- `TenantContext`;
- `HomeEntry`.

**Aceite:**

- conta geral e escritórios autorizados aparecem para o administrador;
- troca de escritório recarrega estado por tenant;
- usuário comum não vê conta geral.

### Tarefa 1.3 — cards 3D acessíveis

**Criar/alterar:**

- componente ou variante reutilizável de card;
- tokens CSS globais;
- `Index`;
- `PlatformAdmin`.

**Aceite:**

- cards clicáveis respondem a mouse e teclado;
- cards estáticos não simulam clique;
- touch e `prefers-reduced-motion` não recebem inclinação;
- nenhuma interação desloca o layout.

### Tarefa 1.4 — conta geral detalhada

**Alterar:**

- serviço e Edge Function `platform-admin`;
- `PlatformAdmin`;
- rotas administrativas.

**Aceite:**

- indicadores clicáveis;
- filtros e detalhes para escritórios, usuários, integrações e assinaturas;
- nenhuma exposição de conteúdo jurídico sem override auditável.

## Fase 2 — modelo jurídico

### Tarefa 2.1 — testes e migration aditiva

**Criar:**

- testes SQL de isolamento, deduplicação e grants;
- tabelas/colunas para publicações, andamentos, fontes, execuções e sugestões.

**Aceite:**

- RLS por tenant;
- identificadores externos e hashes únicos;
- grants mínimos;
- nenhum registro empresarial sem tenant.

### Tarefa 2.2 — migração e classificação

**Aceite:**

- movimentos DataJud saem de publicações;
- dados demo são marcados ou removidos;
- proveniência incerta fica em revisão;
- contagens antes/depois são registradas.

## Fase 3 — provedores e ingestão

### Tarefa 3.1 — contratos internos

`supabase/functions/_shared/legal-normalization.ts` concentra os contratos
`NormalizedPublication` e `NormalizedMovement`, a classificação de origem por
evidência, a detecção de possível prazo, a impressão digital determinística e a
escala de retentativas. Coberto por `src/test/legal-normalization.test.ts`.

### Tarefa 3.2 — adaptador DataJud

`supabase/functions/_shared/datajud-client.ts` resolve o índice público pelo
tribunal cadastrado ou pelo segmento do número CNJ e devolve apenas processo e
movimentos. `normalizeDataJudMovements` marca todo item como `ANDAMENTO` e nunca
deduz sistema de origem a partir do tribunal. Coberto por
`src/test/datajud-client.test.ts`.

### Tarefa 3.3 — adaptador Escavador

`fetchLawyerPublications` foi movido para `_shared/escavador-client.ts`, com
paginação limitada e erros tipados. Ativação real continua dependendo do secret
`ESCAVADOR_API_TOKEN`.

### Tarefa 3.4 — ingestor idempotente

`supabase/functions/_shared/legal-ingestion.ts` deduplica por ID externo e, na
ausência dele, pela impressão digital do conteúdo. Webhook, captura manual e
reconciliação usam o mesmo caminho de gravação.

## Fase 4 — automação

### Tarefa 4.1 — webhook Escavador

Validar token, responder rapidamente, registrar evento idempotente e processar
sem confiar em `tenant_id` livre do payload.

### Tarefa 4.2 — reconciliação

`public.legal_sync_sources` (migration `20260731020147`) guarda as OABs e os
processos monitorados com estado de ativação, cursor, última execução
bem-sucedida e próximo horário. Gatilhos mantêm a tabela sincronizada com
`lawyer_registrations` e `processos`.

A Edge Function `legal-reconcile` processa fonte a fonte: uma falha isolada não
interrompe as demais, sucesso reagenda em seis horas e falha transitória aplica
1 minuto, 5 minutos, 30 minutos, 2 horas e 6 horas. Falha permanente (token
recusado, saldo insuficiente, tribunal sem cobertura) interrompe a fonte e fica
visível no painel. Integração ainda não configurada não conta como falha.

O agendamento fica em `20260731021207`, no mesmo padrão do monitoramento já
existente (pg_cron + Vault, sem expor `service_role`).

### Tarefa 4.3 — sincronização manual e monitor

`legal-reconcile` também atende à sincronização manual: valida o JWT do usuário
e o vínculo ativo com o escritório, e ignora o agendamento apenas do tenant
solicitado. O painel de `Publicações e andamentos` mostra última execução,
próxima reconciliação, OABs e processos monitorados, fontes com falha e fontes
interrompidas, com motivo legível por fonte.

## Fase 5 — interface jurídica

### Tarefa 5.1 — Publicações e intimações

Implementar filtros, status, proveniência e revisão de possível prazo.

### Tarefa 5.2 — Andamentos

Implementar linha do tempo, filtros por provedor e sinalização de divergência.

### Tarefa 5.3 — revisão humana

Exigir data, responsável e processo antes de criar tarefa; sincronizar com
Google Calendar somente após confirmação.

## Fase 6 — validação e rollout

- Executar testes React/Vitest.
- Executar TypeScript, lint dos arquivos alterados e build.
- Executar testes SQL e advisors.
- Testar dois tenants e dois papéis.
- Validar uma amostra DataJud real.
- Validar Escavador somente quando o token estiver disponível.
- Implantar de forma aditiva, mantendo fallback.
- Validar produção e registrar resultado.

## Sequência de commits

1. `test: cobrir navegação entre ambientes`
2. `feat: restaurar dashboards e seletor de ambiente`
3. `feat: adicionar cards 3d acessíveis`
4. `feat: separar publicações e andamentos por tenant`
5. `feat: normalizar ingestão jurídica híbrida`
6. `feat: adicionar webhook e reconciliação jurídica`
7. `feat: revisar prazos antes de criar tarefas`
8. `test: validar isolamento e integrações jurídicas`
