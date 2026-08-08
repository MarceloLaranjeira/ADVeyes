# Plano de implementação — núcleo operacional do ADVeyes

Data: 8 de agosto de 2026

Especificação de referência:
`docs/superpowers/specs/2026-08-08-nucleo-operacional-advbox-design.md`

## Estratégia

Implementar em quatro entregas verticais. Cada entrega deve terminar com banco,
tipos, interface e testes coerentes. Não avançar para a entrega seguinte com
migrações divergentes, tipos gerados desatualizados ou testes críticos falhando.

## Preparação

### Tarefa 0 — Normalizar a linha de base

Arquivos:

- `supabase/migrations/20260808170309_optimize_tenant_insert_rls.sql`
- `supabase/migrations/20260807210000_processos_tarefas_tenant_rls.sql`
- `src/integrations/supabase/types.ts`

Passos:

1. Confirmar que as migrações locais e remotas continuam alinhadas.
2. Versionar a migração de otimização de RLS que já foi aplicada no remoto.
3. Confirmar as colunas `responsavel_id`, `processo_id` e `concluida_em`.
4. Confirmar as 32 políticas do núcleo e os oito grants da Data API.
5. Rodar o Advisor e registrar a linha de base de alertas preexistentes.

Verificação:

- `npx supabase migration list --linked`
- consulta de invariantes com `npx supabase db query --linked`
- `npx supabase db advisors --linked --type all --level warn --fail-on none`

## Entrega 1 — Banco, segurança e domínio de atividades

### Tarefa 1 — Criar a migração do domínio operacional

Criar com `npx supabase migration new task_operational_domain`.

Adicionar em `public.tarefas`, somente quando ainda não existirem:

- `updated_at timestamptz not null default now()`;
- `lida_em timestamptz`;
- `favorita boolean not null default false`;
- `categoria text`;
- `pontos integer not null default 0` com valor não negativo.

Adicionar índices para:

- `(tenant_id, responsavel_id, status, data_limite)`;
- `(tenant_id, concluida_em desc)` para concluídas;
- `(tenant_id, favorita)` para favoritas;
- `(tenant_id, lida_em)` para não lidas.

Não criar uma tabela de etiquetas neste ciclo. `categoria` atende ao primeiro
fluxo; etiquetas múltiplas ficam para uma evolução específica.

### Tarefa 2 — Validar referências do mesmo escritório

Na mesma migração, criar funções `security invoker` no schema `private` e
triggers que rejeitem:

- responsável sem membership ativa no `tenant_id` da tarefa;
- processo cujo `tenant_id` seja diferente do `tenant_id` da tarefa.

Requisitos:

- `search_path` explícito;
- mensagens de erro estáveis para mapeamento no frontend;
- nenhum `SECURITY DEFINER` novo;
- criação e edição cobertas;
- responsável nulo permitido para filas não atribuídas.

### Tarefa 3 — Auditoria de mudanças relevantes

Reutilizar `public.tenant_audit_events`, que permanece revogada para
`authenticated`. Criar no schema `private` uma função de trigger estreita com
`SECURITY DEFINER` somente para inserir o evento de auditoria. A função deve:

- usar nomes totalmente qualificados e `search_path` seguro;
- validar `auth.uid()` e membership ativa no tenant da tarefa;
- rejeitar tenant nulo ou diferente do registro;
- ter `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`;
- aceitar chamadas somente pelo trigger criado pela migração;
- nunca devolver dados da tabela de auditoria.

O trigger deve registrar:

- criação de tarefa;
- alteração de responsável;
- alteração de status;
- alteração de prazo;
- conclusão e reabertura.

O metadata deve guardar apenas campos operacionais necessários, sem copiar
descrições ou conteúdo jurídico sensível.

### Tarefa 4 — Testes SQL da entrega 1

Criar `supabase/tests/task_operational_domain.sql`.

Cobrir:

- responsável ativo do mesmo tenant aceito;
- membro suspenso rejeitado;
- membro de outro tenant rejeitado;
- processo do mesmo tenant aceito;
- processo de outro tenant rejeitado;
- tarefa sem responsável aceita;
- conclusão preenche `concluida_em`;
- reabertura limpa `concluida_em`;
- auditoria registra os eventos esperados;
- políticas não permitem leitura entre tenants.

### Tarefa 5 — Aplicar e verificar a migração

