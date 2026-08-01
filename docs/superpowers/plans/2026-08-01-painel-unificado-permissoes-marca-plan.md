# Plano de implementação — painel unificado, permissões e marca

## Etapa 1 — Banco e autorização

1. Criar migration via Supabase CLI.
2. Corrigir a policy de leitura de `tenant_brand_settings`.
3. Evoluir `permission_overrides` para `inherit | allow | deny`, preservando
   valores booleanos antigos como `allow`.
4. Atualizar `private.has_tenant_permission` para aplicar restrições absolutas,
   `deny`, `allow` e matriz base nessa ordem.
5. Criar `platform_support_sessions`, índices, RLS e helpers de sessão ativa.
6. Permitir leitura de tenant a administradores da plataforma e escrita somente
   com sessão de suporte ativa.
7. Criar RPC de edição segura de perfil e auditoria.

## Etapa 2 — Edge Functions

1. Expandir `platform-admin` com contexto do escritório e ações de iniciar,
   consultar e encerrar suporte.
2. Expandir `tenant-manage-member` para permissões tri-state e edição de perfil.
3. Normalizar erros sem expor detalhes internos.
4. Testar autenticação, expiração e regras exclusivas do proprietário.

## Etapa 3 — Contextos e shell

1. Estender `TenantContext` para ambientes de membro e ambientes da plataforma.
2. Persistir e revalidar o escritório observado após recarregar a página.
3. Criar `PlatformSupportContext` e banner de sessão temporária.
4. Unificar `PlatformAdmin` com `AppLayout`.
5. Exibir navegação da Conta Geral e, quando houver seleção, todos os menus do
   escritório no mesmo sidebar.

## Etapa 4 — Equipe, perfil e marca

1. Transformar a tela de permissões em seletor tri-state por pessoa.
2. Manter a matriz por perfil como referência visível.
3. Adicionar edição de nome, foto, telefone e OAB.
4. Aplicar capacidade de escrita ao componente de identidade visual.
5. Melhorar mensagens de upload, permissão e conflito.

## Etapa 5 — Verificação e publicação

1. Atualizar tipos TypeScript.
2. Adicionar testes unitários e de componentes.
3. Rodar `tsc`, Vitest e build.
4. Aplicar migrations e Edge Functions no projeto vinculado.
5. Rodar advisors e consultas de verificação.
6. Publicar no Vercel e validar no domínio oficial.
