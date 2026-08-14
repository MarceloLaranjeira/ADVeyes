# Central de Inteligência Processual — plano de implementação

## Resultado esperado

Entregar a Central Processual como evolução da rota `/processos`, com diagnóstico
persistido e auditável para cada processo, três visualizações sobre a mesma
fonte, busca e filtros completos, cards na tela inicial e navegação reorganizada.
A entrega não criará uma segunda base de processos e não executará providências
jurídicas automaticamente.

## Decisões técnicas

- `processos` continua sendo a entidade canônica.
- `process_movements`, `andamentos`, `publicacoes`, `tarefas` e prazos existentes
  são fontes da análise.
- regras objetivas ficam em funções puras e não dependem de IA;
- interpretação semântica usa saída estruturada, evidências e confiança;
- diagnóstico atual e histórico são persistidos separadamente;
- uma fila idempotente desacopla ingestão, reanálise e varredura diária;
- a interface lê dados tenant-scoped sob RLS;
- operações privilegiadas são executadas somente em Edge Function autenticada;
- novos objetos da Data API recebem `GRANT` explícito e RLS, conforme a mudança
  atual de exposição de tabelas do Supabase;
- o worker periódico reutiliza `pg_cron`/`pg_net` e segredos no Vault, seguindo
  o padrão já presente no projeto.

## Tarefa 1 — Congelar contratos e regras com testes

### Arquivos

- criar `src/types/process-intelligence.ts`;
- criar `src/lib/process-intelligence.ts`;
- criar `src/test/process-intelligence.test.ts`.

### Passos

1. Escrever testes inicialmente falhos para:
   - taxonomia de fases e etapas;
   - responsáveis pela espera;
   - limiares padrão de 3, 15 e 30 dias;
   - prazo vencido como alerta imediato;
   - suspensão, sobrestamento e arquivamento sem alerta de inatividade;
   - diferença entre último registro e último avanço relevante;
   - classificação de risco;
   - confiança baixa quando faltam evidências;
   - precedência da correção manual.
2. Definir tipos fechados para fase, etapa, responsável, risco, confiança,
   motivo, evidência, origem e estado da análise.
3. Implementar as regras determinísticas mínimas até os testes passarem.
4. Manter funções de data com relógio injetável para testes estáveis.

### Verificação

```powershell
npx vitest run src/test/process-intelligence.test.ts
npx tsc --noEmit
```

## Tarefa 2 — Criar persistência, auditoria, configuração e fila

### Arquivos

- gerar com `supabase migration new process_intelligence_foundation`;
- editar exatamente o arquivo retornado pelo comando de criação da migração;
- atualizar `src/integrations/supabase/types.ts` somente por regeneração dos
  tipos após aplicar e verificar a migração;
- criar `src/test/process-intelligence-schema.test.ts` para invariantes locais
  que possam ser verificadas sem banco.

### Modelo de dados

1. `process_intelligence_current`
   - uma linha por `(tenant_id, process_id)`;
   - fase, etapa, estado de paralisação e datas;
   - responsável e motivo da espera;
   - próxima providência;
   - risco e confiança;
   - evidências JSON estruturadas;
   - origem, versão do classificador e estado da execução;
   - campos de override manual e atualização.
2. `process_intelligence_history`
   - versão imutável de cada análise ou correção;
   - autor, justificativa, valores anterior e novo;
   - referências às evidências e versão do classificador.
3. `process_intelligence_settings`
   - uma linha por tenant;
   - limiares configuráveis com defaults 3/15/30;
   - habilitação de varredura e revisão humana.
4. `process_intelligence_queue`
   - chave idempotente por tenant/processo;
   - motivo, prioridade, tentativas, próximo processamento e último erro;
   - acesso exclusivo do backend.

### Segurança e integridade

1. Criar FKs compostas `(tenant_id, process_id)` para impedir vínculo cruzado.
2. Adicionar checks de enums, confiança entre 0 e 1 e JSON no formato esperado.
3. Indexar tenant + risco, tenant + responsável, tenant + fase/etapa, data do
   último avanço e fila pendente.
4. Habilitar RLS em todas as tabelas expostas.
5. Usar `private.has_tenant_permission` e
   `private.can_access_tenant_record` nas políticas de leitura e correção.
6. Criar políticas `SELECT` e `UPDATE` com `USING` e `WITH CHECK`; não confiar
   apenas no papel `authenticated`.
7. Revogar privilégios genéricos e conceder somente colunas necessárias.
8. Não conceder a fila a `anon` ou `authenticated`.
9. Criar triggers idempotentes de enfileiramento para novos
   `process_movements`, `andamentos` e `publicacoes` vinculados.

### Verificação no banco

- aplicar primeiro em ambiente de desenvolvimento/branch quando disponível;
- confirmar tabelas, FKs, índices, grants, RLS e políticas via consultas de
  catálogo;
