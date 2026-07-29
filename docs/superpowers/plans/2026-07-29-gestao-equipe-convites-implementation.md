# Plano de implementação: gestão de equipe e convites

## Referência

Especificação aprovada:
`docs/superpowers/specs/2026-07-29-gestao-equipe-convites-design.md`.

## Resultado esperado

Proprietários e administradores poderão cadastrar um colaborador, enviar um
convite de sete dias, definir perfil e alcance, reenviar ou revogar o convite e
suspender ou reativar o acesso. O convidado poderá entrar com Google ou senha,
desde que use exatamente o e-mail convidado. O histórico profissional e de
auditoria será preservado.

## Restrições técnicas

- `tenant_memberships` permanece como fonte de verdade de autorização.
- `equipe` permanece como perfil profissional.
- A `service_role` só existe nas Edge Functions.
- Edge Functions chamadas pelo navegador exigem JWT de usuário.
- RLS e validação server-side protegem tenant, papel e alcance.
- Nenhuma autorização usa `user_metadata`.
- Migrations são criadas primeiro por `supabase migration new`.
- Todas as funções SQL expostas ao PostgREST usam `security invoker`, têm
  `search_path` vazio e `EXECUTE` concedido somente a `service_role`.

## Etapa 1 — Fixar o contrato com testes de banco

### Arquivos

- Criar `supabase/tests/tenant_member_invitation_workflow.sql`.
- Atualizar `supabase/tests/multitenant_foundation.sql` somente se novas
  colunas precisarem entrar no inventário estrutural.

### Casos iniciais

1. Proprietário convida no próprio tenant.
2. Administrador convida no próprio tenant.
3. Advogado recebe `permission_denied`.
4. Administrador de outro tenant recebe `permission_denied`.
5. Convite pendente para o mesmo e-mail é rotacionado, não duplicado.
6. Aceite com e-mail divergente falha.
7. Aceite válido cria ou ativa uma única membership.
8. Convite aceito não pode ser reutilizado.
9. Suspensão mantém o registro em `equipe`.
10. Último proprietário não pode ser suspenso ou rebaixado.

### Verificação

```powershell
npx supabase test db
```

O teste deve falhar antes da migration e passar depois dela.

## Etapa 2 — Migration do vínculo e das operações atômicas

### Criação

```powershell
npx supabase migration new tenant_member_invitation_workflow
```

Editar somente o arquivo gerado pelo comando.

### Alterações estruturais

1. Adicionar `membership_id uuid` anulável em `public.equipe`.
2. Criar FK composta
   `(tenant_id, membership_id) -> tenant_memberships(tenant_id, id)`.
3. Criar índice único parcial por `(tenant_id, membership_id)` quando o vínculo
   não for nulo.
4. Manter `equipe.user_id` por compatibilidade; em novos convites ele registra
   o usuário administrador que criou o perfil.
5. Criar índice para busca normalizada de e-mail por tenant.

### RPCs server-only

Criar funções transacionais `security invoker`:

- `public.tenant_invite_member_server(...)`
  - recebe ator, tenant, perfil profissional, papel, alcance, hash do token e
    expiração;
  - valida membership ativa do ator e `members.manage`;
  - impede convite com papel `owner`;
  - cria ou atualiza `equipe`;
  - revoga ou rotaciona convite pendente para o mesmo e-mail;
  - registra `member.invited` ou `member.reinvited`;
  - retorna IDs e dados mínimos para compor o e-mail.

- `public.tenant_accept_invite_server(...)`
  - recebe usuário autenticado, e-mail autenticado e hash do token;
  - bloqueia token ausente, expirado, revogado, aceito ou e-mail divergente;
  - cria ou reativa `tenant_memberships`;
  - vincula `equipe.membership_id`;
  - adiciona a equipe solicitada quando o alcance for `team`;
  - marca convite como aceito;
  - registra `member.invite_accepted`.

