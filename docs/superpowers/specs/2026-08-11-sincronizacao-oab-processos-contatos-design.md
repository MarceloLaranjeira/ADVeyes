# Sincronização automática de OAB, processos e contatos

Data: 2026-08-11  
Status: aprovado em conversa; aguardando revisão do documento  
Escopo: permissões por advogado, importação automática de processos, enriquecimento jurídico e contatos completos

## 1. Objetivo

Corrigir o fluxo jurídico para que a OAB permaneça salva no perfil do advogado,
os processos sejam importados e monitorados automaticamente e as informações
públicas disponíveis sejam continuamente conciliadas sem exigir sincronizações
manuais repetidas.

A entrega deve reunir, no processo, capa, partes, contatos, andamentos,
publicações, intimações, audiências e documentos públicos. As fontes oficiais
DataJud/CNJ e DJEN/CNJ prevalecem. O Escavador complementa descoberta e dados
públicos quando estiver configurado e houver cota.

## 2. Decisões aprovadas

1. Um advogado ativo administra e sincroniza somente as próprias OABs.
2. Proprietário e administrador administram todas as OABs do escritório.
3. Um advogado pode possuir mais de uma inscrição; todas ficam visíveis aos
   gestores do escritório.
4. Processos descobertos são importados automaticamente, sem confirmação
   manual de candidatos.
5. Clientes, partes contrárias e terceiros são materializados como contatos,
   com classificação e vínculo aos processos.
6. A sincronização normal é automática. A ação manual apenas antecipa uma
   execução.
7. O sistema importa tudo o que as fontes disponibilizarem legalmente e indica
   dados indisponíveis; não inventa nem infere dados pessoais ausentes.

## 3. Regras de acesso

### Advogado ativo

- visualiza as próprias inscrições e seus estados de sincronização;
- cadastra, corrige, reativa e sincroniza somente as próprias OABs;
- acessa os processos conforme o escopo de dados definido no escritório;
- não altera inscrições de outro profissional.

O vínculo entre usuário autenticado e profissional será validado no servidor
por `equipe.user_id`. O cliente não poderá escolher livremente um
`professional_id` de outro advogado.

### Proprietário e administrador

- visualizam todas as inscrições do escritório;
- cadastram e corrigem OABs de qualquer profissional ativo;
- reativam fontes e solicitam sincronização imediata;
- acompanham falhas, cotas e cobertura de todas as fontes.

### Conta Geral

A Conta Geral mantém visualização de diagnóstico. Mutações em nome de um
escritório só são aceitas durante uma sessão de suporte autorizada, respeitando
o mecanismo de suporte existente e gerando auditoria com ator, tenant, ação e
alvo.

Toda operação valida associação ativa ao tenant e nunca confia apenas no estado
da interface. As consultas e mutações permanecem isoladas por `tenant_id`.

## 4. Persistência da OAB

O cadastro da inscrição será uma operação de servidor idempotente:

1. normalizar número, UF e tipo;
2. validar que o solicitante pode administrar o profissional;
3. inserir ou atualizar `lawyer_registrations`;
4. refletir as inscrições ativas no perfil de `equipe` sem perder inscrições
   adicionais;
5. criar ou reativar fontes jurídicas para aquela inscrição;
6. registrar auditoria;
7. enfileirar uma execução imediata em segundo plano;
8. responder assim que o estado durável estiver salvo.

Uma falha ou demora do provedor não desfaz a inscrição. O campo legado
`equipe.oab` continua compatível como representação principal, enquanto
`lawyer_registrations` é a fonte canônica para uma ou várias OABs.

## 5. Pipeline automático

### 5.1 Descoberta e importação

Cada inscrição ativa gera fontes independentes para descoberta de processos e
publicações oficiais. A descoberta usa a melhor fonte configurada e a estratégia
oficial disponível como contingência.

Cada número CNJ válido descoberto é confirmado internamente de forma automática
e transacional. A importação:

- reutiliza um processo já existente no tenant pelo número CNJ canônico;
- cria o processo quando ainda não existir;
- vincula a inscrição e o advogado;
- cria ou reativa as fontes DataJud e DJEN do processo;
- ativa o monitor complementar quando o Escavador estiver disponível;
- preserva a descoberta como evidência e marca seu estado como importado.

Somente conflitos concretos ficam pendentes para revisão. Ausência de um campo
complementar não impede a importação.

