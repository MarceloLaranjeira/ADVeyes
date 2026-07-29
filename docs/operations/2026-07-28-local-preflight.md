# Evidência de pré-voo local — 2026-07-28

## Ambiente

- Branch: `codex/multitenant-whitelabel`
- Supabase CLI: `2.107.0`
- Postgres local: `17.6`
- Docker Engine: `29.5.3`
- Project ref local: `mrgxxwllthlwxqhehjwp`
- Banco remoto de produção: não alterado

## Baseline da aplicação

- `npm test`: 9 testes existentes aprovados antes da organização.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: aprovado.
- Build mantém aviso preexistente de bundle principal maior que 500 kB.
- Teste sentinela de autenticação adicionado: 3 testes aprovados.
- Teste sentinela de assinatura por usuário: 2 testes aprovados.
- Teste sentinela SQL de RLS: 8 testes aprovados com dois usuários sintéticos.

## Reconstrução do banco

- A stack local foi criada pelo `supabase start`.
- As 29 migrations existentes foram aplicadas do zero.
- Banco, Auth, REST, Storage, Functions e Studio ficaram disponíveis.
- Analytics e Vector locais reportaram healthcheck incompatível com a
  configuração padrão do Docker no Windows. Eles não são necessários para as
  migrations multiempresa.
- Não foi executada migration no projeto remoto.
- A consulta direta a `supabase_migrations.schema_migrations` no banco remoto
  confirmou como versão mais recente `20260728031641_google_calendar_multiuser`;
  a migration local `20260728223511` não consta em produção.

## Restauração do export

Fonte local, não versionada:
`C:\Users\marce\Downloads\backend_export.zip`.

- Usuários restaurados: 3.
- Registros de aplicação restaurados: 50.
- Tabelas públicas encontradas: 36.
- Tabelas públicas sem RLS: 0.
- Objetos no bucket do export: 0.

O inventário anterior informava total de 60 registros, mas as quantidades
listadas nele e os arquivos do ZIP somam 50. O número comprovado para o ensaio
é 50.

## Divergência de grants

O projeto remoto concede DML ao papel `service_role` em `profiles`. A
reconstrução local pelas migrations concedia apenas
`REFERENCES/TRIGGER/TRUNCATE`, fazendo o importador falhar com `42501`.

Foi criada pelo Supabase CLI a migration local:

`20260728223511_align_service_role_grants.sql`

Ela concede ao backend:

- uso do schema `public`;
- `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas tabelas públicas existentes;
- uso e atualização das sequences públicas.

Depois da migration, a restauração terminou com sucesso. A migration ainda não
foi aplicada remotamente; no remoto os privilégios equivalentes já existem.

A comparação de grants também mostrou que o Supabase gerenciado concede os
privilégios-base dos papéis da API automaticamente, enquanto a reconstrução
local via migrations não os recompunha. A migration local
`20260728224603_align_api_role_grants.sql` alinha `anon` e `authenticated` ao
estado remoto e preserva as revogações especiais de assinatura e Google
Calendar.

## Validações do banco

- `supabase db lint`: nenhum problema encontrado.
- Advisor de segurança: nenhum aviso encontrado.
- Advisor de desempenho: nenhum aviso encontrado.
- O CLI encerrou advisors com código 1 por timeout ao finalizar telemetria
  PostHog, depois de imprimir `No issues found`. O erro não veio do banco.
- `service_role` local possui os sete privilégios esperados em `profiles`.

## Fundação multiempresa local

- Nove tabelas administrativas criadas com RLS e sem policy permissiva
  temporária.
- 62 testes pgTAP aprovados: 8 do isolamento legado, 20 da fundação, 24 da
  matriz de autorização, 3 da adição de `tenant_id` e 7 dos triggers de
  compatibilidade.
- Tenant `albertino` criado automaticamente depois da restauração local.
- Três memberships ativas, com exatamente um owner.
- Marca inicial, superadmin e evento de auditoria criados.
- O seed foi executado duas vezes sem duplicar tenant, memberships ou
  auditoria.
- O mapeamento das duas contas da Grazielle como `lawyer/assigned` permanece
  pendente de confirmação antes da produção.
- Helpers privados cobrem platform admin, membership ativa, papel, permissão
  por módulo e acesso a registro.
- Platform admin não recebe acesso jurídico automático.
- Escopos `team` e `assigned` negam por padrão até cada módulo possuir vínculo
  explícito de atribuição.
- 26 tabelas empresariais ou de fila receberam `tenant_id` anulável, FK e
  índice sem troca das policies legadas.
- 45 linhas existentes foram associadas ao tenant Albertino.
- O verificador de backfill encontrou zero linhas sem tenant e zero
  divergências pai/filho.
- Inserts legados agora inferem tenant por membership ou registro pai.
- Usuário multi-tenant sem contexto, spoofing e troca posterior de tenant são
  rejeitados.
- No último ensaio reset/import, os triggers preencheram as 45 linhas durante
  a própria restauração; por isso o backfill final foi idempotente e alterou
  zero linhas.

## Próximo passo

1. Criar policies tenant-aware para os módulos principais.
2. Testar dois tenants e escopos com registros sintéticos.
3. Continuar somente no banco local restaurado.
