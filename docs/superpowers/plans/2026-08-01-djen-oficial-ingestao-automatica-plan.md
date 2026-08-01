# Plano de implementação — ingestão oficial automática do DJEN

**Data:** 1º de agosto de 2026  
**Especificação:** `docs/superpowers/specs/2026-08-01-djen-oficial-ingestao-automatica-design.md`

## Objetivo

Entregar a consulta automática da API oficial DJEN por OAB/UF e número CNJ,
com agrupamento global de referências, distribuição isolada por escritório,
deduplicação, notificações e execução a cada dez minutos.

## Etapa 1 — banco e agendamento

1. Criar uma migration Supabase exclusiva para a integração DJEN.
2. Ampliar os `CHECK constraints` de `publicacoes`, `legal_sync_sources` e
   `legal_sync_runs` para aceitar o provedor `djen`.
3. Atualizar os gatilhos de fontes jurídicas:
   - cada OAB ativa mantém uma fonte Escavador e cria uma fonte DJEN;
   - cada processo mantém uma fonte DataJud e cria uma fonte DJEN.
4. Fazer backfill idempotente das fontes DJEN para OABs e processos existentes.
5. Reagendar `reconciliacao-juridica` para `*/10 * * * *`, preservando o
   segredo armazenado no Vault.
6. Confirmar que todas as tabelas públicas continuam protegidas por RLS.

## Etapa 2 — cliente e normalização

1. Criar `supabase/functions/_shared/djen-client.ts`:
   - filtros por OAB/UF e processo;
   - janela temporal com sobreposição;
   - paginação de até 100 itens;
   - timeout e limite defensivo de páginas;
   - leitura dos cabeçalhos de rate limit;
   - erros sanitizados para HTTP, `429` e payload inválido.
2. Ampliar `legal-normalization.ts` com o provedor `djen` e o normalizador do
   contrato oficial do CNJ.
3. Preservar identificador/hash oficial e calcular identidade determinística
   quando algum deles estiver ausente.
4. Classificar o sistema processual de origem somente quando houver evidência
   no payload ou link.

## Etapa 3 — reconciliação global e ingestão

1. Separar fontes DJEN das integrações já existentes no `legal-reconcile`.
2. Agrupar fontes vencidas por `source_kind + reference`.
3. Consultar cada referência uma vez por execução.
4. Distribuir o resultado somente aos `tenant_id` associados à referência.
5. Executar a ingestão idempotente por escritório e vincular o processo pelo
   número CNJ quando ele existir localmente.
6. Registrar uma execução individual por fonte/escritório com recebidos,
   criados, ignorados, duração e erro sanitizado.
7. Agendar sucesso DJEN para dez minutos; manter a periodicidade própria das
   fontes Escavador/DataJud.
8. Interromper novas consultas DJEN no lote após `429`, reagendando-as sem
   duplicar nem descartar resultados já persistidos.

## Etapa 4 — notificações

1. Fazer a ingestão devolver os IDs efetivamente criados.
2. Criar notificações somente para publicações inéditas.
3. Associar cada notificação ao escritório e aos usuários que podem receber
   alertas jurídicos, respeitando as permissões existentes.
4. Incluir link para a publicação e resumo com tribunal/processo.
5. Garantir que reprocessamentos idempotentes não gerem novo alerta.

## Etapa 5 — interface

1. Adicionar `djen` aos tipos, rótulos e estados da página de Publicações.
2. Exibir “DJEN/CNJ oficial” como origem da sincronização.
3. Contar OABs e processos distintos, sem dobrar os indicadores porque há
   mais de um provedor por referência.
4. Atualizar textos vazios e mensagens de falha para não dependerem do token
   do Escavador.
5. Preservar o botão de sincronização manual e o isolamento pelo escritório
   selecionado.

## Etapa 6 — testes e validação local

1. Adicionar testes unitários do normalizador DJEN.
2. Testar paginação, parada, `429`, timeout e resposta inválida com `fetch`
   injetável.
3. Testar agrupamento global e distribuição sem vazamento entre tenants.
4. Executar suíte Vitest completa, TypeScript/build e lint aplicável.
5. Realizar uma consulta pública controlada à API oficial sem persistência.

## Etapa 7 — implantação e verificação

1. Executar `supabase db push --linked --dry-run`.
2. Aplicar a migration no projeto vinculado.
3. Publicar a Edge Function `legal-reconcile` com autenticação interna
   preservada (`verify_jwt=false` porque há validação do segredo/JWT no corpo).
4. Publicar o frontend no ambiente de produção.
5. Validar constraints, backfill, cron e primeiras execuções no banco.
6. Executar advisors de segurança e desempenho do Supabase.
7. Confirmar no produto que uma publicação oficial é exibida no escritório
   correto e que a sincronização repetida não a duplica.

## Critérios de conclusão

- Cron DJEN ativo a cada dez minutos.
- OAB/processo repetido consultado uma única vez por lote.
- Publicações isoladas por escritório e deduplicadas.
- Notificação criada apenas no primeiro ingresso.
- DataJud continua exclusivo para processos/andamentos.
- Escavador permanece complementar e não bloqueia o DJEN.
- Nenhum prazo ou tarefa é criado automaticamente.
- Testes, build, migration e advisors verificados antes da entrega.