- testar leitura de tenant autorizado e negação de outro tenant;
- testar que `UPDATE` não troca `tenant_id` ou `process_id`;
- executar advisors e corrigir alertas relevantes;
- regenerar tipos e verificar o diff antes de seguir.

## Tarefa 3 — Construir o analisador híbrido

### Arquivos

- criar `supabase/functions/_shared/process-intelligence.ts`;
- criar `supabase/functions/_shared/process-intelligence-prompt.ts`;
- criar `supabase/functions/legal-process-intelligence/index.ts`;
- criar `src/test/process-intelligence-prompt.test.ts`;
- ampliar os testes dos clientes de integração apenas quando os contratos
  compartilhados forem tocados.

### Passos

1. Montar a linha do tempo canônica reutilizando a normalização já existente:
   movimentos oficiais, publicações e andamentos manuais.
2. Identificar deterministicamente:
   - prazo vencido;
   - último avanço relevante;
   - dias sem avanço;
   - status suspenso, sobrestado ou encerrado;
   - risco mínimo obrigatório.
3. Enviar ao classificador semântico apenas o contexto necessário, sem payloads
   brutos privados ou dados de outro tenant.
4. Exigir resposta estruturada com fase, etapa, responsável, motivo, próxima
   ação, confiança e IDs das evidências.
5. Rejeitar evidência inexistente, enum desconhecido e confiança inválida.
6. Mesclar regras objetivas e análise semântica sem permitir que a IA reduza
   risco de prazo vencido.
7. Persistir `current` e `history` na mesma operação lógica e preservar o último
   diagnóstico válido em caso de falha.
8. Implementar ações autenticadas:
   - `analyze` para um processo;
   - `enqueue` para reanálise manual;
   - `correct` para override auditado;
   - `status` para acompanhamento.
9. Validar JWT, tenant, permissão e acesso ao processo antes de qualquer ação.
10. Nunca expor `service_role` ou conteúdo sensível nos erros.

### Verificação

- testes de payload e validação de evidência;
- análise sem fonte suficiente retorna `não identificado`;
- timeout mantém snapshot anterior;
- repetição do mesmo evento não cria histórico duplicado;
- correção registra autor e justificativa.

## Tarefa 4 — Worker, backfill e atualização diária

### Arquivos

- ampliar `supabase/functions/legal-process-intelligence/index.ts` com ação
  interna `work`;
- alterar pontualmente `supabase/functions/legal-reconcile/index.ts` para
  enfileirar o processo após ingestão relevante, sem executar IA inline;
- gerar com `supabase migration new schedule_process_intelligence`;
- editar exatamente o segundo arquivo retornado pelo comando de criação;
- atualizar `supabase/config.toml` para o novo endpoint quando necessário.

### Passos

1. Processar lotes pequenos com lock, retry exponencial e limite de tentativas.
2. Marcar falhas por processo sem interromper o lote inteiro.
3. Agendar worker periódico seguindo o padrão seguro de Vault já existente.
4. Agendar varredura diária que reenvia processos ativos para recalcular
   inatividade, sem reanalisar encerrados desnecessariamente.
5. Criar backfill controlado, paginado e retomável para processos existentes.
6. Impedir concorrência duplicada pelo índice idempotente da fila.
7. Registrar métricas mínimas: processados, falhos, ignorados e duração.

### Verificação

- fila vazia não causa erro;
- duas solicitações simultâneas geram um único trabalho pendente;
- processo com falha não bloqueia os demais;
- backfill pode ser interrompido e retomado;
- consultar `cron.job` e `cron.job_run_details` após agendamento.

## Tarefa 5 — Serviço, rota e estado da Central

### Arquivos

- criar `src/services/process-intelligence.ts`;
- criar `src/hooks/useProcessIntelligence.ts`;
- criar `src/lib/process-intelligence-workspace.ts`;
- criar `src/test/process-intelligence-service.test.ts`;
- criar `src/test/process-intelligence-workspace.test.ts`;
- reconstruir `src/pages/Processos.tsx` como coordenador da Central.

### Passos

1. Consultar processos e diagnósticos explicitamente por `tenant_id`.
2. Carregar contagens e lista sem transferir payloads brutos de provedores.
3. Implementar parser/serializer de rota para:
   - `view=central|pipeline|list`;
   - busca;
   - fase, etapa, risco, responsável e motivo;
   - faixa de dias parado;
   - tribunal, vara, área e responsável interno;
   - prazo vencido, origem e confiança;
   - página, tamanho e ordenação.
4. Criar funções puras para filtros, agrupamentos, prioridade e CSV.
5. Preservar filtros ao trocar de visualização e ao voltar do detalhe.
6. Tratar sucesso parcial em reanálise ou correção múltipla.

### Verificação

```powershell
npx vitest run src/test/process-intelligence-service.test.ts src/test/process-intelligence-workspace.test.ts
npx tsc --noEmit
```

## Tarefa 6 — Componentes das três visualizações

### Arquivos

