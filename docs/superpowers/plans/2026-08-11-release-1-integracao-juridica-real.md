# Plano de implementação — Release 1 jurídica

## Objetivo

Entregar gestão real de OABs e sincronização jurídica automática, justa,
idempotente e observável, preservando os dados já existentes.

## Etapa 1 — Gestão transacional de OAB

- Criar uma RPC de servidor para editar ou desativar uma inscrição em uma única
  transação.
- Validar a autorização no endpoint com as mesmas regras do cadastro.
- Recalcular a OAB principal do perfil e manter processos importados.
- Desativar referências antigas, reativar as novas fontes e auditar alterações.
- Expor métodos tipados no serviço do frontend.
- Adicionar diálogo de edição e confirmação de exclusão na lista de OABs.
- Cobrir proprietário, advogado, duplicidade e preservação do histórico.

## Etapa 2 — Justiça da fila

- Extrair a seleção de fontes para uma unidade testável.
- Reservar capacidade para OAB e processo em cada ciclo.
- Alternar tenants dentro de cada grupo e ordenar por vencimento.
- Reavaliar imediatamente erros de orçamento/configuração corrigidos.
- Impedir estados `running` órfãos e manter retentativas idempotentes.

## Etapa 3 — Processo completo e resumo

- Verificar os contratos normalizados de DataJud, DJEN e Escavador.
- Persistir capa, partes, contatos, movimentos e documentos oferecidos.
- Garantir precedência de dados oficiais e proteção de alterações humanas.
- Materializar o resumo somente após haver conteúdo suficiente e persistir sua
  procedência/data de geração.
- Corrigir indicadores e abas para distinguirem ausência da fonte, pendência e
  falha.

## Etapa 4 — Observabilidade e interface

- Expor contagens duráveis de descobertos, importados, pendentes e falhos.
- Traduzir os códigos de falha e remover polling/spinner sem condição de saída.
- Mostrar última tentativa, último sucesso e próxima execução por fonte.

## Etapa 5 — Verificação e implantação

- Rodar testes unitários e de componentes a cada etapa.
- Validar migrations, RLS e funções no projeto vinculado.
- Aplicar backfill idempotente e consultar seus efeitos.
- Publicar Edge Functions e frontend.
- Verificar no navegador com proprietário e advogado comum.

## Ordem de arquivos prevista

1. `supabase/migrations/*_manage_lawyer_registrations.sql`
2. `supabase/functions/legal-discover-lawyer-processes/index.ts`
3. `src/services/legal-integration.ts`
4. `src/pages/IntegracoesJuridicas.tsx`
5. `src/test/IntegracoesJuridicas.test.tsx`
6. `supabase/functions/_shared/legal-source-scheduling.ts`
7. `supabase/functions/legal-reconcile/index.ts`
8. testes TypeScript e SQL correspondentes
9. persistência e apresentação do resumo processual

Cada etapa deve permanecer reversível e não pode apagar processos nem conteúdo
jurídico existente.