- `public.tenant_manage_member_server(...)`
  - permite `update_access`, `suspend` e `reactivate`;
  - valida ator e tenant;
  - respeita o trigger de último proprietário;
  - atualiza datas de estado e auditoria.

- `public.tenant_manage_invitation_server(...)`
  - permite `resend` e `revoke`;
  - reenvio rotaciona hash e expiração;
  - revogação é definitiva para o token atual;
  - registra auditoria.

Após criar cada função:

```sql
revoke all on function ... from public, anon, authenticated;
grant execute on function ... to service_role;
```

Não conceder acesso direto do navegador a `tenant_invitations`.

### Dados existentes

1. Vincular os registros de `equipe` aos usuários existentes quando
   `tenant_id` e e-mail identificarem exatamente uma membership.
2. Não criar vínculo quando houver ambiguidade.
3. Preservar registros profissionais sem conta.

### Verificação

```powershell
npx supabase db reset
npx supabase test db
npx supabase db lint
```

Executar consultas simulando `authenticated` para owner, admin, lawyer e outro
tenant.

## Etapa 3 — Biblioteca compartilhada das Edge Functions

### Arquivos

- Criar `supabase/functions/_shared/tenant-auth.ts`.
- Criar `supabase/functions/_shared/tenant-invitations.ts`.
- Criar `supabase/functions/_shared/tenant-email.ts`.

### Responsabilidades

`tenant-auth.ts`:

- responder CORS;
- extrair o Bearer token;
- usar `auth.getUser(token)` para obter identidade verificada;
- criar cliente do usuário e cliente administrativo;
- normalizar erros HTTP sem devolver detalhes internos.

`tenant-invitations.ts`:

- validar payloads com tipos explícitos;
- normalizar e-mail com `trim().toLowerCase()`;
- gerar 32 bytes aleatórios;
- codificar token em base64url;
- gerar SHA-256 em hexadecimal;
- calcular expiração de sete dias;
- montar URL central `/convite/aceitar?token=...`.

`tenant-email.ts`:

- escapar conteúdo dinâmico de HTML;
- carregar marca pública do tenant;
- montar HTML e texto do convite;
- enfileirar em `transactional_emails`;
- usar `message_id` e `idempotency_key` determinísticos por tentativa;
- nunca registrar o token bruto em logs.

### Testes

- Criar testes Deno para normalização, token/hash, expiração, escape de HTML e
  contrato do payload de e-mail.

## Etapa 4 — Edge Functions administrativas

### Arquivos

- Criar `supabase/functions/tenant-invite-member/index.ts`.
- Criar `supabase/functions/tenant-manage-member/index.ts`.
- Criar `supabase/functions/tenant-manage-invitation/index.ts`.
- Atualizar `supabase/config.toml`.

### Configuração

As três funções:

- mantêm `verify_jwt = true`;
- aceitam apenas `POST` e `OPTIONS`;
- verificam o usuário pelo JWT;
- chamam as RPCs com cliente administrativo;
- retornam códigos estáveis, não mensagens do Postgres.

### Contratos

`tenant-invite-member`:

```json
{
  "tenantId": "uuid",
  "profile": {
    "name": "Nome",
    "email": "email@exemplo.com",
    "phone": null,
    "jobTitle": "advogado",
    "oab": null,
    "hourlyRate": null,
    "monthlyHoursTarget": 160
  },
  "access": {
    "role": "lawyer",
    "dataScope": "assigned",
    "teamId": null
  }
}
```

Resposta:

```json
{
  "invitationId": "uuid",
  "memberId": "uuid",
  "status": "pending",
  "emailQueued": true,
  "expiresAt": "ISO-8601"
}
```

Se o e-mail falhar, responder sucesso do convite com `emailQueued: false`.

`tenant-manage-member`:

```json
{
  "tenantId": "uuid",
  "membershipId": "uuid",
  "action": "update_access|suspend|reactivate",
  "role": "lawyer",
  "dataScope": "assigned",
  "teamId": null
}
```

`tenant-manage-invitation`:

```json
{
  "tenantId": "uuid",
  "invitationId": "uuid",
  "action": "resend|revoke"
}
```

### Erros estáveis

- `unauthorized`
- `permission_denied`
- `tenant_not_found`
- `member_already_active`
- `invitation_not_found`
- `invitation_not_pending`
- `email_queue_failed`
- `invalid_payload`

## Etapa 5 — Edge Function de aceite

### Arquivos

- Criar `supabase/functions/tenant-accept-invite/index.ts`.
- Atualizar `supabase/config.toml`.

### Regras

- `verify_jwt = true`;
- aceita apenas usuário autenticado;
- obtém e-mail verificado de `auth.getUser`, nunca do corpo;
- recebe somente o token bruto;
- calcula o hash dentro da função;
- chama `tenant_accept_invite_server`;
- não revela tenant ou e-mail quando o token é inválido.

### Erros estáveis

- `invalid_invitation`
- `invitation_expired`
- `invitation_unavailable`
- `email_mismatch`
- `already_accepted`

## Etapa 6 — Camada TypeScript do frontend

### Arquivos

- Criar `src/types/team-management.ts`.
- Criar `src/services/team-management.ts`.
- Criar `src/hooks/useTeamManagement.ts`.
- Atualizar `src/integrations/supabase/types.ts` após a migration.

### Serviço

O serviço encapsula:

- leitura de `equipe` e dados administrativos permitidos;
- `inviteMember`;
- `updateMemberAccess`;
- `suspendMember`;
- `reactivateMember`;
- `resendInvitation`;
- `revokeInvitation`;
- `acceptInvitation`.

Toda chamada usa `withTimeout` e converte códigos do backend em mensagens
portuguesas. Nenhum componente chama RPC server-only diretamente.

### Hook

`useTeamManagement`:

- exige `currentTenant`;
- mantém membros, convites, equipes, loading e erro;
- recarrega após mutações;
- evita respostas de requests obsoletos;
- oferece retry explícito.

## Etapa 7 — Nova página de Gestão de Equipe

### Arquivos

- Refatorar `src/pages/Equipe.tsx`.
- Criar `src/components/equipe/TeamStats.tsx`.
- Criar `src/components/equipe/TeamTabs.tsx`.
- Criar `src/components/equipe/MemberTable.tsx`.
- Criar `src/components/equipe/MemberFormDialog.tsx`.
- Criar `src/components/equipe/MemberActionsMenu.tsx`.
- Criar `src/components/equipe/PendingInvitations.tsx`.
- Criar `src/components/equipe/TeamsAndAssignments.tsx`.
- Criar `src/components/equipe/ConfirmMemberAction.tsx`.

### Comportamento

- Exibir ações administrativas somente para `owner` e `admin`.
- Manter indicadores de horas e faturamento existentes em seção secundária.
- Exibir status `Ativo`, `Convidado` e `Suspenso`.
- Exibir papel e alcance em linguagem simples.
- O formulário ajusta campos:
  - `team` exige equipe;
  - `assigned` não exige equipe;
  - `tenant` informa acesso integral permitido pelo perfil.
- Suspensão e revogação exigem confirmação.
- Falha no e-mail oferece `Reenviar`.

### Testes

- Criar `src/test/Equipe.test.tsx`.
- Cobrir owner/admin, usuário sem permissão, estados vazio/erro/loading, convite,
  reenvio, revogação, suspensão e reativação.

## Etapa 8 — Página pública de aceite

### Arquivos

- Criar `src/pages/ConviteAceite.tsx`.
- Criar `src/components/auth/InvitationAuthOptions.tsx`.
- Atualizar `src/App.tsx`.
- Ajustar `src/pages/Login.tsx` apenas para reutilizar funções de autenticação,
  se necessário.