### 5.2 Enriquecimento do processo

Depois da importação, adaptadores independentes executam:

- **DataJud/CNJ:** número, tribunal, classe, assuntos, órgão julgador, sistema,
  grau, sigilo público, ajuizamento, última atualização e movimentos oficiais;
- **DJEN/CNJ:** publicações, intimações, destinatários, advogados, texto oficial,
  referências de audiência e possíveis prazos;
- **Escavador:** descoberta ampliada, capa complementar, partes, advogados
  relacionados, movimentos e documentos públicos quando disponibilizados.

Uma falha não interrompe as outras fontes. O dado oficial prevalece em conflito;
o provedor complementar preenche lacunas. Alterações humanas protegidas nunca
são sobrescritas.

### 5.3 Frequência e execução

- DJEN continua sendo consultado em janelas curtas para novas comunicações.
- Capa e movimentos são conciliados periodicamente e imediatamente após a
  primeira importação.
- O botão `Sincronizar agora` ignora a próxima janela apenas para fontes que o
  usuário pode administrar.
- A execução continua no servidor quando a página ou o navegador for fechado.
- O processamento será dividido em lotes duráveis para evitar que o limite de
  tempo de uma Edge Function deixe o fluxo incompleto sem retomada.

## 6. Dados do processo

A visão do processo reunirá:

- dados de capa e situação processual;
- partes, polos, papéis, classificações e advogados relacionados;
- movimentos com código TPU, título, descrição, complementos, notas, data,
  origem e conteúdo recebido;
- publicações e intimações oficiais;
- audiências sugeridas, sempre pendentes de revisão humana;
- documentos públicos, texto disponível e links oficiais ou complementares;
- procedência, horário de coleta e estado da última sincronização.

Autos sigilosos, documentos restritos e dados não fornecidos pelas APIs não são
prometidos. A interface mostrará `Não disponibilizado pela fonte` ou
`Íntegra não disponível`, mantendo o link oficial quando conhecido.

## 7. Partes e contatos

Toda parte processual válida será mantida em `process_parties` e vinculada a um
contato canônico em `clientes`. Isso inclui cliente, parte contrária e terceiro.

Quando disponibilizados, serão armazenados e exibidos:

- nome e tipo de pessoa;
- CPF/CNPJ mascarado e impressão digital segura para deduplicação;
- polo, papel processual e classificação interna;
- advogados relacionados e respectivas OABs;
- telefone, e-mail e endereço;
- fonte e identificador externo;
- processos relacionados e papel em cada processo.

A deduplicação seguirá, nesta ordem:

1. documento ou sua impressão digital;
2. identificador externo estável;
3. nome normalizado e tipo de pessoa dentro do mesmo tenant;
4. candidato a mesclagem quando houver ambiguidade.

Contatos distintos não serão mesclados apenas por semelhança aproximada. Dados
manuais existentes serão preservados. Novas sincronizações podem preencher
campos vazios e ampliar vínculos, mas não apagar informações humanas.

## 8. Idempotência e consistência

Repetir qualquer etapa deve atualizar os mesmos registros. Restrições e chaves
determinísticas impedirão duplicação de:

- inscrições;
- processos;
- vínculos entre inscrição e processo;
- partes e contatos;
- movimentos e documentos;
- publicações, audiências, notificações e tarefas.

O processo só será apresentado como sincronizado quando as fontes oficiais
obrigatórias tiverem um resultado registrado. Êxito parcial deve indicar quais
fontes concluíram e quais ainda estão pendentes.

## 9. Falhas e recuperação

- Falhas temporárias usam retentativa progressiva com limite por execução, mas
  não desativam definitivamente a fonte.
- Fontes interrompidas pelo comportamento legado são reativadas por migração e
  pelo reconciliador quando a condição volta a ser válida.
- Credencial ausente, credencial inválida, cota esgotada e indisponibilidade
  externa são estados diferentes e recebem mensagens e ações diferentes.
- A falta do Escavador não bloqueia DataJud nem DJEN.
- Dados já armazenados permanecem visíveis durante falhas.
- Execuções registram início, término, contagens, fonte, erro estável e próxima
  tentativa.
- O sistema deve detectar a ausência dos segredos ou do agendamento do cron e
  mostrá-la como problema de configuração da plataforma.

## 10. Experiência de uso

### Integrações jurídicas

