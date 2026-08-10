# Plano de implementação — núcleo jurídico híbrido

**Especificação aprovada:** `docs/superpowers/specs/2026-08-09-nucleo-juridico-hibrido-design.md`

## Resultado da entrega

O ADVeyes passará a consolidar processos, partes, contatos, andamentos,
documentos públicos, intimações e audiências a partir de DataJud/CNJ, DJEN/CNJ
e Escavador. A tela do processo será a fonte principal de consulta e mostrará
os andamentos em lista vertical paginada, com detalhes e procedência.

Credenciais pessoais de tribunal, certificados, PINs e tokens físicos não
serão armazenados. O peticionamento simulado será removido e o produto deixará
claro quando é necessário abrir o portal oficial.

## Princípios de implementação

- DataJud e DJEN são fontes oficiais; Escavador é complementar.
- Nenhum dado ausente será inventado ou apresentado como íntegra recebida.
- Toda escrita externa será idempotente e isolada por `tenant_id`.
- Correções humanas prevalecem sobre novas sincronizações.
- Dados brutos e segredos ficam fora da Data API acessível ao navegador.
- `GRANT` mínimo e RLS serão criados juntos em cada migração.
- Cada ciclo deve poder ser publicado e revertido independentemente.

## Ciclo 0 — linha de base e contratos de teste

### Tarefa 0.1 — registrar a linha de base

Arquivos envolvidos:

- `package.json`
- `src/test/`
- `supabase/tests/`

Passos:

1. Executar `npm test`, `npm run lint` e `npm run build`.
2. Registrar falhas preexistentes sem alterá-las silenciosamente.
3. Executar os testes SQL locais disponíveis para RLS e multi-tenant.
4. Confirmar que a árvore de trabalho contém apenas mudanças esperadas.

Critério de aceite:

- Há uma linha de base reproduzível antes das migrações.

### Tarefa 0.2 — criar fixtures jurídicas anonimizadas

Criar:

- `src/test/fixtures/legal/datajud-process.json`
- `src/test/fixtures/legal/djen-communication.json`
- `src/test/fixtures/legal/escavador-process.json`
- `src/test/fixtures/legal/escavador-documents.json`

Passos:

1. Cobrir movimento com complementos e código TPU.
2. Cobrir publicação com destinatários, advogado e texto de intimação.
3. Cobrir partes repetidas em processos diferentes.
4. Cobrir despacho com documento público e caso sem íntegra.
5. Cobrir audiência com data completa, audiência ambígua e texto sem data.

Critério de aceite:

- Os testes não dependem de APIs externas nem contêm dados pessoais reais.

## Ciclo 1 — segurança e remoção de credenciais pessoais

### Tarefa 1.1 — remover a interface insegura

Modificar:

- `src/pages/Configuracoes.tsx`
- `src/pages/BuscaJurisprudencia.tsx`
- `src/integrations/supabase/types.ts` após regeneração

Passos:

1. Remover formulário, listagem, edição e exclusão de
   `tribunal_credenciais` no navegador.
2. Remover textos que prometem peticionamento por token.
3. Remover a ação `peticionar` e substituí-la por `Abrir portal oficial` quando
   existir URL confiável.
4. Exibir orientação curta: A3, PIN e assinatura permanecem no computador do
   advogado e no software oficial do tribunal.
5. Adicionar teste de componente garantindo que token/PIN/certificado não são
   solicitados.

Critério de aceite:

- O bundle do frontend não consulta nem escreve `tribunal_credenciais`.
- Nenhuma tela afirma que o ADVeyes protocola petições.

### Tarefa 1.2 — neutralizar dados legados no banco

Criar a migração pelo CLI:

```powershell
supabase migration new remove_legacy_tribunal_credentials
```

Na migração:

1. Zerar definitivamente `token_acesso` e `token_refresh`, se as colunas/tabela
   existirem.
2. Revogar todos os privilégios de `anon` e `authenticated` sobre a tabela.
3. Remover políticas que concedem CRUD ao navegador.
4. Revogar execução de funções legadas relacionadas ao peticionamento.
5. Manter a tabela apenas durante a janela de compatibilidade, sem segredo e
   sem exposição; removê-la em migração posterior após confirmar ausência de
   dependências.
