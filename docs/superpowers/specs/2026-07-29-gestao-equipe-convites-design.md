# Gestão de equipe e convites por escritório

## Objetivo

Permitir que proprietários e administradores de cada escritório convidem,
gerenciem e suspendam usuários no ADVeyes sem intervenção da Automatikus. O
fluxo deve funcionar com login por Google ou e-mail e senha, preservar o
histórico de colaboradores desligados e impedir qualquer acesso entre
escritórios.

## Decisões aprovadas

- O cadastro de um novo membro envia o convite automaticamente.
- Proprietários e administradores podem convidar e gerenciar membros.
- O desligamento suspende o acesso imediatamente e preserva o histórico.
- As permissões usam perfis prontos com alcance ajustável.
- O convite vale por sete dias e pode ser reenviado.
- Somente uma conta com o e-mail convidado pode aceitar o convite.
- O e-mail e a página de aceite usam a marca do escritório.

## Escopo

### Incluído

- Lista unificada de membros ativos, convidados e suspensos.
- Cadastro profissional e configuração de acesso no mesmo fluxo.
- Convite por e-mail com token seguro.
- Aceite por Google ou e-mail e senha.
- Perfis `admin`, `lawyer`, `assistant` e `finance`.
- Alcances `tenant`, `team` e `assigned`.
- Reenvio e revogação de convites.
- Edição de perfil e alcance.
- Suspensão e reativação de acesso.
- Registro de auditoria para todas as ações administrativas.
- Equipes e atribuições como base para o alcance `team`.

### Não incluído nesta entrega

- Permissões granulares por caixas de seleção.
- Exclusão física de usuários e do histórico.
- Convites aceitos por um e-mail diferente.
- Administração de usuários de outro escritório.
- Transferência automática da propriedade do escritório.

## Situação atual

A página `Equipe` administra registros profissionais na tabela `equipe`, mas
esses registros não representam necessariamente contas com acesso. O acesso
multi-tenant já está modelado em `tenant_memberships`; convites e auditoria já
possuem as tabelas `tenant_invitations` e `tenant_audit_events`. A nova
experiência deve conectar essas estruturas sem usar `equipe.user_id` como
autorização.

## Experiência do administrador

A página de Gestão de Equipe terá:

- indicadores de membros ativos, convites pendentes e suspensos;
- abas para Membros, Convites pendentes e Equipes e atribuições;
- tabela com pessoa, perfil, alcance, status e ações;
- ação principal `Novo membro`;
- ações contextuais para editar, reenviar, revogar, suspender, reativar e
  consultar histórico.

O formulário de novo membro solicitará:

- nome;
- e-mail;
- telefone opcional;
- cargo e OAB, quando aplicável;
- perfil de acesso;
- alcance dos dados;
- equipe, quando o alcance for `team`;
- valor por hora e meta mensal opcionais.

Ao confirmar, o membro aparece imediatamente como `Convidado`. A falha no
envio do e-mail não desfaz o convite; a interface informa a falha e oferece
reenvio.

## Fluxo do convite

1. Um proprietário ou administrador informa os dados do novo membro.
2. O backend valida a membership ativa e a permissão `members.manage`.
3. Uma operação transacional cria ou atualiza o registro profissional, cria o
   convite pendente e registra a auditoria.
4. Um token aleatório de alta entropia é entregue no link, mas somente seu hash
   é persistido.
5. O convite é enviado pela infraestrutura de fila de e-mails do ADVeyes com a
   marca do escritório.
6. A página de aceite permite login com Google ou e-mail e senha.
7. Após a autenticação, o backend valida o hash, o status, a validade e a
   igualdade entre o e-mail autenticado e o e-mail convidado.
8. O convite é marcado como aceito, a membership é criada ou ativada e o
   registro profissional é vinculado à membership.
9. O usuário entra no escritório com o perfil e o alcance definidos no
   convite.

## Componentes técnicos

### Banco de dados

- `equipe` continua sendo o perfil profissional do colaborador.
- `tenant_memberships` continua sendo a fonte de verdade para autorização.
- `tenant_invitations` controla token, prazo, estado e aceite.
- `tenant_audit_events` registra ações administrativas.
- `tenant_teams`, `tenant_team_members` e `tenant_record_assignments`
  controlam acesso por equipe ou atribuição.

Uma migration adicionará a ligação opcional e única entre o registro de
`equipe` e a `tenant_membership`, além dos índices necessários. Registros
legados permanecem válidos mesmo quando ainda não possuem uma conta vinculada.

### Backend

Serão criadas funções de backend com responsabilidades separadas:

