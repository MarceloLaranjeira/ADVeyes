# Plano de implementação — Conta Geral, Parceiro e azul profundo

**Especificação:** `docs/superpowers/specs/2026-09-04-conta-geral-parceiro-azul-profundo-design.md`

## Resultado esperado

A Conta Geral abre o mesmo workspace do escritório selecionado com o branding
publicado; o tema global usa azul de maior contraste; e exatamente os sete
escritórios existentes na fotografia aprovada recebem o plano `parceiro` ativo,
gratuito e sem período de teste.

## Etapa 1 — Contratos do plano Parceiro

**Arquivos:**

- `src/lib/subscription-access.ts`
- `src/contexts/SubscriptionContext.tsx`
- `src/test/subscription-access.test.ts` ou teste equivalente existente

**Alterações:**

1. incluir `parceiro` em `PlanName`;
2. incluir `parceiro` em todas as entradas da matriz de recursos;
3. manter o código do catálogo como fonte do plano retornado pela assinatura;
4. testar status ativo, bloqueios por status e acesso a todos os recursos.

## Etapa 2 — Branding real na Conta Geral

**Arquivos:**

- `supabase/functions/platform-admin/index.ts`
- `src/services/platform-admin.ts`
- `src/pages/PlatformAdmin.tsx`
- `src/contexts/TenantContext.tsx`
- testes do painel/contexto administrativo

**Alterações:**

1. carregar `tenant_brand_settings` publicados junto do overview da plataforma;
2. devolver branding tipado, com fallback para `display_name`;
3. passar esse branding ao selecionar o tenant, eliminando o objeto artificial
   com logos nulas;
4. manter `accessMode: "platform"`, seleção persistida na sessão e troca segura
   entre tenants;
5. preservar leitura por padrão e suporte temporário para mutações;
6. testar branding publicado, fallback e persistência da seleção.

## Etapa 3 — Azul profundo e legibilidade

**Arquivos:**

- `src/index.css`
- `src/components/layout/AppSidebar.tsx`
- testes de contrato visual existentes

**Alterações:**

1. trocar sidebar para `#163A5F`;
2. trocar ação principal e sidebar ativa para `#255D8C`;
3. usar `#1D4B73` em hover/pressionamento;
4. manter `#F2F5F8` no fundo e branco nas superfícies;
5. elevar textos secundários da sidebar para no mínimo 82% de opacidade;
6. validar item ativo, foco, rodapé e rótulos de seção.

## Etapa 4 — Validação local

1. executar testes direcionados das três áreas alteradas;
2. executar TypeScript e lint;
3. executar toda a suíte automatizada;
4. gerar build de produção;
5. abrir a aplicação local em desktop e celular;
6. validar console, contraste, painel da Conta Geral e troca entre tenants.

## Etapa 5 — Publicação do código

1. revisar boas práticas de React após as alterações TSX;
2. publicar o frontend no Vercel em produção;
3. publicar a Edge Function `platform-admin` no Supabase;
4. confirmar deployment pronto, alias principal e resposta das rotas críticas;
5. validar a Conta Geral com pelo menos dois escritórios.

O código que reconhece `parceiro` deve estar publicado antes da alteração das
cinco assinaturas ainda em teste.

## Etapa 6 — Concessão transacional aos escritórios atuais

Antes da escrita, consultar a documentação atual do Supabase e revisar as boas
práticas de Postgres aplicáveis.

1. consultar produção e confirmar exatamente sete tenants-alvo;
2. confirmar que nenhum deles possui `asaas_subscription_id`;
3. resolver o plano ativo mais recente com código `parceiro`;
4. executar uma transação administrativa usando uma lista congelada dos sete
   UUIDs;
5. guardar o estado anterior em `price_snapshot.partner_grant.previous`;
6. atualizar tenants para `active`;
7. atualizar assinaturas para `parceiro`/`active`, limpar datas de teste e de
   cobrança e manter `asaas_customer_id` intacto;
8. inserir `platform.partner_plan_granted` em `platform_audit_events` para cada
   tenant;
9. exigir sete tenants, sete assinaturas e sete auditorias afetadas; qualquer
   divergência aborta a transação.

## Etapa 7 — Verificação final de produção

Confirmar por consultas somente leitura:

- sete tenants ativos;
- sete assinaturas ativas no plano `parceiro`;
- zero assinaturas em teste;
- zero `asaas_subscription_id`;
- sete eventos da concessão atual;
- novos cadastros continuam associados ao fluxo padrão, sem regra automática de
  concessão Parceiro.

Registrar no relatório final o deployment, a versão da Edge Function, os testes
executados e os totais verificados, sem expor UUIDs, segredos ou dados pessoais.

## Reversão

- frontend: promover o deployment anterior;
- Edge Function: republicar a versão anterior;
- dados: restaurar somente os sete UUIDs a partir de
  `price_snapshot.partner_grant.previous`, em nova transação auditada.