A tela lista profissionais, suas inscrições e o estado individual das fontes.
Exibe último sucesso, última tentativa, próxima execução, registros recebidos e
ação de sincronização compatível com o papel do usuário.

O formulário de advogado comum fixa o próprio perfil. Gestores podem selecionar
qualquer profissional ativo. O fluxo de seleção e confirmação de candidatos é
removido do caminho normal; conflitos excepcionais aparecem em uma área de
revisão separada.

### Processos e casos

Processos importados aparecem automaticamente com indicador de enriquecimento.
O detalhe organiza visão geral, andamentos, intimações, documentos, audiências,
partes e contatos sem ocultar a origem ou a indisponibilidade de dados.

### Contatos

A listagem deixa de apresentar somente nomes. Os cartões e o detalhe mostram
classificação, documento mascarado, meios de contato disponíveis, origem,
processos relacionados e papéis processuais. Campos ausentes são identificados
como indisponíveis na fonte, não como falha silenciosa.

## 11. Observabilidade operacional

O painel de sincronização distingue:

- saudável;
- aguardando primeira execução;
- sincronização parcial;
- retentativa automática;
- configuração administrativa pendente;
- cota temporariamente esgotada;
- falha permanente que exige correção.

Logs e auditoria não expõem tokens, documentos completos nem texto jurídico
sensível desnecessário. A Conta Geral consegue identificar se migrations,
funções, segredos e cron necessários estão ativos.

## 12. Testes e critérios de aceite

### Permissões

- advogado ativo cadastra e sincroniza a própria OAB;
- advogado não altera OAB de outro profissional;
- proprietário e administrador gerenciam todas as inscrições do tenant;
- membro inativo e usuário de outro tenant são rejeitados;
- Conta Geral sem suporte autorizado permanece somente leitura;
- suporte autorizado gera auditoria.

### Persistência e automação

- OAB válida permanece no perfil mesmo quando todos os provedores falham;
- múltiplas OABs do mesmo profissional coexistem;
- salvar novamente não duplica inscrição nem fonte;
- fontes ausentes ou pausadas são criadas ou reativadas;
- nova inscrição dispara trabalho em segundo plano;
- processo descoberto é importado sem confirmação manual;
- processo importado passa a ser reconciliado automaticamente.

### Dados jurídicos

- capa e movimentos do DataJud são persistidos;
- DJEN cria publicações idempotentes e vínculos corretos;
- Escavador complementa sem sobrescrever campo oficial ou manual;
- todas as partes geram contatos classificados e vinculados;
- telefone, e-mail, endereço e documento são preenchidos quando presentes no
  payload;
- sincronização repetida não duplica entidades;
- dados ausentes são apresentados como indisponíveis.

### Recuperação e qualidade

- falha de uma fonte não bloqueia as demais;
- retentativas sobrevivem ao fechamento do navegador;
- fontes temporariamente falhas não ficam interrompidas para sempre;
- execuções parciais retomam do ponto seguro;
- testes SQL cobrem RLS, integridade, reativação e idempotência;
- testes unitários cobrem normalização, reconciliação e deduplicação;
- testes de componentes cobrem papéis, estados e dados dos contatos;
- fluxo de navegador valida cadastro da OAB até processo e contato visíveis;
- `npm run build`, TypeScript, testes e lint dos arquivos alterados passam.

## 13. Implantação

1. aplicar migrations e validar políticas, gatilhos e fontes existentes;
2. publicar funções de cadastro, importação e reconciliação;
3. confirmar segredos globais e agendamento do reconciliador;
4. reativar e colocar na fila fontes válidas já interrompidas;
5. executar backfill idempotente para inscrições, processos e contatos atuais;
6. publicar as telas atualizadas;
7. validar com um advogado comum e com um proprietário em tenant de teste;
8. acompanhar execuções e falhas antes de liberar para todos.

Rollback da interface não remove dados importados. Migrations destrutivas não
fazem parte desta entrega; qualquer limpeza de duplicatas será precedida por
inventário e executada de forma recuperável.

## 14. Fora do escopo

- acesso a autos sigilosos sem autorização e credenciais judiciais adequadas;
- armazenamento de certificado A1, A3, PIN ou senha pessoal de tribunal;
- peticionamento ou assinatura eletrônica automática;
- preenchimento inventado de telefone, e-mail, endereço ou documento;
- garantia de conteúdo que DataJud, DJEN, Escavador ou tribunal não forneçam.
