# Cadastro autônomo, onboarding e ativação OAB/DJEN

Data: 2026-08-08  
Status: aprovado em conversa; aguardando revisão do documento  
Escopo: apresentação pública, criação de conta e escritório, primeira experiência e ativação do monitoramento jurídico

## 1. Contexto

O ADVeyes já possui landing page, login por senha e Google, autenticação Supabase,
piloto, estrutura multitenant, cadastro de OAB, descoberta de processos e ingestão
oficial do DJEN/CNJ. O acesso atual, porém, não oferece criação autônoma de conta e
escritório. Também não conduz um novo cliente até a ativação dos recursos que geram
valor na primeira sessão.

Esta entrega cria uma entrada comercial e operacional própria do ADVeyes, inspirada
na clareza do fluxo observado no ADVBOX sem reproduzir sua identidade visual. O novo
cliente poderá conhecer o produto, criar sua conta e seu escritório e iniciar o
monitoramento jurídico sem intervenção administrativa.

## 2. Objetivos

- Permitir cadastro autônomo por Google ou e-mail e senha.
- Criar um novo escritório, seu proprietário e o piloto de 14 dias sem cartão.
- Oferecer uma experiência de entrada curta, clara e retomável.
- Usar OAB e UF para descobrir processos e ativar a ingestão oficial do DJEN/CNJ.
- Transformar cada publicação inédita em notificação e tarefa de revisão.
- Manter qualquer prazo sugerido sujeito à confirmação humana.
- Preservar isolamento multitenant, idempotência e recuperação de falhas.
- Medir o funil entre apresentação, cadastro, ativação da OAB e primeira sincronização.

## 3. Fora do escopo

- Cobrança de cartão durante o cadastro.
- Aprovação manual de cada novo escritório pela plataforma.
- Importação integral de dados de outro software jurídico.
- Tornar obrigatório o preenchimento da OAB antes de acessar o painel.
- Confirmar automaticamente prazo processual sugerido pelo sistema.
- Reformular módulos internos que não participem da primeira experiência.

## 4. Decisões aprovadas

1. O cadastro é autônomo: o criador torna-se proprietário do escritório.
2. O piloto dura 14 dias e não exige cartão.
3. O cadastro aceita Google e e-mail/senha.
4. Contas criadas por senha devem confirmar o e-mail; o Google já fornece identidade
   verificada.
5. O onboarding pode ser pulado e retomado do ponto em que parou.
6. OAB e UF são necessárias para descoberta automática de processos e publicações,
   mas não para usar as demais áreas do painel.
7. Publicação inédita gera notificação e tarefa `Revisar intimação` para o advogado
   monitorado.
8. Prazo calculado ou extraído é sugestão até confirmação humana.
9. A direção visual usa azul-marinho, azul vivo, branco/azul-claro, verde para sucesso
   e amarelo apenas para destaque ou pendência.

## 5. Jornada do usuário

### 5.1 Apresentação pública

A landing pública continua sendo o principal material de descoberta. Seus CTAs
`Começar grátis`, `Teste grátis` e equivalentes passam a apontar para `/cadastro`,
enquanto `Entrar` continua apontando para `/login`.

A apresentação deve comunicar, antes da solicitação de compromisso:

- processos, publicações, tarefas, prazos e equipe em uma só operação;
- integração oficial DJEN/CNJ;
- isolamento e segurança dos dados;
- piloto de 14 dias sem cartão;
- próximo passo previsível e sem surpresa.

### 5.2 Cadastro em duas colunas

A rota `/cadastro` usa a opção visual A aprovada:

- coluna esquerda azul profundo com marca, proposta de valor, piloto e sinais de
  confiança;
- coluna direita branca com progresso e formulário;
- primeira etapa com Google ou nome completo, e-mail e senha;
- segunda etapa, após autenticação, com nome do escritório;
- links visíveis para entrar, termos de uso e política de privacidade.

