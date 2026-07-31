# OAuth público do Google Calendar no ADVeyes

Data: 28 de julho de 2026  
Status: aprovado para planejamento  
Produto: ADVeyes

## Objetivo

Permitir que qualquer cliente do ADVeyes, inclusive usuários de versões
whitelabel, conecte sua própria conta do Google Calendar sem precisar ser
adicionado manualmente como usuário de teste no Google Cloud.

Cada usuário deverá autorizar a própria conta Google uma única vez. Depois
disso, a sincronização de eventos será automática enquanto a autorização
permanecer válida.

## Decisão de marca

O OAuth será centralizado sob a marca **ADVeyes**.

- A tela de consentimento do Google sempre identificará o aplicativo como
  ADVeyes.
- A identidade visual interna poderá continuar sendo personalizada por
  whitelabel.
- Os whitelabels não terão projetos OAuth ou credenciais Google próprios.
- O domínio público usado na verificação será `automatikus.com.br`, com a
  aplicação em `adveyes.automatikus.com.br`.

Essa decisão evita a manutenção de um projeto Google Cloud e de um processo de
verificação para cada cliente.

## Experiência do usuário

1. O usuário autenticado acessa Agenda ou Configurações.
2. Clica em **Conectar Google Calendar**.
3. O Google informa que o ADVeyes solicita acesso aos eventos das agendas que
   o usuário possui.
4. O usuário concede a permissão.
5. O Google retorna para o ADVeyes.
6. O ADVeyes valida que o escopo de Calendar foi realmente concedido.
7. Eventos atuais e futuros entram na fila e são sincronizados.
8. Alterações posteriores são processadas automaticamente pelo worker.

Não existe autorização silenciosa inicial: o consentimento individual é uma
exigência do Google. A remoção do trabalho manual ocorre porque o aplicativo
estará em Produção e aceitará qualquer Conta Google, sem cadastro prévio como
usuário de teste.

## Arquitetura

### OAuth central

Um único cliente OAuth Web no projeto Google Cloud do ADVeyes será usado por
todos os usuários.

O fluxo solicitará apenas:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.events.owned`

O escopo `calendar.events.owned` é o menor escopo compatível com a necessidade
de criar, alterar e excluir eventos em calendários pertencentes ao usuário.

### Isolamento multiusuário

Os dados permanecem vinculados ao `auth.users.id` do Supabase:

- `google_calendar_connections`: uma conexão por usuário;
- `google_calendar_credentials`: credenciais criptografadas por usuário;
- `google_calendar_event_links`: vínculo entre entidade ADVeyes e evento
  Google, por usuário;
- `google_calendar_sync_queue`: fila de sincronização por usuário.

As credenciais não serão expostas ao navegador. O frontend acessará somente
Edge Functions autenticadas, e as operações privilegiadas permanecerão no
backend.

### Sincronização

O ADVeyes continuará sendo a origem dos eventos.

- Inserções e alterações geram um trabalho de `upsert`.
- Exclusões geram um trabalho de `delete`.
- O worker processa trabalhos pendentes e faz novas tentativas para falhas
  transitórias.
- Falta de permissão muda a conexão para `reconnect_required`.
- Eventos passados não são enviados durante a sincronização inicial.

## Páginas públicas e transparência

Serão disponibilizadas sem autenticação:

- `/landing`: página inicial pública da marca ADVeyes;
- `/privacidade`: Política de Privacidade;
- `/termos`: Termos de Uso.

A página inicial deverá:

- identificar claramente o ADVeyes;
- explicar a funcionalidade de sincronização com Google Calendar;
- informar que o acesso ocorre somente após consentimento;
- apontar para Política de Privacidade e Termos de Uso.

A Política de Privacidade deverá explicar:

- quais dados Google são acessados;
- que o ADVeyes usa o acesso para criar, atualizar e excluir eventos solicitados
  pelo usuário;
- que tokens OAuth são armazenados de forma criptografada;
- que dados Google não são vendidos nem usados para publicidade;
- como o usuário desconecta a conta e revoga o acesso;
- como solicitar suporte ou exclusão de dados;
- compromisso com os requisitos de uso limitado das APIs Google e com a LGPD.

Os Termos de Uso deverão explicar:

- que a integração é opcional;
- que o usuário é responsável pela Conta Google conectada;
- que a disponibilidade também depende dos serviços do Google;
- que a desconexão interrompe novas sincronizações;
- as regras gerais de uso aceitável do ADVeyes.

## Padronização pública de marca

A página pública atualmente contém referências a LEXIA e Albertino. Essas
referências serão substituídas por ADVeyes apenas nas superfícies públicas
usadas pela verificação OAuth.

Essa alteração não removerá nem impedirá a personalização interna dos
whitelabels.

## Configuração no Google Cloud

Após a publicação das páginas:

1. Verificar `automatikus.com.br` no Google Search Console usando uma conta que
   também seja proprietária ou editora do projeto Google Cloud.
2. Configurar a página inicial como
   `https://adveyes.automatikus.com.br/landing`.