1. Rodar Advisor antes da aplicação.
2. Fazer `db push --dry-run`.
3. Aplicar no projeto vinculado.
4. Consultar colunas, índices, triggers, policies e grants.
5. Rodar Advisor novamente e impedir novos alertas do domínio alterado.

### Tarefa 6 — Atualizar tipos e modelo TypeScript

Arquivos:

- `src/integrations/supabase/types.ts`
- criar `src/types/activities.ts`
- criar `src/lib/activity-status.ts`
- criar `src/test/activity-status.test.ts`

Passos:

1. Regenerar tipos do Supabase após a aplicação.
2. Definir tipos de atividade, filtros, métricas e referência resumida.
3. Centralizar labels e transições válidas de status.
4. Centralizar classificação de prazo: atrasada, hoje, próxima e futura.
5. Testar datas, transições e agregações básicas.

Critério de saída da entrega 1:

- migração local e remota alinhada;
- tipos atualizados;
- testes SQL do domínio aprovados;
- nenhum alerta novo do Advisor;
- `npx tsc --noEmit` aprovado.

## Entrega 2 — Atividades de equipe

### Tarefa 7 — Extrair o acesso a dados da página

Criar:

- `src/services/activities.ts`
- `src/hooks/useActivities.ts`
- `src/hooks/useActiveTeamMembers.ts`
- `src/test/activities-service.test.ts`

Alterar:

- `src/pages/Tarefas.tsx`

O serviço deve oferecer:

- listagem por tenant com filtros;
- criação e edição;
- alteração de status;
- reatribuição;
- leitura e favorita;
- exclusão individual;
- mutações em lote;
- métricas por período e responsável.

O hook deve controlar carregamento, erro, invalidação e rollback otimista. A
página não deve continuar chamando Supabase diretamente para cada operação.

### Tarefa 8 — Componentes reutilizáveis de atividade

Criar:

- `src/components/activities/ActivityToolbar.tsx`
- `src/components/activities/ActivityFilters.tsx`
- `src/components/activities/ActivityCard.tsx`
- `src/components/activities/ActivityRow.tsx`
- `src/components/activities/ActivityFormDialog.tsx`
- `src/components/activities/AssigneeSelect.tsx`
- `src/components/activities/BatchActions.tsx`

Requisitos:

- responsável mostra avatar, nome e situação;
- formulário permite não atribuir ou escolher membro ativo;
- processo mostra número CNJ e cliente quando disponível;
- ações destrutivas exigem confirmação;
- drag and drop possui alternativa por menu;
- erros mantêm formulário aberto e dados preenchidos.

### Tarefa 9 — Abas e visibilidade inicial

Alterar `src/pages/Tarefas.tsx` para incluir:

- Visão geral;
- Lista;
- Quadro;
- Desempenho.

Regras:

- owner/admin iniciam em Escritório;
- demais membros iniciam em Minhas tarefas;
- filtros de responsável só mostram opções permitidas;
- estado de filtros é preservado na sessão;
- Lista e Quadro usam exatamente o mesmo conjunto filtrado.

### Tarefa 10 — Desempenho operacional

Criar:

- `src/components/activities/ActivityOverview.tsx`
- `src/components/activities/ActivityPerformance.tsx`
- `src/lib/activity-metrics.ts`
- `src/test/activity-metrics.test.ts`

Métricas iniciais:

- concluídas no mês;
- pendentes;
- atrasadas;
- pontos no mês;
- evolução diária e mensal;
- distribuição por responsável.

Metas configuráveis não serão adicionadas ao banco nesta tarefa. A tela mostra
o realizado; a persistência de metas entra na entrega 3 após validar o modelo.

### Tarefa 11 — Testes da interface de atividades

Criar:

- `src/test/Tarefas.test.tsx`
- `src/test/ActivityFormDialog.test.tsx`
- `src/test/ActivityFilters.test.tsx`

Cobrir seleção de responsável, combinação de filtros, lista/quadros coerentes,
rollback de status, reatribuição, ações em lote e erros parciais.

Critério de saída da entrega 2:

- fluxo completo de criar, atribuir, mover, concluir, reabrir e filtrar;
- desktop e celular verificados;
- testes, TypeScript e build aprovados;
- nenhuma regressão nova de lint nos arquivos alterados.

## Entrega 3 — Painel e agenda operacional