- criar `src/components/process-intelligence/IntelligenceMetrics.tsx`;
- criar `src/components/process-intelligence/IntelligenceToolbar.tsx`;
- criar `src/components/process-intelligence/AttentionQueue.tsx`;
- criar `src/components/process-intelligence/IntelligenceDiagnosis.tsx`;
- criar `src/components/process-intelligence/ProcessPhasePipeline.tsx`;
- criar `src/components/process-intelligence/ProcessIntelligenceList.tsx`;
- criar `src/components/process-intelligence/ProcessIntelligenceSheet.tsx`;
- criar `src/components/process-intelligence/ProcessCorrectionDialog.tsx`;
- criar `src/components/process-intelligence/ProcessIntelligenceSkeleton.tsx`;
- criar `src/test/ProcessIntelligence.test.tsx`.

### Passos

1. Implementar Central de comando com os seis cards aprovados.
2. Implementar Fila de Atenção com justificativa da ordenação.
3. Exibir diagnóstico agregado de motivos de paralisação.
4. Implementar Pipeline por fase e etapa sem duplicar estado.
5. Implementar Lista densa, responsiva, paginada e exportável.
6. Implementar painel lateral com evidências, histórico, próxima ação,
   reanálise e acesso à ficha completa.
7. Implementar correção acessível com justificativa obrigatória.
8. Exibir estados de carregamento, vazio, erro total, erro parcial,
   desatualizado, em análise e revisão humana.
9. Garantir operação por teclado e alternativa acessível para qualquer drag.

## Tarefa 7 — Integrar ficha do processo, navegação e tela inicial

### Arquivos

- atualizar `src/pages/ProcessoDetalhe.tsx`;
- atualizar `src/components/layout/AppSidebar.tsx`;
- atualizar `src/pages/Index.tsx`;
- atualizar `src/services/operational-dashboard.ts`;
- atualizar `src/types/operational-dashboard.ts`;
- atualizar `src/test/AppSidebar.test.tsx`;
- atualizar `src/test/Index.test.tsx`;
- atualizar ou criar teste para `ProcessoDetalhe`.

### Passos

1. Adicionar bloco de inteligência na ficha sem remover a linha do tempo atual.
2. Remover o item `Processos e casos`.
3. Mover `Busca processual` para logo após `Área de trabalho`.
4. Inserir `Central Processual` como destino principal dos processos monitorados.
5. Substituir processos recentes da home por cards compactos:
   precisam de ação, parados, risco alto e fase não identificada.
6. Fazer cada card abrir `/processos` com filtro explícito na URL.
7. Preservar a rota `/busca` para consulta oficial e importação.
8. Atualizar rótulos e links antigos sem quebrar URLs existentes.

## Tarefa 8 — Revisão React e acessibilidade

### Arquivos

- revisar todos os `.tsx` alterados nas tarefas 5–7.

### Passos

1. Evitar cascatas de consultas e efeitos derivados desnecessários.
2. Manter estado serializável na URL e dados remotos no cache de consultas.
3. Evitar duplicação de arrays filtrados e memoizar agregações custosas.
4. Verificar labels, nomes acessíveis, foco de dialogs/sheets e contraste.
5. Testar desktop e viewport móvel.

## Tarefa 9 — Validação integrada e rollout

### Ordem obrigatória

1. Aplicar migrações no ambiente de desenvolvimento/branch e verificar.
2. Implantar a Edge Function e executar um lote pequeno controlado.
3. Comparar diagnósticos com processos de fases conhecidas.
4. Rodar o backfill em lotes e observar falhas antes de habilitar o cron geral.
5. Executar consultas reais tenant-scoped e advisors.
6. Rodar toda a validação local:

```powershell
npm test -- --reporter=dot
npx tsc --noEmit
npm run lint
npm run build
```

7. Validar no navegador:
   - Central, Pipeline e Lista;
   - todos os filtros rápidos;
   - painel e correção;
   - navegação e cards da home;
   - redirecionamento de autenticação;
   - console sem erros.
8. Confirmar logs da Edge Function e execuções do cron sem falhas novas.
9. Fazer commit somente dos arquivos da entrega; manter `tmp/` fora.
10. Enviar branch, publicar preview, validar e somente então promover o mesmo
    artefato para produção.

## Critério de conclusão

A entrega estará concluída quando um usuário autorizado conseguir abrir a
Central, localizar um processo por qualquer filtro aprovado, compreender fase,
etapa, tempo parado, motivo, responsável e próxima ação com evidências,
corrigir a análise com auditoria e navegar pelos cards da home; tudo isolado por
tenant, testado no banco real e validado em produção sem regressões.

## Referências atuais verificadas

- Supabase RLS: tabelas expostas precisam de RLS, políticas de `UPDATE` exigem
  `SELECT` correspondente e devem usar `USING` e `WITH CHECK`;
- Supabase Data API: novas tabelas podem não ser expostas automaticamente, por
  isso os grants serão explícitos;
- Supabase Cron: jobs usam `pg_cron`; chamadas de Edge Functions podem usar
  `pg_net`, com segredos mantidos no Vault.
