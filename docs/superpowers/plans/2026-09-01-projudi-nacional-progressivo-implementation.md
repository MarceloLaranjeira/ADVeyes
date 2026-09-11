# Plano de implementação — Projudi nacional progressivo

Data: 2026-09-01  
Especificações:

- docs/superpowers/specs/2026-08-31-projudi-nacional-progressivo-design.md
- docs/superpowers/specs/2026-08-31-projudi-tjam-audiencias-operacionais-design.md

## Objetivo

Colocar em produção a cobertura pública nacional de processos Projudi e
audiências, recuperar dados que o pipeline atual ignorou e preparar o primeiro
conector autenticado homologado para o Projudi/TJAM.

## Princípios de execução

- Mudanças aditivas e idempotentes.
- Nenhuma credencial ou cookie no frontend, Git ou logs.
- Um tenant, tribunal ou provedor não interrompe os demais.
- Audiência sem data e hora comprovadas não vira compromisso confirmado.
- Cobertura pública nacional entra antes do login autenticado por tribunal.
- Cada fase passa por testes e verificação real antes da promoção.
- Alterações preexistentes no worktree serão preservadas.

## Fase 0 — linha de base e inventário

### Tarefa 0.1 — congelar evidências

Arquivos:

- criar docs/operations/2026-09-01-projudi-national-baseline.md

Ações:

1. Registrar contagens por tenant, sistema, provedor e audiência.
2. Registrar os 9 movimentos de audiência do Albertino somente por IDs,
   processo, tipo e estado, sem copiar conteúdo sensível.
3. Registrar runs interrompidos e falhas parciais.
4. Salvar comandos de verificação e resultados esperados.

Verificação:

- consultas somente leitura reproduzem as contagens;
- nenhum dado pessoal ou segredo entra no documento.

### Tarefa 0.2 — executar testes atuais

Comandos:

- npm test -- --run
- npx tsc --noEmit
- npm run lint
- npm run build

Resultado:

- separar falhas preexistentes de regressões desta entrega.

## Fase 1 — cobertura pública nacional

### Tarefa 1.1 — normalizar o sistema processual DataJud

Arquivos:

- modificar supabase/functions/_shared/legal-normalization.ts
- modificar supabase/functions/_shared/datajud-client.ts se o contrato bruto
  exigir ajuste
- modificar src/test/datajud-client.test.ts
- modificar src/test/legal-normalization.test.ts

Testes primeiro:

1. objeto sistema com código 2 e nome ausente resulta em Projudi;
2. código 4 resulta em Eproc;
3. nome Projudi sem código resulta em Projudi;
4. código conhecido divergente do nome preserva evidência de divergência;
5. valor desconhecido permanece desconhecido.

Implementação:

- criar normalizador explícito dos códigos oficiais;
- preservar código, nome e conflito na proveniência;
- fazer movimentos herdarem o sistema confirmado da capa quando necessário.

### Tarefa 1.2 — ampliar o extrator de audiências

Arquivos:

- modificar supabase/functions/_shared/legal-hearing-extraction.ts
- modificar src/test/legal-hearing-extraction.test.ts

Testes primeiro:

1. texto com data/hora explícitas continua funcionando;
2. complementos estruturados reconhecem tipo e situação;
3. designada sem data futura gera indício, não audiência agendada;
4. redesignada, cancelada e realizada têm estados distintos;
5. fuso é recebido por contexto do tribunal;
6. data do movimento nunca substitui silenciosamente a data da audiência.

Implementação:

- separar evidência, status, data/hora e confiança;
- aceitar texto e complementos estruturados;
- remover offset global fixo;
- retornar candidato completo ou indício revisável.

### Tarefa 1.3 — criar candidatos a partir de movimentos

Arquivos:

- modificar supabase/functions/_shared/legal-ingestion.ts
- modificar supabase/functions/legal-reconcile/index.ts
- adicionar testes de contrato em src/test/legal-movement-hearing.test.ts