O formulário usa rótulos persistentes, validação no próprio campo, preenchimento
automático do navegador, exibição opcional da senha e mensagens específicas. Não há
confirmação duplicada de e-mail nem coleta de telefone, endereço, cargo ou tamanho da
equipe no cadastro.

### 5.3 Confirmação e retomada

Cadastro com senha sem sessão ativa leva a `/cadastro/confirmar`. A tela explica como
confirmar o e-mail, oferece reenvio, lembra a pasta de spam e permite corrigir o
endereço. O redirecionamento confirmado volta a `/cadastro/escritorio`.

O cadastro por Google retorna diretamente a `/cadastro/escritorio`. Usuário
autenticado sem vínculo ativo com escritório também é direcionado a essa rota. A
retomada não depende de metadados editáveis para autorizar qualquer operação.

### 5.4 Criação do escritório

Depois da autenticação, o usuário informa somente o nome de exibição do escritório.
O nome jurídico pode ser complementado posteriormente nas configurações. O slug é
gerado automaticamente, normalizado e recebe sufixo seguro em caso de colisão.

Uma única operação transacional cria ou retorna:

- `tenants`, com estado `trialing`, início imediato e término em 14 dias;
- `tenant_memberships`, com o usuário como `owner`, `active` e escopo `tenant`;
- `tenant_brand_settings`, com a identidade padrão ADVeyes;
- `tenant_subscriptions`, com o plano de piloto aprovado;
- estado inicial do onboarding.

Após sucesso, o contexto de tenant seleciona o novo escritório e encaminha para
`/boas-vindas`.

### 5.5 Onboarding retomável

O onboarding tem três grupos curtos:

1. Boas-vindas e confirmação de que conta e escritório estão prontos.
2. OAB e Diário de Justiça: número da OAB, tipo e UF.
3. Convite opcional da equipe.

Todas as etapas oferecem retorno e `Fazer isso depois`. O progresso é persistido por
escritório, não apenas no navegador. Ao retomar, o cliente volta ao primeiro passo
incompleto.

Ao pular a OAB, o painel permanece liberado e apresenta:

- aviso azul `Ative processos e publicações oficiais`;
- botão `Continuar configuração`;
- checklist com percentual e etapas pendentes;
- estados vazios que explicam por que processos ou publicações ainda não chegaram.

O aviso principal pode ser dispensado durante a sessão, mas a pendência continua no
checklist até a configuração ser concluída.

### 5.6 Ativação OAB/DJEN

Ao enviar OAB e UF:

1. validar formato, tipo e UF;
2. persistir ou atualizar `lawyer_registrations` no tenant atual;
3. iniciar descoberta de processos pela integração jurídica existente;
4. ativar fonte oficial DJEN/CNJ por OAB/UF e fontes dos processos confirmados;
5. mostrar sincronização em segundo plano, sem bloquear o painel;
6. notificar sucesso, falha recuperável ou necessidade de correção.

A indisponibilidade temporária do provedor não desfaz a OAB. A fonte registra a falha
e entra novamente na política normal de reconciliação.

## 6. Direção visual

### 6.1 Paleta

- Azul-marinho `#081B48`: marca, confiança, coluna de apresentação e navegação.
- Azul profundo `#153B86`: gradiente e superfícies institucionais.
- Azul de ação `#2563EB`: botões, links, progresso e foco.
- Azul-claro `#DBEAFE`/`#EFF6FF`: informações e estados vazios.
- Verde: validação, sincronização concluída e etapas completas.
- Amarelo: piloto, atenção e pendências; nunca como ação principal.
- Branco e cinzas neutros: formulários e conteúdo.

### 6.2 Telas aprovadas

1. Cadastro: apresentação azul à esquerda e formulário branco à direita.
2. OAB/DJEN: painel lateral no mesmo azul da primeira tela; conteúdo branco à direita.
3. Primeiro painel: navegação azul, chamada de retomada, métricas vazias explicativas
   e progresso do onboarding.

### 6.3 Responsividade e acessibilidade

- Em telas pequenas, a coluna de apresentação vira um cabeçalho compacto acima do
  formulário.
