# Implementação: sincronização automática de OAB, processos e contatos

## Resultado esperado

Advogados ativos administram as próprias OABs, gestores administram todas as
inscrições do tenant e processos descobertos entram automaticamente no núcleo
jurídico. A fila do servidor continua a sincronização sem depender da tela.

## Etapa 1 — Contratos e autorização

- Centralizar a decisão `owner/admin`, advogado do próprio perfil e suporte
  ativo nas Edge Functions jurídicas.
- Fazer o overview retornar o escopo do usuário e filtrar profissionais,
  inscrições, descobertas e monitores para advogados comuns.
- Restringir sincronização manual de advogado às próprias OABs e processos
  vinculados.
- Manter confirmação/importação administrativa compatível durante a transição.
- Cobrir tentativas cruzadas entre profissionais e tenants.

Arquivos principais:

- `supabase/functions/legal-discover-lawyer-processes/index.ts`
- `supabase/functions/legal-confirm-processes/index.ts`
- `supabase/functions/legal-reconcile/index.ts`
- `src/services/legal-integration.ts`
- `src/pages/IntegracoesJuridicas.tsx`

## Etapa 2 — Importação automática

- Criar helper de servidor idempotente que transforma descobertas em processos,
  vínculos e monitores pelo RPC existente.
- Chamar o helper tanto na descoberta imediata quanto na reconciliação agendada.
- Derivar o proprietário operacional do processo pelo profissional da OAB,
  permitindo execução agendada sem ator do navegador.
- Marcar descobertas como confirmadas/importadas e preservar conflitos.
- Colocar fontes de processo recém-criadas na fila imediatamente.
- Reativar fontes válidas interrompidas pelo limite legado de tentativas.

Arquivos principais:

- `supabase/functions/_shared/legal-auto-import.ts`
- `supabase/functions/legal-discover-lawyer-processes/index.ts`
- `supabase/functions/legal-reconcile/index.ts`
- nova migration criada pela CLI do Supabase

## Etapa 3 — Contatos e enriquecimento

- Ampliar o contrato normalizado de partes para meios de contato e endereço.
- Extrair campos disponíveis nos payloads complementares sem fabricar dados.
- Preencher somente campos vazios do contato canônico e ampliar metadados de
  processos relacionados.
- Expor classificação, tipo, origem e dados disponíveis na tela de contatos.
- Preservar dados manuais e classificações bloqueadas.

Arquivos principais:

- `supabase/functions/_shared/legal-normalization.ts`
- `supabase/functions/_shared/legal-ingestion.ts`
- `src/pages/Clientes.tsx`
- `src/integrations/supabase/types.ts`

## Etapa 4 — Banco e recuperação

- Adicionar metadados mínimos necessários para sincronização automática e
  enriquecimento sem alterar dados existentes de forma destrutiva.
- Garantir RLS e grants explícitos para qualquer coluna ou função exposta.
- Criar função de importação automática restrita ao `service_role`, se o RPC
  existente não puder ser endurecido sem quebra de compatibilidade.
- Reativar fontes com `max_retries` quando a inscrição ou o processo continuar
  válido; manter credencial inválida como ação administrativa.
- Atualizar comentários e testes SQL.

## Etapa 5 — Verificação

- Testes unitários de normalização, importação, mesclagem e autorização.
- Testes de componente para advogado e gestor.
- Testes SQL de isolamento, idempotência e reativação.
- `npx tsc --noEmit`.
- testes Vitest relevantes e suíte completa quando viável.
- `npm run build`.
- lint dos arquivos alterados.
- revisão final de RLS, grants, `SECURITY DEFINER`, `search_path` e ausência de
  segredos no cliente.

## Implantação necessária

A correção só opera no ambiente hospedado depois de aplicar a migration,
publicar as Edge Functions alteradas e confirmar `project_url`, `cron_secret`,
`DATAJUD_API_KEY` e a credencial global opcional do Escavador. O cron deve
aparecer em `cron.job` e suas execuções em `cron.job_run_details`.
