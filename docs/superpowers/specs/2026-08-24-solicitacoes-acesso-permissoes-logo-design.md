# Solicitações de acesso, permissões do proprietário e correções de interface

## Objetivo

Substituir o convite iniciado pelo escritório por um fluxo principal em que o
integrante solicita acesso por um link privado e somente o advogado
proprietário decide a entrada e as permissões. A mesma entrega corrige o painel
que mantém o skeleton quando não existe escritório selecionado, torna os erros
de gestão de equipe diagnosticáveis e exibe a logo completa no cabeçalho.

## Problemas confirmados

1. `Index.tsx` renderiza `DashboardSkeleton` quando `tenantId` está ausente.
   Como a ausência de escritório não muda sozinha, o skeleton permanece para
   sempre e aparenta um loop, embora a consulta do dashboard esteja desativada.
2. O serviço de gestão de equipe converte falhas desconhecidas das Edge
   Functions em `operation_failed`. A interface mostra apenas “Não foi possível
   concluir”, ocultando a classe do erro e impedindo o diagnóstico operacional.
3. O fluxo atual depende de o proprietário cadastrar e convidar cada pessoa.
   Não existe solicitação de acesso iniciada pelo integrante.
4. A base já possui perfis e exceções individuais `allow`/`deny`, porém a nova
   experiência precisa deixar explícito que somente o proprietário administra
   a entrada e as permissões.
5. A logo do escritório é inserida em um bloco navy de 64 px de altura. Mesmo
   com `object-contain`, logos altas ou com várias linhas excedem a área útil e
   aparecem cortadas ou ilegíveis.

## Decisões aprovadas

- Somente a membership `owner` pode aprovar ou rejeitar solicitações e alterar
  permissões individuais.
- Administradores não recebem autoridade para aprovar acesso ou administrar a
  matriz individual.
- Cada escritório disponibiliza um link/código privado de solicitação.
- O integrante autentica-se antes de solicitar acesso.
- A solicitação não concede acesso a ferramentas ou dados enquanto estiver
  pendente.
- Na aprovação, o proprietário define perfil, alcance, equipe quando aplicável
  e permissões específicas.
- O convite atual permanece temporariamente como fluxo compatível, mas deixa
  de ser a experiência principal.
- A logo deve aparecer inteira no cabeçalho, independentemente de ser
  horizontal ou vertical.

## Fluxo de solicitação e aprovação

1. O proprietário abre a Gestão de Equipe e copia o link privado do escritório.
2. O integrante abre o link e entra com Google ou e-mail e senha. Se ainda não
   possuir uma conta, cria e confirma a conta no mesmo fluxo.
3. O backend valida o token do escritório e cria uma solicitação pendente
   vinculada ao usuário autenticado.
4. O integrante vê o estado “Aguardando autorização” e não recebe uma
   `tenant_membership` ativa.
5. O proprietário recebe uma notificação e abre a aba Solicitações.
6. Para aprovar, escolhe perfil, alcance dos dados, equipe quando o alcance for
   `team` e exceções de permissão.
7. Uma operação transacional cria ou ativa a membership, vincula ou cria o
   perfil profissional, persiste as permissões, conclui a solicitação e grava a
   auditoria.
8. O integrante passa a acessar apenas os módulos autorizados.
9. Se o proprietário rejeitar, a solicitação é encerrada e auditada sem criar
   acesso.

O proprietário pode revogar o link atual e gerar outro. A revogação impede
novas solicitações pelo token anterior, mas não altera solicitações já
decididas nem memberships existentes.

## Modelo de dados

### Link do escritório

O banco manterá um token de alta entropia por escritório, armazenando somente
seu hash, estado, datas de criação/revogação e criador. A interface mostra o
link completo apenas no momento da geração ou regeneração.

### Solicitações

Uma tabela pública protegida por RLS armazenará:

- identificador e `tenant_id`;
- usuário e e-mail autenticados;
- nome, telefone e OAB informados pelo solicitante;
- status `pending`, `approved`, `rejected` ou `cancelled`;
- criação, atualização e decisão;
- proprietário responsável pela decisão;
- motivo opcional da rejeição;
- referência à membership criada após aprovação.

Uma restrição parcial impedirá mais de uma solicitação pendente para o mesmo
usuário e escritório. Novas tabelas expostas terão RLS e `GRANT` explícitos.

### Membership e permissões

`tenant_memberships` permanece como fonte de verdade para autorização. A
aprovação grava o papel, o alcance e `permission_overrides` no formato
existente. A avaliação continua seguindo:

1. restrições absolutas de propriedade;
2. `deny` individual;
3. `allow` individual;
4. regra herdada do perfil.

O proprietário conserva acesso total e não recebe exceções editáveis.

## Interface

### Login e solicitação

O link privado abre uma rota de solicitação com a identidade do escritório. A
tela permite autenticação e, depois, confirmação dos dados profissionais. Após
o envio, mostra o estado pendente e orienta o integrante a aguardar a decisão.