- `tenant-invite-member`: cria o perfil, o convite, a auditoria e enfileira o
  e-mail;
- `tenant-accept-invite`: valida o convidado autenticado e ativa a membership;
- `tenant-manage-member`: edita perfil/alcance, suspende ou reativa;
- `tenant-manage-invitation`: reenvia ou revoga convite pendente.

As operações privilegiadas usam credenciais de servidor apenas nas Edge
Functions. A `service_role` nunca é enviada ao navegador. Cada função valida o
usuário autenticado, o tenant solicitado e a permissão antes de acessar dados.

### Frontend

- `Equipe.tsx` será dividido em componentes menores para lista, indicadores,
  formulário, convite e ações.
- A página usará o tenant atual fornecido por `TenantContext`.
- O formulário não escreverá diretamente em `auth.users`.
- A rota pública de aceite preservará o token durante o login OAuth e retomará
  a validação após o retorno do Google.
- Estados de carregamento terão limite de tempo e opção explícita de tentar
  novamente.

## Perfis e alcance

| Perfil | Uso padrão | Administração de membros |
| --- | --- | --- |
| Proprietário | Controle integral e propriedade | Sim |
| Administrador | Gestão operacional integral | Sim |
| Advogado | Rotina jurídica | Não |
| Assistente | Apoio operacional | Não |
| Financeiro | Módulos financeiros autorizados | Não |

| Alcance | Registros visíveis |
| --- | --- |
| Todo o escritório (`tenant`) | Registros do tenant permitidos pelo perfil |
| Equipe (`team`) | Registros atribuídos às equipes do membro |
| Atribuídos (`assigned`) | Somente registros atribuídos ao membro |

As políticas RLS continuam sendo a barreira definitiva. Ocultar uma ação na
interface não substitui a validação no backend ou no banco.

## Segurança

- Convites duram sete dias.
- Tokens são de uso único e persistidos apenas como hash.
- Aceite exige correspondência exata e normalizada do e-mail.
- Apenas proprietário e administrador podem gerenciar membros.
- Um escritório não consulta membros, convites ou equipes de outro.
- O último proprietário ativo não pode ser suspenso, removido ou rebaixado.
- Convites revogados, aceitos ou expirados não podem ser reutilizados.
- Ações administrativas geram eventos de auditoria com ator, alvo e tenant.
- Suspensão bloqueia imediatamente novas consultas protegidas por RLS.
- Nenhuma operação depende de `user_metadata` para autorização.

## Estados e tratamento de erros

### Convites

- Um convite pendente para o mesmo e-mail é reenviado em vez de duplicado.
- Um usuário já ativo gera uma mensagem informativa e não recebe outro
  convite.
- Um convite expirado pode ser substituído por um novo token.
- Falha temporária no e-mail mantém o convite pendente.
- E-mail divergente bloqueia o aceite sem revelar dados do escritório.

### Membros

- Suspensão preserva o perfil, horas, processos, atribuições e auditoria.
- Reativação restaura a membership anterior, salvo alteração explícita de
  perfil ou alcance.
- A interface exige confirmação antes de suspender ou revogar.
- Operações simultâneas usam restrições únicas e transações para evitar
  duplicidade.

## Testes

### Banco e RLS

- proprietário e administrador leem e gerenciam membros do próprio tenant;
- advogado não gerencia memberships ou convites;
- nenhum perfil acessa registros de outro tenant;
- alcance `tenant`, `team` e `assigned` retorna apenas registros permitidos;
- o último proprietário não pode ser desativado.

### Backend

- convite novo, reenvio, revogação e expiração;
- usuário existente e usuário novo;
- aceite com Google e com senha;
- bloqueio por e-mail divergente;
- token inválido, usado, revogado ou expirado;
- falha no enfileiramento do e-mail;
- auditoria criada para cada mudança.

### Frontend

- estados vazio, carregando, erro e sucesso;
- visualização de ativos, convidados e suspensos;
- seleção de perfil e alcance;
- confirmação de suspensão e revogação;
- retomada do convite após OAuth;
- responsividade em desktop e celular.

### Fluxo completo

O critério de conclusão é um novo usuário receber o convite, autenticar-se,
entrar no escritório com somente os dados permitidos e perder o acesso
imediatamente quando for suspenso, sem perda de histórico.

## Implantação

1. Aplicar migration e validar RLS em ambiente de desenvolvimento.
2. Publicar Edge Functions e configurar os segredos de envio.
3. Publicar o frontend com a nova rota de aceite.
4. Testar com uma conta externa de convite.
5. Aplicar em produção durante uma janela de baixo uso.
6. Monitorar logs de convite, aceite, e-mail e auditoria.