- Fluxo em coluna única, alvos de toque de pelo menos 44 px e botão principal visível.
- Contraste mínimo WCAG AA, foco visível e navegação por teclado.
- Erros associados aos campos por texto, ícone e atributos acessíveis; cor não é o
  único indicador.
- Estados de carregamento não removem o conteúdo necessário para orientação.

## 7. Arquitetura de front-end

### 7.1 Rotas

| Rota | Responsabilidade |
| --- | --- |
| `/landing` | Apresentação pública e entrada do funil |
| `/login` | Entrada de contas existentes, agora com link de cadastro |
| `/cadastro` | Identidade por Google ou e-mail/senha |
| `/cadastro/confirmar` | Confirmação, reenvio e correção de e-mail |
| `/cadastro/escritorio` | Nome e provisionamento do escritório |
| `/boas-vindas` | Onboarding retomável |
| `/` | Painel com checklist quando houver pendências |

### 7.2 Limites de componentes

- `PublicEntryLayout`: composição visual comum a login e cadastro.
- `SignupIdentityStep`: Google, e-mail, senha, termos e validação.
- `EmailConfirmationState`: reenvio e correção do endereço.
- `OfficeProvisioningStep`: nome do escritório e resultado do provisionamento.
- `OnboardingShell`: progresso, navegação, pular e retomar.
- `OabSetupStep`: validação e ativação das fontes jurídicas.
- `TeamInviteStep`: convite opcional usando o fluxo existente.
- `OnboardingChecklist`: resumo reutilizável no painel.

Os componentes não acessam tabelas diretamente. Serviços de autenticação,
provisionamento, onboarding e integração jurídica expõem contratos tipados e são
consumidos por hooks específicos.

### 7.3 Guardas e redirecionamentos

- Visitante em rota protegida continua indo para `/login?next=...`.
- Usuário autenticado sem tenant ativo vai para `/cadastro/escritorio`.
- Usuário com tenant e onboarding pendente pode entrar no painel.
- Usuário com tenant que visita `/cadastro` é levado ao painel, salvo quando houver
  intenção explícita e autorizada de criar outro escritório no futuro.
- Redirecionamentos `next` aceitam somente caminhos internos seguros.

## 8. Arquitetura de dados e servidor

### 8.1 Provisionamento transacional

Uma função de banco idempotente, acionada por uma Edge Function autenticada, executa
o provisionamento em uma transação. A função:

- exige `auth.uid()` válido;
- não usa `user_metadata` para autorização;
- serializa tentativas concorrentes do mesmo usuário;
- valida e normaliza os nomes;
- retorna o tenant já criado quando a mesma operação é repetida;
- cria tenant, proprietário, marca, piloto e onboarding conjuntamente;
- registra evento de auditoria;
- possui `search_path` fechado e privilégio de execução concedido somente aos papéis
  necessários.

A Edge Function valida o contrato HTTP, aplica limites e converte erros internos em
mensagens estáveis. A chave `service_role` nunca é enviada ao navegador.

### 8.2 Estado do onboarding

Adicionar a tabela `tenant_onboarding`, com uma linha por tenant, contendo:

- `tenant_id` como chave primária;
- versão do fluxo;
- etapa atual;
- estados das etapas de escritório, OAB e equipe;
- `skipped_at`, `completed_at`, `created_at` e `updated_at`;
- metadados não sensíveis necessários para retomada.

A tabela terá RLS restrita a membros ativos do tenant; alteração do estado exigirá
permissão compatível. O progresso será derivado das etapas concluídas, não de um
percentual gravado livremente.

### 8.3 Ligação entre publicação e tarefa

Adicionar a tabela de ligação idempotente `publication_task_links`, com `tenant_id`,
`publication_id`, `task_id` e timestamps.
Uma restrição única por tenant e publicação impede duplicação mesmo quando a
reconciliação é repetida.

Depois de persistir uma publicação inédita, a automação:

1. identifica o advogado pela OAB monitorada;
2. cria notificação de nova publicação;
3. cria tarefa `Revisar intimação`, atribuída ao advogado quando possível;
4. vincula publicação, processo e tarefa;
5. anexa a sugestão de prazo como informação não confirmada;
6. registra auditoria e mantém a publicação mesmo se a notificação falhar.

Se não houver advogado atribuível, a tarefa permanece visível na fila do escritório
para distribuição. Nenhuma automação marca a tarefa ou o prazo como concluído.

## 9. Tratamento de erros

| Situação | Comportamento |
| --- | --- |
| E-mail já cadastrado | Oferecer login ou recuperação de senha |
| Confirmação não recebida | Reenviar com limite e permitir corrigir o e-mail |
| Nome/slug em colisão | Gerar slug alternativo sem pedir decisão técnica ao cliente |
| Clique ou callback repetido | Retornar o mesmo escritório, sem duplicar registros |
| Provisionamento incompleto | Fazer rollback integral e permitir nova tentativa |
| OAB inválida | Preservar valores e indicar campo/formato incorreto |
| Provedor jurídico indisponível | Salvar OAB, marcar sincronização pendente e reagendar |
| Publicação repetida | Reutilizar registro e não criar nova notificação/tarefa |
| Falha ao notificar | Preservar publicação e tarefa; registrar falha recuperável |
| Prazo ambíguo | Exibir justificativa e exigir confirmação humana |

## 10. Métricas

Eventos mínimos, sem texto de processo ou dados jurídicos sensíveis:

- `signup_viewed`;
- `signup_started` por método;
- `signup_identity_created`;
- `signup_email_confirmed`;
- `tenant_provisioned`;
- `onboarding_step_viewed`, `completed` ou `skipped`;
- `oab_configured`;
- `legal_sync_started`, `completed` ou `failed`;
- `first_publication_received`;
- `first_publication_task_created`.

Indicadores: início e conclusão do cadastro, abandono por etapa, tempo até criação do
tenant, ativação da OAB, tempo até primeira sincronização e tempo até primeira
publicação/tarefa.

## 11. Testes e critérios de aceitação

### 11.1 Banco e segurança

- pgTAP para provisionamento completo, rollback e idempotência.
- Usuário A nunca lê ou altera onboarding, publicação ou tarefa do tenant B.
- Usuário não autenticado e membro inativo não provisionam nem alteram onboarding.
- Funções privilegiadas não concedem execução pública implícita.
- O último proprietário ativo continua protegido.
- Publicação repetida mantém uma única ligação e uma única tarefa.

### 11.2 Front-end

- Testes de componentes para todos os passos, validações e mensagens.
- Cadastro por senha: confirmação, reenvio, retorno e provisionamento.
- Cadastro por Google: callback, provisionamento e retorno seguro.
- Redirecionamento de autenticado sem tenant e de usuário já provisionado.
- Pular, retomar e concluir onboarding.
- Checklist acompanha o estado real do banco.
- OAB inválida, indisponibilidade e sincronização concluída.
- Visualização responsiva, foco e operação por teclado.

### 11.3 Fluxo completo

Em ambiente de teste, automatizar:

1. abrir a landing e iniciar cadastro;
2. criar/confirmar identidade;
3. criar escritório e validar proprietário/piloto;
4. pular OAB, entrar no painel e retomar;
5. cadastrar OAB/UF e observar sincronização;
6. ingerir publicação de teste duas vezes;
7. confirmar uma publicação, uma notificação e uma tarefa;
8. confirmar que prazo continua pendente de revisão humana.

## 12. Implantação

1. Aplicar estrutura de banco e funções com testes e advisors limpos.
2. Publicar Edge Function de provisionamento e automação de tarefa.
3. Publicar rotas e componentes protegidos por sinalização de recurso.
4. Validar cadastro completo em preview com uma identidade de teste.
5. Ativar para produção e acompanhar erros e eventos do funil.
6. Manter login atual e convites existentes como caminhos independentes.

O recurso pode ser desativado ocultando os CTAs e bloqueando novo provisionamento,
sem afetar contas, tenants ou convites já existentes.