Testes primeiro:

1. movimento DataJud novo cria candidato idempotente;
2. movimento repetido não duplica;
3. indício sem horário não cria compromisso confirmado;
4. cancelamento ou realização atualiza candidato existente;
5. publicação DJEN continua criando candidatos.

Implementação:

- fazer ingestMovements devolver IDs criados e relevantes;
- adicionar createMovementHearingCandidates;
- vincular movement_id e source_provider;
- manter criação de publicações independente da criação de tarefas.

### Tarefa 1.4 — registro nacional de tribunais

Arquivos:

- gerar migration com supabase migration new legal_court_registry
- atualizar src/integrations/supabase/types.ts
- adicionar supabase/tests/legal_court_registry.sql

Modelo:

- tabela de registro de tribunal e alias DataJud;
- fuso, capacidades e estado de homologação;
- leitura autenticada segura;
- mutação somente por backend administrativo;
- RLS, grants explícitos e índices por court_code e alias.

Seed inicial:

- todos os aliases DataJud já suportados;
- capacidade pública nacional ativa;
- adaptador autenticado TJAM em pilot;
- demais adaptadores não homologados.

### Tarefa 1.5 — contrato completo de audiências

Arquivos:

- gerar migration com supabase migration new national_hearing_reconciliation
- atualizar src/integrations/supabase/types.ts
- adicionar supabase/tests/national_hearing_reconciliation.sql

Campos:

- origem, chave externa e atualização da fonte;
- fuso, fim, modalidade e link;
- órgão, sala, tipo e estado normalizados;
- referência de redesignação;
- referências de múltiplas fontes;
- revisão humana.

Regras:

- uniques idempotentes por tenant e origem;
- foreign keys compostas com tenant;
- RLS por tenant;
- correção humana protegida contra sobrescrita.

### Tarefa 1.6 — backfill idempotente

Arquivos:

- gerar migration com supabase migration new backfill_public_hearing_candidates
- adicionar supabase/tests/backfill_public_hearing_candidates.sql

Ações:

1. Classificar movimentos DataJud existentes.
2. Criar somente candidatos com data/hora comprovadas.
3. Registrar indícios incompletos para revisão.
4. Reclassificar sistema pelo código oficial quando disponível.
5. Recuperar runs worker_interrupted abandonados.

Verificação:

- executar duas vezes e comparar contagens;
- nenhuma duplicata;
- os 9 movimentos do Albertino recebem classificação documentada.

### Tarefa 1.7 — corrigir a tela de Audiências

Arquivos:

- modificar src/pages/Audiencias.tsx
- criar src/services/hearings.ts
- adicionar src/test/Audiencias.test.tsx

Comportamento:

- usar tenant ativo e recarregar ao trocar tenant;
- mostrar loading, erro e tentar novamente;
- mostrar origem, confirmação, cobertura e última atualização;
- filtros por período, status, origem e processo;
- distinguir candidato de compromisso confirmado;
- respeitar modo somente leitura e suporte temporário.

### Tarefa 1.8 — observabilidade e recuperação DJEN

Arquivos:

- modificar supabase/functions/legal-reconcile/index.ts
- modificar testes de erro e reconciliação existentes

Comportamento:

- log estruturado por etapa e run;
- tarefas falhas não anulam publicações nem audiências;
- runs interrompidos expiram e voltam à fila;
- falta de saldo do Escavador permanece degradação complementar.

## Gate de produção da Fase 1

Obrigatório:

- testes unitários e SQL aprovados;
- TypeScript, lint e build aprovados;
- advisors de segurança e performance revisados;
- validação em múltiplos aliases DataJud;
- Albertino mostra candidatos recuperados sem inventar horários;
- deploy de preview validado no navegador;
- promoção Vercel e funções Supabase concluída;
- smoke test em produção com dois tenants.