Uma conta autenticada sem membership deixa de cair em um skeleton permanente.
O estado vazio oferece ações coerentes com o contexto: solicitar acesso por
link, criar um escritório quando elegível ou voltar à administração da
plataforma.

### Gestão de Equipe

A página terá quatro abas:

- **Integrantes:** ativos e suspensos;
- **Solicitações:** pendentes, aprovadas e rejeitadas;
- **Permissões:** matriz efetiva e exceções por integrante;
- **Histórico:** aprovações, rejeições, suspensões e mudanças de acesso.

Na aprovação, as ferramentas aparecem agrupadas em Escritório, Processos,
Contatos, CRM, Agenda, Tarefas, Audiências, Intimações, Integrações,
Financeiro, Horas, Contratos, Documentos, Indicadores, IA e WhatsApp. Cada
acesso editável oferece `Herdar`, `Permitir` e `Negar`.

Os menus e botões refletem a permissão efetiva para orientar o usuário, mas a
autorização definitiva continua no banco e no backend.

### Logo no cabeçalho

O bloco de marca do cabeçalho deixará de forçar a logo completa a uma altura de
40 px dentro de uma régua fixa de 64 px. A marca terá uma área própria alinhada
à sidebar, com largura máxima, altura máxima adaptável, padding e
`object-contain`. A sidebar começará abaixo dessa área sem sobreposição.

O comportamento responsivo deve preservar uma versão compacta no celular. A
pré-visualização da identidade visual avisará quando o arquivo possuir margens
transparentes internas, pois essas margens pertencem à imagem e não podem ser
removidas apenas com CSS.

## Backend e autorização

Edge Functions separadas tratarão geração/revogação do link, criação da
solicitação e decisão do proprietário. Todas autenticarão o usuário e validarão
o tenant solicitado. A decisão usará uma função transacional no banco.

Somente `owner` ativo do mesmo tenant poderá:

- listar todas as solicitações do escritório;
- aprovar ou rejeitar;
- regenerar o link;
- alterar perfil, alcance e permissões individuais.

O solicitante poderá criar e consultar somente a própria solicitação. Outros
membros não poderão listar ou decidir pedidos. Nenhuma autorização usará
`user_metadata`.

Funções privilegiadas terão `search_path` fixo, execução revogada de `PUBLIC`
e validação explícita do ator. `service_role` permanecerá somente no servidor.

## Erros e observabilidade

O frontend distinguirá erros de autenticação, token inválido ou revogado,
solicitação duplicada, permissão insuficiente, limite do plano, conflito de
estado, schema/função desatualizada, e-mail e infraestrutura.

Falhas desconhecidas continuarão com mensagem segura para o usuário, mas
receberão um identificador de diagnóstico exibido na interface e registrado no
backend. Detalhes internos do banco e credenciais nunca serão enviados ao
navegador.

O fluxo antigo de convite receberá o mesmo mapeamento de erros. Falha no envio
de e-mail não desfará uma operação de banco já confirmada; a interface mostrará
o estado persistido e permitirá nova tentativa.

## Testes e critérios de aceite

### Banco e RLS

- token válido, inválido e revogado;
- solicitação própria visível ao solicitante e isolada entre tenants;
- duplicidade pendente bloqueada;
- somente owner lista e decide solicitações do escritório;
- administrador e demais papéis não aprovam nem alteram permissões;
- aprovação cria membership, perfil, permissões e auditoria atomicamente;
- rejeição não cria acesso;
- `deny` prevalece sobre o perfil e `allow` só concede ações liberáveis.

### Frontend

- login e cadastro preservam o token da solicitação;
- estados pendente, aprovado, rejeitado, vazio e erro;
- aprovação exige perfil, alcance e equipe quando aplicável;
- matriz exibe as ferramentas acordadas;
- conta sem tenant não mostra skeleton infinito;
- mensagens de erro mostram causa útil e identificador quando necessário;
- logos horizontais, quadradas e verticais aparecem inteiras em desktop e
  celular.

### Fluxo completo

O critério final é um integrante abrir o link privado, autenticar-se, solicitar
acesso, permanecer bloqueado, ser aprovado pelo proprietário com permissões
definidas, entrar vendo somente as ferramentas autorizadas e perder o acesso
imediatamente quando suspenso. Todas as decisões e alterações devem aparecer
no histórico.

## Implantação

1. Validar changelog e documentação atual do Supabase para Auth, Edge Functions
   e RLS antes da implementação.
2. Aplicar e testar a migration em desenvolvimento.
3. Publicar as funções de solicitação e aprovação.
4. Publicar o frontend com o novo estado vazio, gestão de solicitações e ajuste
   da logo.
5. Executar advisors de segurança e desempenho.
6. Testar com contas externas de proprietário, administrador e integrante.
7. Implantar em janela de baixo uso e monitorar erros e decisões de acesso.