3. Configurar a Política de Privacidade como
   `https://adveyes.automatikus.com.br/privacidade`.
4. Configurar os Termos de Uso como
   `https://adveyes.automatikus.com.br/termos`.
5. Manter `automatikus.com.br` como domínio autorizado.
6. Confirmar o escopo `calendar.events.owned`.
7. Gravar um vídeo curto demonstrando o fluxo completo de autorização e a
   criação de um evento.
8. Alterar o público-alvo para Produção e enviar a verificação do aplicativo.

Enquanto a verificação estiver pendente, o Google poderá continuar exibindo um
aviso de aplicativo não verificado. Depois da aprovação, qualquer Conta Google
deverá conseguir autorizar o ADVeyes sem ser cadastrada previamente.

## Tratamento de erros

- Escopo ausente: rejeitar a conexão e informar que a permissão de Calendar não
  foi concedida.
- Token revogado: marcar `reconnect_required` e solicitar nova autorização.
- Falha transitória da API: manter na fila com nova tentativa.
- Falha permanente: registrar código de erro sem expor tokens ou segredos.
- Desconexão: revogar credenciais e permitir que o usuário escolha se deseja
  remover os eventos previamente criados pelo ADVeyes.

## Verificação e testes

### Aplicação

- As três páginas públicas devem abrir sem login.
- Links de Privacidade e Termos devem estar visíveis na página inicial.
- A marca pública deve ser ADVeyes em todas essas páginas.
- O build e os testes automatizados existentes devem continuar aprovados.

### OAuth

- A URL de autorização deve solicitar exatamente os três escopos definidos.
- O callback deve rejeitar tokens sem `calendar.events.owned`.
- O retorno bem-sucedido deve registrar `status = connected`.

### Multiusuário

O teste final será feito com duas Contas Google distintas:

- cada usuário deve visualizar somente a própria conexão;
- um evento criado pelo usuário A não pode ser enviado ao calendário do
  usuário B;
- cada vínculo deve possuir seu próprio `user_id` e `google_event_id`;
- revogar a conexão de um usuário não pode afetar o outro.

## Fora do escopo

- Criar um projeto OAuth diferente por whitelabel.
- Sincronização bidirecional Google Calendar → ADVeyes.
- Importar eventos já existentes do Google.
- Autorizar uma Conta Google sem consentimento do proprietário.
- Solicitar acesso amplo a todos os calendários quando
  `calendar.events.owned` for suficiente.

## Critérios de conclusão

O trabalho estará concluído quando:

1. as páginas públicas estiverem publicadas e acessíveis;
2. a marca pública estiver consistente como ADVeyes;
3. o Google Cloud estiver configurado com os URLs públicos corretos;
4. o aplicativo tiver sido enviado para Produção/verificação;
5. dois usuários distintos conseguirem conectar e sincronizar eventos sem
   cadastro manual como usuários de teste;
6. o isolamento entre os dois usuários estiver comprovado no banco.
