# Plano de implementação: solicitações de acesso, permissões e logo

**Especificação:** `docs/superpowers/specs/2026-08-24-solicitacoes-acesso-permissoes-logo-design.md`

## Objetivo

Entregar o fluxo completo de solicitação e aprovação de acesso por link
privado, restringir a gestão de permissões ao proprietário, corrigir o estado
infinito do dashboard, melhorar o diagnóstico de falhas das Edge Functions e
exibir logos completas no cabeçalho.

## Premissas de execução

- Preservar o fluxo de convite existente durante a transição.
- Usar `tenant_memberships` como fonte de verdade para autorização.
- Criar migrations pelo Supabase CLI, sem inventar nomes manualmente.
- Consultar changelog e documentação oficial atual do Supabase antes de mudar
  Auth, Edge Functions ou RLS.
- Não usar `user_metadata` para decisões de autorização.
- Aplicar RLS e `GRANT` explícitos a novas tabelas públicas.
- Executar testes focados após cada etapa e a suíte completa ao final.

## Etapa 1 — Fixar o comportamento atual com testes

### Arquivos

- Modificar: `src/test/Index.test.tsx`
- Modificar: `src/test/Equipe.test.tsx`
- Modificar: `src/test/AppHeader.test.tsx`
- Modificar: `src/test/permissions.test.ts`

### Trabalho

1. Adicionar teste que reproduza uma conta autenticada sem `currentTenant` e
   exija um estado vazio em vez de `DashboardSkeleton`.
2. Adicionar teste que comprove que administrador não pode alterar permissões.
3. Adicionar testes para a futura aba Solicitações e para os controles
   exclusivos do owner.
4. Adicionar casos de logo horizontal, quadrada e vertical, verificando limites
   e `object-contain`.
5. Executar os testes focados e confirmar que os novos casos falham pelos
   motivos esperados.

### Verificação

```powershell
npm test -- src/test/Index.test.tsx src/test/Equipe.test.tsx src/test/AppHeader.test.tsx src/test/permissions.test.ts
```

## Etapa 2 — Criar o domínio de solicitação no banco

### Arquivos

- Criar migration via `supabase migration new tenant_access_requests`
- Criar: `supabase/tests/tenant_access_requests.sql`
- Atualizar tipos gerados: `src/integrations/supabase/types.ts`

### Trabalho

1. Criar tabela de links de solicitação com hash do token, tenant, estado,
   criador e datas.
2. Criar tabela de solicitações com usuário autenticado, dados profissionais,
   estado, decisão, owner responsável e membership resultante.
3. Criar índice único parcial para uma solicitação pendente por usuário e
   tenant.
4. Criar funções auxiliares de validação do link sem expor o hash.
5. Criar operação transacional de aprovação que valide owner ativo, papel,
   alcance, equipe e overrides; crie/ative membership e perfil; conclua a
   solicitação; e grave auditoria.
6. Criar operação de rejeição e auditoria.
7. Habilitar RLS e policies para: solicitante criar/ler o próprio pedido;
   somente owner ler/decidir pedidos do tenant.
8. Revogar execução pública de funções privilegiadas e conceder apenas aos
   papéis necessários.

### Verificação

- Link válido, inválido e revogado.
- Solicitação duplicada.
- Aprovação por owner.
- Bloqueio de admin, lawyer, assistant e finance.
- Isolamento entre tenants.
- Atomicidade e eventos de auditoria.

## Etapa 3 — Implementar Edge Functions e contratos TypeScript

### Arquivos

- Criar: `supabase/functions/tenant-access-link/index.ts`
- Criar: `supabase/functions/tenant-request-access/index.ts`
- Criar: `supabase/functions/tenant-decide-access/index.ts`
- Criar: `supabase/functions/_shared/tenant-access-requests.ts`
- Modificar: `supabase/functions/_shared/tenant-auth.ts`
- Criar: `src/types/access-requests.ts`
- Criar: `src/services/access-requests.ts`
- Criar: `src/hooks/useAccessRequests.ts`
- Modificar: `src/services/team-management.ts`

### Trabalho

1. Definir schemas de entrada e saída estáveis para gerar/revogar link,
   solicitar, listar e decidir.
2. Autenticar todas as chamadas e validar o tenant no servidor.
3. Fazer as funções chamarem somente as operações SQL autorizadas.
4. Mapear códigos conhecidos para mensagens específicas.
5. Gerar um identificador de diagnóstico para falhas inesperadas e registrá-lo
   sem devolver detalhes internos.
6. Melhorar o parser de erro compartilhado do frontend e aplicá-lo também ao
   convite existente.
7. Testar timeout, resposta sem JSON, conflito, limite de plano, permissão e
   indisponibilidade.

## Etapa 4 — Criar rota pública e estado de espera

### Arquivos

- Criar: `src/pages/SolicitarAcesso.tsx`
- Criar: `src/components/auth/AccessRequestAuthOptions.tsx`
- Criar: `src/components/access/AccessRequestStatus.tsx`
- Modificar: `src/App.tsx`
- Modificar: `src/pages/Login.tsx`
- Modificar: `src/components/auth/ProtectedRoute.tsx`
- Criar: `src/test/SolicitarAcesso.test.tsx`

### Trabalho

1. Adicionar rota com token privado preservado durante login por Google e
   e-mail/senha.