### Tarefa 12 — Serviço normalizado de agenda

Criar:

- `src/services/operational-calendar.ts`
- `src/hooks/useOperationalCalendar.ts`
- `src/types/operational-calendar.ts`
- `src/test/operational-calendar.test.ts`

Alterar:

- `src/pages/Agenda.tsx`

Normalizar tarefas, eventos, audiências e prazos confirmados em um tipo comum
que preserve `sourceType`, `sourceId`, data, título, responsável e processo.
Não criar cópias dos registros de origem.

### Tarefa 13 — Painel operacional

Criar:

- `src/hooks/useOperationalDashboard.ts`
- `src/components/dashboard/OperationalStats.tsx`
- `src/components/dashboard/TeamPerformance.tsx`
- `src/components/dashboard/OperationalCalendar.tsx`
- `src/components/dashboard/CommitmentsList.tsx`

Alterar:

- `src/pages/Index.tsx`

Refatorar somente os blocos tocados. Preservar os indicadores executivos já
existentes e remover duplicidades. Métricas usam `concluida_em`, não apenas o
status atual.

### Tarefa 14 — Metas operacionais

Após validar a visão de desempenho, criar migração específica para metas por
membro e período. Não misturar essa alteração com a migração da entrega 1.

Cobrir permissões, índices, auditoria e testes SQL antes de expor a edição na
interface.

### Tarefa 15 — Ação global Adicionar

Criar:

- `src/components/layout/GlobalCreateMenu.tsx`
- `src/contexts/GlobalCreateContext.tsx`

Alterar:

- `src/components/layout/AppHeader.tsx`
- formulários de tarefa, processo, cliente, evento e financeiro somente para
  aceitar abertura contextual e callback de sucesso.

Critério de saída da entrega 3:

- painel e agenda exibem o mesmo universo operacional;
- itens abrem a origem correta;
- metas e desempenho respeitam tenant e período;
- ação global funciona sem duplicar formulários.

## Entrega 4 — Processos e intimações contextuais

### Tarefa 16 — Estado de seleção de processo

Criar:

- `src/contexts/ProcessWorkspaceContext.tsx`
- `src/hooks/useProcessSummary.ts`
- `src/components/processes/ProcessSidePanel.tsx`
- `src/components/processes/ProcessQuickActions.tsx`

O contexto guarda apenas seleção e abertura do painel. Dados continuam no hook
e são filtrados pelo tenant ativo.

### Tarefa 17 — Integrar listagens

Alterar:

- `src/pages/Processos.tsx`
- `src/pages/Publicacoes.tsx`
- `src/pages/ProcessoDetalhe.tsx`

Selecionar processo ou intimação abre o painel contextual. A navegação completa
continua disponível. Busca, filtros, paginação e exportação permanecem
independentes do painel.

### Tarefa 18 — Ações rápidas contextuais

Conectar o painel a:

- nova tarefa;
- novo documento;
- andamento manual;
- lançamento financeiro;
- visualização da timeline.

Cada ação reutiliza o formulário ou serviço do módulo correspondente e invalida
somente as consultas relacionadas.

### Tarefa 19 — Responsividade e acessibilidade

Verificar:

- painel lateral no desktop e folha de largura total no celular;
- foco ao abrir e retorno de foco ao fechar;
- navegação por teclado;
- rótulos acessíveis;
- alternativa ao drag and drop;
- status nunca comunicado apenas por cor.

### Tarefa 20 — Verificação completa

Executar:

- testes SQL novos;
- `npm run test`;
- `npx tsc --noEmit`;
- `npm run build`;
- lint focado nos arquivos alterados;
- Advisor de segurança e performance;
- fluxo autenticado de desktop e celular.

Registrar separadamente problemas preexistentes de lint ou Advisor. Nenhum
problema novo pode ser ocultado como preexistente.

## Ordem de commits

1. Versionar a migração de otimização RLS já aplicada.
2. Banco e testes SQL do domínio operacional.
3. Tipos, utilitários e serviço de atividades.
4. Componentes e página de atividades.
5. Agenda e painel operacional.
6. Ação global.
7. Painel contextual de processos e intimações.
8. Ajustes finais de acessibilidade e verificação.

Cada commit deve ser funcional, limitado ao seu objetivo e não deve incluir
arquivos de trabalho do usuário sem relação com a tarefa.