6. Registrar comentário SQL explicando que credenciais pessoais são proibidas.

Adicionar/alterar testes:

- `supabase/tests/tribunal_credentials_removed.sql`
- `supabase/tests/tenant_rls_modules.sql`

Critério de aceite:

- `anon` e `authenticated` não conseguem selecionar, inserir ou alterar a
  estrutura legada.
- Não existe token pessoal armazenado após a migração.

### Tarefa 1.3 — remover o endpoint de peticionamento simulado

Modificar:

- `supabase/functions/tribunal-api/index.ts`
- testes de contrato da função, criando-os se necessário

Passos:

1. Remover a leitura de `tribunal_credenciais`.
2. Remover a ação `peticionar` ou fazê-la responder explicitamente como recurso
   indisponível, sem aceitar segredo.
3. Preservar apenas consultas públicas ainda utilizadas, com autenticação e
   validação de tenant.
4. Garantir que logs não contenham tokens, documentos pessoais ou payloads
   sensíveis.

Critério de aceite:

- Busca no repositório não encontra leitura útil de `token_acesso`.
- Chamar `peticionar` não simula protocolo nem persiste credenciais.

## Ciclo 2 — modelo de dados jurídico normalizado

### Tarefa 2.1 — criar migração do núcleo

Criar a migração pelo CLI:

```powershell
supabase migration new legal_process_parties_documents_events
```

Alterar `processos` com campos para tribunal, classe, assuntos, órgão julgador,
sistema, grau, sigilo público, data da última sincronização e estado da
sincronização.

Criar `process_parties` com, no mínimo:

- `id`, `tenant_id`, `process_id`, `contact_id`;
- nome exibido e nome normalizado;
- tipo de pessoa e documento permitido/mascarado;
- polo, papel processual e classificação interna;
- origem, identificador externo, hash e payload;
- `classification_locked`, `created_at`, `updated_at`.

Criar `process_documents` com, no mínimo:

- processo e movimento relacionados;
- tipo, título, texto público, URLs oficial e complementar;
- provedor, identificador externo, hash, MIME type e data;
- disponibilidade, restrição, payload e timestamps.

Enriquecer:

- `clientes`: classificação, origem, identificador externo e controle de
  correção manual;
- `process_movements`: código TPU, descrição, complementos JSON, notas, tipo de
  documento, link e disponibilidade de íntegra, hash e procedência;
- `publicacoes`: tipo de comunicação, destinatários, advogados, órgão e
  evidência de audiência;
- `audiencias`: origem, IDs externos, vínculo com publicação/movimento,
  confiança, evidência e estado de revisão.

Criar índices e unicidade:

- processo por `tenant_id + numero`;
- parte por identidade externa ou hash determinístico dentro do processo;
- movimento por `tenant_id + process_id + provider + external_id/hash`;
- documento por provedor/ID externo ou hash;
- audiência por origem/ID externo ou hash de processo, data, tipo e local.

Critério de aceite:

- Rodar a migração duas vezes em banco descartável não cria duplicações de
  estrutura nem perde registros antigos.

### Tarefa 2.2 — aplicar segurança e permissões explícitas

Na mesma migração da tarefa 2.1:

1. Habilitar RLS em todas as novas tabelas.
2. Criar políticas baseadas em associação ativa ao tenant e permissão do módulo
   jurídico, usando os helpers existentes do projeto.
3. Revogar privilégios padrão de `anon`.
4. Conceder a `authenticated` somente as operações necessárias nas tabelas
   normalizadas.
5. Conceder a `service_role` o necessário para ingestão.
6. Não conceder acesso de navegador a payloads ou tabelas internas de
   provedores; se o payload permanecer em tabela pública, impedir sua seleção
   direta e expor uma visão/RPC sanitizada.
7. Em funções `security definer`, fixar `search_path` e revogar `execute` de
   `public`/`anon` antes de conceder ao papel correto.

Adicionar:

- `supabase/tests/legal_core_rls.sql`
- casos positivos e negativos para dois tenants e usuário sem módulo jurídico.

Critério de aceite:

- Um usuário nunca lê dados jurídicos de outro tenant.
- Novas tabelas não ficam automaticamente abertas pela Data API.