2. Exibir identidade pública do escritório sem revelar lista de tenants.
3. Coletar nome, telefone e OAB após autenticação.
4. Criar solicitação e mostrar estado pendente sem entrar no ambiente do
   escritório.
5. Exibir estados aprovado, rejeitado, token inválido e token revogado.
6. Evitar que uma conta sem membership seja redirecionada para onboarding de
   criação de escritório quando estiver no fluxo de solicitação.

### Verificação

```powershell
npm test -- src/test/SolicitarAcesso.test.tsx src/test/AuthContext.test.tsx src/test/TenantContext.test.tsx
```

## Etapa 5 — Implementar aprovação na Gestão de Equipe

### Arquivos

- Modificar: `src/pages/Equipe.tsx`
- Criar: `src/components/equipe/AccessRequestsPanel.tsx`
- Criar: `src/components/equipe/AccessRequestDecisionDialog.tsx`
- Criar: `src/components/equipe/AccessLinkPanel.tsx`
- Modificar: `src/components/equipe/PermissoesPanel.tsx`
- Modificar: `src/lib/permissions.ts`
- Modificar: `src/hooks/useTeamManagement.ts`
- Modificar: `src/test/Equipe.test.tsx`

### Trabalho

1. Organizar a página nas abas Integrantes, Solicitações, Permissões e
   Histórico.
2. Permitir que somente owner visualize controles de decisão, link e matriz
   editável.
3. No diálogo de aprovação, exigir perfil, alcance, equipe quando necessária e
   apresentar as permissões agrupadas por ferramenta.
4. Expandir a matriz legível para todos os módulos acordados, mantendo as
   chaves alinhadas à função SQL de autorização.
5. Enviar a decisão em uma única operação e atualizar listas e notificações.
6. Manter convites existentes acessíveis em uma seção de compatibilidade.
7. Exibir código de diagnóstico em falhas inesperadas.

## Etapa 6 — Corrigir dashboard sem escritório

### Arquivos

- Modificar: `src/pages/Index.tsx`
- Criar ou modificar: componente de estado vazio em `src/components/dashboard/`
- Modificar: `src/test/Index.test.tsx`

### Trabalho

1. Separar explicitamente os estados `sem tenant`, `carregando`, `erro` e
   `dados carregados`.
2. Renderizar skeleton somente enquanto existe tenant e a consulta está
   carregando.
3. Para conta sem tenant, mostrar ações de criar escritório, abrir link de
   solicitação ou voltar à administração, conforme o contexto do usuário.
4. Garantir que Atualizar não tente consultar com `tenantId` ausente.

## Etapa 7 — Ajustar a logo e a pré-visualização

### Arquivos

- Modificar: `src/components/common/Logo.tsx`
- Modificar: `src/components/layout/AppHeader.tsx`
- Modificar: `src/components/layout/AppLayout.tsx` se a geometria exigir
- Modificar: `src/components/configuracoes/IdentidadeVisual.tsx`
- Modificar: `src/test/AppHeader.test.tsx`
- Adicionar teste específico de identidade visual se necessário

### Trabalho

1. Remover a altura inline rígida da logo completa e permitir limites de
   largura e altura definidos pelo contêiner.
2. Criar uma área de marca alinhada à largura da sidebar, com padding e altura
   suficientes para logos de múltiplas linhas.
3. Ajustar a posição inicial da sidebar para não haver sobreposição.
4. Manter versão compacta no mobile.
5. Melhorar a pré-visualização e avisar sobre margens transparentes internas.
6. Verificar visualmente as três proporções de logo em desktop e celular.

## Etapa 8 — Integrar notificações e histórico

### Arquivos

- Modificar componentes/serviços de notificações existentes conforme o padrão
  encontrado durante a implementação
- Modificar: `src/components/equipe/AccessRequestsPanel.tsx`
- Adicionar testes de notificações e auditoria

### Trabalho

1. Criar notificação ao owner quando surgir solicitação pendente.
2. Marcar ou encerrar a notificação após decisão.
3. Exibir no Histórico ator, solicitante, decisão, antes/depois das permissões e
   data.
4. Garantir que múltiplos owners, se existirem por compatibilidade histórica,
   recebam apenas dados do próprio tenant.

## Etapa 9 — Verificação completa e implantação

1. Executar testes SQL de autorização e fluxo.
2. Executar testes unitários e de componentes.
3. Executar lint e build.
4. Iniciar o servidor local e validar no navegador:
   - conta sem escritório;
   - solicitação por link;
   - bloqueio enquanto pendente;
   - aprovação completa por owner;
   - tentativa proibida por admin;
   - menus conforme permissão;
   - suspensão;
   - logo em desktop e mobile;
   - mensagens específicas e código de diagnóstico.
5. Rodar advisors de segurança e desempenho do Supabase e corrigir achados.
6. Revisar a migration e a lista local de migrations.
7. Implantar banco, Edge Functions e frontend nessa ordem.
8. Fazer teste com contas externas e monitorar logs após a publicação.

### Comandos finais

```powershell
npm test
npm run lint
npm run build
```

Os comandos do Supabase serão confirmados com `supabase --help` na execução,
conforme a versão instalada.

## Resultado esperado

O integrante solicita acesso sem receber permissões antecipadas; somente o
proprietário decide e configura o acesso; o banco aplica as permissões; o
dashboard não fica preso em skeleton; falhas exibem informação útil e
rastreável; e a logo aparece integralmente sem sobrepor a navegação.