## Fase 2 — conector autenticado TJAM

### Tarefa 2.1 — cofre, conexões e fila

Arquivos:

- gerar migration com supabase migration new legal_portal_connections
- gerar migration com supabase migration new legal_portal_sync_jobs
- adicionar supabase/tests/legal_portal_connections.sql
- adicionar supabase/tests/legal_portal_sync_jobs.sql

Modelo:

- conexão por tenant e tribunal;
- referência ao Supabase Vault;
- identificador mascarado;
- estados operacionais;
- fila com cursor, lease, prioridade, tentativa e idempotência;
- grants mínimos e nenhuma leitura de segredo pelo frontend.

### Tarefa 2.2 — contrato de adaptadores

Arquivos:

- criar supabase/functions/_shared/legal-portal-adapter.ts
- criar supabase/functions/_shared/legal-court-registry.ts
- criar src/test/legal-portal-adapter.test.ts

Contrato:

- validar conexão;
- descobrir processos;
- buscar futuras;
- buscar histórico;
- buscar eventos do processo;
- renovar e revogar sessão;
- declarar capacidades.

### Tarefa 2.3 — adaptador Projudi/TJAM

Arquivos:

- criar supabase/functions/_shared/projudi-tjam-client.ts
- criar src/test/projudi-tjam-client.test.ts
- armazenar fixtures sanitizadas em src/test/fixtures/projudi-tjam

Regras:

- sessão efêmera;
- nenhuma credencial em erro ou log;
- CAPTCHA, MFA, certificado e mudança de layout têm códigos próprios;
- respeitar limites e não contornar proteções.

### Tarefa 2.4 — funções administrativas e worker

Arquivos:

- criar supabase/functions/legal-portal-admin/index.ts
- criar supabase/functions/legal-portal-worker/index.ts
- atualizar supabase/config.toml
- adicionar testes de contrato.

Operações administrativas:

- status;
- salvar/rotacionar credencial;
- testar;
- sincronizar;
- desconectar.

Worker:

- adquirir lease;
- ler segredo no backend;
- sincronizar futuras antes do histórico;
- persistir lote e cursor atomicamente;
- limpar sessão;
- devolver jobs interrompidos à fila.

### Tarefa 2.5 — interface de conexão

Arquivos:

- modificar src/pages/Configuracoes.tsx
- modificar src/services/legal-integration.ts
- criar componente focado para conexão Projudi
- adicionar testes de papel e tenant.

Comportamento:

- credencial nunca volta após salvar;
- status, cobertura e erros compreensíveis;
- feature flag limita piloto ao tenant autorizado;
- Conta Geral exige suporte temporário.

## Gate de produção da Fase 2

- teste real autorizado no TJAM;
- futuras comparadas com o portal;
- histórico inicia e retoma;
- nenhuma credencial em logs;
- uma execução automática completa;
- piloto limitado ao tenant Albertino;
- rollback verificado.

## Fase 3 — expansão por tribunal

Para cada novo tribunal:

1. Criar documento de descoberta.
2. Confirmar termos, autenticação e capacidades.
3. Implementar adaptador isolado com fixtures sanitizadas.
4. Validar um tenant piloto.
5. Promover status testing para pilot e depois active.
6. Atualizar documentação pública de cobertura.

Nenhum adaptador autenticado será ativado nacionalmente sem esse gate.

## Documentação final

Arquivos:

- atualizar docs/integracoes/provedores-juridicos.md
- atualizar docs/api e public/api quando contratos públicos mudarem
- criar runbook de credenciais, falhas e rollback
- publicar matriz de cobertura por tribunal

## Ordem de execução imediata

1. Fase 0.
2. Tarefas 1.1 a 1.3.
3. Tarefas 1.4 a 1.6.
4. Tarefas 1.7 e 1.8.
5. Gate e produção da Fase 1.
6. Fase 2 e piloto TJAM.
7. Fase 3 sob demanda.