### Tarefa 2.3 — atualizar tipos e consultas canônicas

Modificar/gerar:

- `src/integrations/supabase/types.ts`
- `src/services/legal-integration.ts`

Passos:

1. Regenerar tipos a partir do schema aplicado.
2. Criar tipos de leitura sanitizados para processo, parte, movimento,
   documento, publicação e audiência.
3. Evitar `Record<string, any>` e casts globais nas novas rotas.

Critério de aceite:

- Build TypeScript passa sem adicionar novos `any` nas áreas alteradas.

## Ciclo 3 — normalização, ingestão e reconciliação

### Tarefa 3.1 — ampliar contratos normalizados

Modificar:

- `supabase/functions/_shared/legal-normalization.ts`
- `src/test/legal-normalization.test.ts`

Criar contratos para:

- `NormalizedProcessMetadata`;
- `NormalizedParty`;
- `NormalizedMovement` enriquecido;
- `NormalizedDocument`;
- `NormalizedCommunication`;
- `NormalizedHearingCandidate`.

Passos:

1. Separar conteúdo exibível de payload bruto.
2. Preservar origem, URL, ID externo e horário de coleta.
3. Produzir fingerprint determinístico quando não houver ID estável.
4. Normalizar nomes e números CNJ sem fazer mesclagem aproximada.
5. Testar acentos, nomes empresariais, complementos TPU e dados ausentes.

Critério de aceite:

- A mesma entrada sempre produz a mesma identidade normalizada.

### Tarefa 3.2 — ampliar clientes DataJud, DJEN e Escavador

Modificar:

- `supabase/functions/_shared/datajud-client.ts`
- `supabase/functions/_shared/djen-client.ts`
- `supabase/functions/_shared/escavador-client.ts`
- testes correspondentes em `src/test/`

Passos:

1. DataJud: preservar classe, assuntos, órgão, grau, sistema, sigilo e todos os
   complementos disponíveis nos movimentos.
2. DJEN: preservar texto oficial, destinatários, advogados, órgão e dados de
   comunicação.
3. Escavador: implementar consulta de detalhes, partes, movimentos e documentos
   públicos conforme endpoints/cota contratados.
4. Validar paginação, domínio de `next`, timeout, 401/402/429 e respostas
   incompletas.
5. Nunca enviar certificado ou credencial pessoal de tribunal aos provedores.

Critério de aceite:

- Fixtures de cada fonte geram contratos completos sem misturar publicação com
  movimento.

### Tarefa 3.3 — persistir processos, partes, movimentos e documentos

Modificar:

- `supabase/functions/_shared/legal-ingestion.ts`
- criar módulos pequenos em `_shared` quando necessário, evitando concentrar
  toda a reconciliação em um arquivo.

Passos:

1. Fazer upsert de metadados oficiais sem apagar correções humanas.
2. Fazer upsert idempotente de partes e documentos.
3. Atualizar movimento existente quando a mesma fonte trouxer mais detalhes.
4. Não substituir conteúdo oficial por complementar; registrar conflito.
5. Armazenar somente documentos públicos e metadados de documentos restritos.
6. Registrar contadores de recebidos, criados, atualizados, ignorados e falhos.

Critério de aceite:

- Reprocessar o mesmo lote não duplica nenhuma entidade.

### Tarefa 3.4 — reconciliar partes e contatos

Modificar:

- `supabase/functions/legal-reconcile/index.ts`
- `supabase/functions/_shared/legal-ingestion.ts`

Passos:

1. Deduplicar por CPF/CNPJ permitido, ID externo ou nome normalizado + tipo de
   pessoa dentro do tenant.
2. Criar/atualizar `clientes` para todas as partes.
3. Classificar como `cliente`, `parte_contraria` ou `terceiro` usando papel,
   cadastro existente e regras conservadoras.
4. Em caso ambíguo, criar candidato de revisão em vez de mesclar.
5. Respeitar `classification_locked` e demais correções manuais.
6. Vincular explicitamente contato, parte e processo.

Critério de aceite:

- Uma pessoa presente em vários processos aparece como um contato com vários
  vínculos, sem duplicação indevida.

### Tarefa 3.5 — detectar intimações e audiências

Modificar:

- `supabase/functions/_shared/legal-ingestion.ts`
- `supabase/functions/legal-reconcile/index.ts`
- criar `supabase/functions/_shared/legal-hearing-extraction.ts`

Passos:

1. Tratar DJEN como origem oficial de intimação/publicação.
2. Extrair audiência primeiro de campos estruturados e depois do texto.
3. Exigir processo e data válida; guardar trecho de evidência e confiança.
4. Criar audiência/compromisso como `a_confirmar`.
5. Não criar compromisso se o texto for ambíguo ou apenas mencionar audiência
   passada; registrar candidato para revisão.
6. Tornar confirmação/correção humana imune ao próximo sync.

Critério de aceite:

- Uma comunicação repetida cria uma única intimação e uma única audiência.
- Nenhuma audiência automática nasce como confirmada.

### Tarefa 3.6 — orquestrar fontes sem falha em cascata

Modificar:

- `supabase/functions/legal-reconcile/index.ts`
- `supabase/functions/legal-discover-lawyer-processes/index.ts`
- `supabase/functions/escavador-webhook/index.ts`

Passos:

1. Executar cada adaptador em bloco independente.
2. Manter dados anteriores quando uma fonte falhar.
3. Aplicar retentativa com backoff e limite.
4. Marcar fonte interrompida após o limite e permitir retomada administrativa.
5. Registrar execução e métricas por tenant/fonte sem dados sensíveis.

Critério de aceite:

- Falha do Escavador não impede DataJud/DJEN; falha do DJEN não converte
  movimento em intimação.

## Ciclo 4 — experiência do processo e módulos relacionados

### Tarefa 4.1 — criar serviço paginado do processo

Criar/modificar:

- `src/services/legal-process-detail.ts`
- `src/pages/ProcessoDetalhe.tsx`

Passos:

1. Consultar cada aba sob demanda.
2. Paginar andamentos e documentos no servidor.
3. Implementar filtros por texto, tipo, origem e período.
4. Retornar apenas campos sanitizados e permitidos.
5. Manter estados separados de carregamento, vazio, erro parcial e nova
   tentativa.

Critério de aceite:

- Abrir o processo não baixa centenas de registros de uma vez.

### Tarefa 4.2 — substituir timeline por lista de andamentos

Criar/modificar:

- `src/components/processos/ProcessMovementList.tsx`
- `src/components/processos/ProcessMovementRow.tsx`
- `src/pages/ProcessoDetalhe.tsx`
- substituir gradualmente `src/components/processos/ProcessoTimeline.tsx`

Passos:

1. Exibir data/hora, título, resumo, tipo, origem e disponibilidade de íntegra.
2. Expandir a linha para mostrar notas, complementos, código TPU, procedência e
   links.
3. Mostrar `Ler despacho`, `Abrir tribunal` ou `Íntegra não disponível` segundo
   os dados reais.
4. Suportar paginação, filtros, ordenação e teclado.
5. Evitar a linha central e cartões alternados da timeline atual.

Adicionar:

- `src/test/ProcessMovementList.test.tsx`
- `src/test/legal-process-detail.test.ts`

Critério de aceite:

- O layout corresponde ao mockup aprovado e permanece legível em desktop e
  celular.

### Tarefa 4.3 — reorganizar detalhes em abas

Modificar:

- `src/pages/ProcessoDetalhe.tsx`

Abas:

1. Visão geral.
2. Andamentos.
3. Intimações.
4. Despachos e documentos.
5. Audiências.
6. Partes e contatos.

Passos:

1. Exibir contagem e estado de sincronização por aba.
2. Abrir texto/documento público em painel seguro.
3. Mostrar procedência e última coleta.
4. Permitir classificar parte e confirmar/corrigir audiência com permissão.

Critério de aceite:

- Ao clicar em um processo, os despachos e detalhes ficam acessíveis no próprio
  processo, sem duplicar a navegação principal.

### Tarefa 4.4 — ajustar Publicações, Contatos e Audiências

Modificar:

- `src/pages/Publicacoes.tsx`
- `src/pages/Clientes.tsx`
- `src/pages/Audiencias.tsx`
- `src/components/clientes/ClienteForm.tsx`

Passos:

1. Publicações: manter comunicações/intimações como foco e retirar a timeline
   redundante de andamentos; oferecer link para o processo filtrado.
2. Contatos: exibir classificação, origem, processos e papéis relacionados;
   manter criação/edição manual.
3. Audiências: exibir estado `a_confirmar`, evidência, origem e ação de
   confirmar/corrigir.
4. Preservar filtros e exportações úteis sem duplicar dados em menus distintos.

Critério de aceite:

- Cada informação tem um módulo principal e links contextuais, sem duas telas
  concorrentes para a mesma função.

## Ciclo 5 — backfill, observabilidade e implantação

### Tarefa 5.1 — implementar backfill reiniciável

Criar:

- Edge Function ou job administrativo `legal-backfill-process-core`
- tabela/estado de checkpoint, caso os controles atuais não sejam suficientes

Passos:

1. Processar um tenant por vez e lotes pequenos de processos.
2. Salvar cursor/checkpoint após cada lote.
3. Respeitar cotas de provedor e backoff.
4. Permitir retomar sem duplicar dados.
5. Produzir relatório de processos, partes, contatos, movimentos, documentos,
   intimações, audiências, conflitos e falhas.

Critério de aceite:

- Interromper e reiniciar o backfill continua do checkpoint correto.

### Tarefa 5.2 — painel de saúde da sincronização

Modificar:

- `src/pages/Publicacoes.tsx` ou componente compartilhado de saúde jurídica
- estruturas existentes de `legal_sync_runs` e eventos de provedor

Passos:

1. Mostrar última execução e próxima tentativa por fonte.
2. Traduzir falta de saldo, limite, indisponibilidade e autenticação de
   provedor.
3. Não exibir payload bruto, segredo ou stack trace.
4. Disponibilizar retomada manual somente a perfis autorizados.

Critério de aceite:

- O escritório entende qual fonte falhou e quais dados continuam válidos.

### Tarefa 5.3 — validação integral

Executar:

```powershell
npm test
npm run lint
npm run build
supabase db lint
```

Além disso:

1. Aplicar migrações em banco descartável/preview.
2. Executar testes SQL de RLS para dois tenants.
3. Rodar advisors de segurança e desempenho do Supabase após o DDL.
4. Verificar visualmente desktop e celular:
   - processo com 100+ movimentos;
   - processo sem íntegra;
   - documento público;
   - intimação com audiência;
   - falha parcial do Escavador.
5. Pesquisar por `token_acesso`, `token_refresh`, `peticionar`, PIN e certificado
   no frontend e artefatos de build.

Critério de aceite:

- Testes, lint e build passam; advisors não apontam vulnerabilidade nova; fluxo
  completo funciona com isolamento por tenant.

### Tarefa 5.4 — publicação gradual

Ordem:

1. Backup e verificação de segredos legados.
2. Migração de segurança.
3. Migração do núcleo e políticas.
4. Edge Functions e segredos globais de provedor.
5. Frontend.
6. Piloto em um tenant.
7. Backfill em lotes, acompanhado por métricas.
8. Liberação aos demais tenants.

Rollback:

- Desativar novos leitores por feature flag.
- Preservar tabelas e campos antigos durante a validação.
- Não restaurar tokens pessoais eliminados.
- Reverter frontend/funções sem apagar dados normalizados coletados.

## Sequência recomendada de commits

1. `test: adicionar fixtures do núcleo jurídico`
2. `security: remover credenciais pessoais de tribunais`
3. `feat(db): criar partes documentos e eventos jurídicos`
4. `feat(sync): enriquecer ingestão jurídica híbrida`
5. `feat(sync): reconciliar contatos intimações e audiências`
6. `feat(ui): listar andamentos e documentos do processo`
7. `feat(ui): integrar partes contatos e audiências`
8. `feat(ops): adicionar backfill e saúde da sincronização`

## Definição de pronto

A entrega estará pronta quando um processo sincronizado mostrar, em uma única
experiência rastreável, seus metadados, partes/contatos, lista detalhada de
andamentos, despachos/documentos públicos disponíveis, intimações e audiências
a confirmar; quando uma falha de fonte não inutilizar as demais; e quando não
existir credencial pessoal de tribunal acessível ou armazenada pelo ADVeyes.