### Rota

Adicionar:

```tsx
<Route path="/convite/aceitar" element={<ConviteAceite />} />
```

A rota fica fora de `ProtectedRoute`, mas a chamada de aceite exige sessão.

### Preservação segura do token

1. Ler `token` da URL.
2. Guardar temporariamente em `sessionStorage`.
3. Remover o token visível da barra com `history.replaceState`.
4. Para Google OAuth, usar
   `redirectTo: ${origin}/convite/aceitar`.
5. Após o retorno, recuperar o token, aceitar o convite e removê-lo do
   `sessionStorage`.

Não registrar nem enviar o token para analytics.

### Estados

- convite aguardando autenticação;
- autenticando com Google;
- formulário de e-mail e senha;
- validando convite;
- aceito com sucesso;
- expirado;
- e-mail divergente;
- inválido ou indisponível.

### Testes

- Criar `src/test/ConviteAceite.test.tsx`.
- Cobrir token ausente, armazenamento e remoção da URL, retorno OAuth, aceite,
  divergência, expiração e retry.

## Etapa 9 — E-mail e processamento da fila

### Arquivos

- Atualizar `supabase/functions/process-email-queue/index.ts` somente se o
  payload de convite exigir novos campos.
- Criar fixture/teste do payload transacional de convite.

### Conteúdo

- nome e marca do escritório;
- nome do convidado;
- perfil e descrição do alcance;
- validade de sete dias;
- botão `Aceitar convite`;
- aviso para ignorar o e-mail se não reconhecer o convite;
- versão texto equivalente.

Desabilitar rastreamento que reescreva URLs no provedor de e-mail.

## Etapa 10 — Validação integrada local

### Banco

```powershell
npx supabase db reset
npx supabase test db
npx supabase db lint
npx supabase db advisors --local
```

### Frontend

```powershell
npm test
npx tsc --noEmit
npx eslint src/pages/Equipe.tsx src/pages/ConviteAceite.tsx src/components/equipe src/components/auth/InvitationAuthOptions.tsx src/services/team-management.ts src/hooks/useTeamManagement.ts src/types/team-management.ts
npm run build
```

### Edge Functions

```powershell
npx supabase functions serve
```

Validar manualmente:

1. convite por owner;
2. convite por admin;
3. bloqueio para lawyer;
4. aceite com Google;
5. aceite com senha;
6. e-mail diferente;
7. reenvio;
8. revogação;
9. suspensão;
10. isolamento com segundo tenant.

## Etapa 11 — Implantação controlada

1. Confirmar migration list local/remota.
2. Executar advisors antes do push.
3. Aplicar migration com `supabase db push --linked --yes`.
4. Implantar as quatro Edge Functions.
5. Confirmar `verify_jwt` remoto.
6. Testar convite com uma conta externa não administrativa.
7. Publicar o frontend.
8. Repetir aceite, suspensão e tentativa de novo acesso em produção.
9. Consultar `tenant_audit_events`, fila e `email_send_log`.

## Sequência de commits

1. `test: cobrir fluxo de convites por tenant`
2. `feat: adicionar vínculo e operações de convite`
3. `feat: criar funções de convite e gestão de membros`
4. `feat: adicionar serviço e hook de gestão de equipe`
5. `feat: renovar tela de gestão de equipe`
6. `feat: adicionar aceite de convite`
7. `test: validar fluxo completo de equipe`
8. `chore: preparar implantação de convites`

## Condição de encerramento

A entrega termina somente quando:

- os testes de RLS confirmarem isolamento;
- um convite real for recebido;
- Google e senha aceitarem o convite correto;
- outro e-mail for bloqueado;
- o usuário enxergar somente o alcance configurado;
- a suspensão bloquear o acesso sem apagar histórico;
- a auditoria e o log de e-mail registrarem todas as etapas.

