# ADVeyes — Central de Inteligência Processual

Data: 14 de agosto de 2026  
Status: aprovado em conversa; aguardando revisão do documento

## Objetivo

Transformar o acompanhamento de processos em uma central de decisão capaz de
explicar onde cada processo está, há quanto tempo não avança, por que não avança,
de quem depende a próxima movimentação e qual providência o escritório deve
considerar. A entrega deve aproveitar os processos, andamentos, publicações,
prazos e tarefas já existentes, sem criar cadastros paralelos.

Esta é a primeira entrega do programa solicitado. Cadastro de clientes com
pastas e documentos, busca global de arquivos e consulta processual pelo
WhatsApp serão especificados em ciclos próprios. A Central fornecerá o contrato
de leitura que o WhatsApp utilizará posteriormente.

## Navegação e organização

- remover o item `Processos e casos` da navegação;
- mover `Busca processual` para o primeiro grupo, logo após `Área de trabalho`;
- apresentar a área consolidada como `Central Processual`;
- reunir processos cadastrados, busca oficial, diagnóstico e acompanhamento no
  mesmo domínio, sem duplicar dados;
- substituir a lista extensa de processos recentes da tela inicial por cards
  compactos de inteligência, cada um abrindo a Central com o filtro correspondente.

## Modelo híbrido de análise

A classificação será automática e revisável. A análise sugere fase, etapa,
responsável pela espera, motivo, próxima providência, risco e confiança. O
advogado poderá corrigir fase, etapa ou motivo. A correção manual prevalecerá
até que um novo andamento relevante exija reavaliação e ficará registrada com
autor, data, valor anterior, novo valor e justificativa.

A IA não apresentará inferências como fatos. Toda conclusão exibirá as
evidências utilizadas. Quando não houver suporte suficiente, o valor será
`Não identificado` e o processo entrará na fila de revisão humana se a
confiança for baixa.

## Taxonomia processual

### Fases e etapas

- **Conhecimento:** distribuição, citação, defesa, instrução, perícia,
  alegações finais e sentença;
- **Recursal:** preparação, contrarrazões, remessa, julgamento e trânsito em
  julgado;
- **Cumprimento ou execução:** liquidação, cobrança, penhora, expropriação e
  pagamento;
- **Suspenso ou sobrestado:** aguardando condição externa;
- **Arquivado ou encerrado:** baixa definitiva ou provisória;
- **Não identificada:** evidências insuficientes para uma conclusão segura.

Cada processo terá fase, etapa, último andamento relevante, data do último
avanço, dias sem avanço, responsável pela próxima ação, motivo da espera,
próxima providência sugerida, risco, confiança e referências às evidências.

### Responsável pela próxima ação

Os valores normalizados serão `escritório`, `cliente`, `parte contrária`,
`juízo ou tribunal`, `órgão externo` e `não identificado`.

## Regras de paralisação

Os limites serão configuráveis por escritório. Os valores iniciais serão:

- prazo vencido ou providência vencida do escritório: alerta imediato;
- aguardando ação do escritório: alerta após 3 dias sem avanço;
- aguardando parte contrária: alerta após 15 dias;
- aguardando juízo ou tribunal: alerta após 30 dias;
- suspenso, sobrestado ou arquivado: sem alerta automático por inatividade.

O tempo será calculado a partir do último andamento que represente avanço real,
e não simplesmente do registro mais recente. Uma movimentação meramente
repetitiva ou cadastral não deverá zerar a paralisação sem evidência de avanço.

## Execução da análise

A análise será executada:

1. em carga inicial para processos existentes;
2. quando um novo andamento relevante for incorporado;
3. diariamente para recalcular tempo parado e risco;
4. por solicitação explícita no botão `Reanalisar`.

As execuções deverão ser idempotentes. Uma reanálise não duplicará andamentos,
evidências ou registros de diagnóstico. A última análise válida continuará
disponível enquanto uma nova execução estiver em andamento ou quando uma fonte
externa falhar.

## Experiência da Central

A visualização inicial será a **Central de comando**, escolhida na revisão
visual. Os cards principais serão:

- Precisam de ação;
- Parados;
- Risco alto;
- Aguardando escritório;
- Aguardando juízo;
- Em fluxo normal.

Abaixo dos cards haverá uma Fila de Atenção, priorizada por risco, prazo,
responsabilidade do escritório e tempo parado. Cada item mostrará número,
cliente, fase, etapa, último avanço, dias parado, motivo e próxima providência.

Três visualizações compartilharão a mesma fonte e os mesmos filtros:

- **Central:** indicadores, prioridades e diagnóstico agregado;
- **Pipeline:** processos agrupados por fase e etapa;
- **Lista:** auditoria detalhada, seleção, exportação e ações em lote.

Abrir um processo exibirá um painel lateral com diagnóstico, evidências, linha
do tempo das mudanças de fase, próxima ação, responsável, correção manual,
reanálise e acesso à ficha completa.

## Busca e filtros

A busca aceitará número CNJ completo ou parcial, cliente, CPF ou CNPJ,
advogado, responsável, fase, etapa, texto do último andamento e motivo da
paralisação.

Os filtros combináveis serão:

- fase e etapa;
- status e área jurídica;
- risco e confiança;
- tempo sem avanço;
- responsável pela próxima ação;
- motivo da espera;
- tribunal e vara;
- advogado ou responsável interno;
- prazo vencido;
- análise automática ou corrigida manualmente.

Filtros rápidos: `Sem andamento há 30 dias`, `Escritório deve agir`,
`Aguardando juízo`, `Prazo crítico` e `Fase não identificada`.

O diagnóstico responderá sempre que possível:

- **onde está parado:** fase e etapa;
- **há quanto tempo:** data do último avanço relevante;
- **por que não anda:** causa acompanhada de evidência;
- **de quem depende:** responsável pela próxima movimentação;
- **o que fazer agora:** providência sugerida, nunca executada sem confirmação.

## Componentes e limites

A implementação será dividida em unidades com responsabilidades claras:

- serviço de leitura das fontes processuais tenant-scoped;
- classificador determinístico para regras objetivas;
- adaptador de análise assistida para classificação semântica;
- repositório do diagnóstico atual e de seu histórico;
- motor de paralisação e risco;
- funções puras de busca, filtros, agrupamento e ordenação;
- componentes de cards, fila de atenção, Pipeline, Lista e painel de detalhes;
- coordenador de rota e estado da Central.

Regras objetivas, como prazo vencido e dias sem avanço, não dependerão da IA.
A análise assistida será utilizada para interpretar linguagem dos andamentos,
identificar etapa, motivo e próxima providência, sempre com evidências e
confiança.

## Persistência e auditoria

O diagnóstico atual deverá ser consultável sem recalcular a IA durante cada
abertura da tela. O histórico registrará versões da análise e correções humanas.
Os contratos de dados deverão comportar:

- identificadores de tenant e processo;
- fase, etapa e status de paralisação;
- datas do último andamento e último avanço;
- responsável e motivo da espera;
- próxima ação sugerida;
- risco e confiança;
- evidências estruturadas;
- origem automática ou manual;
- autor e justificativa da correção;
- versão do classificador e datas de criação e atualização.

O desenho exato das tabelas será confirmado contra o esquema real antes da
migração. Nenhuma tabela exposta será criada sem RLS e políticas tenant-scoped.

## Segurança e permissões

- todas as leituras e gravações serão restritas ao tenant atual;
- a interface não substituirá RLS;
- permissões determinarão quem pode visualizar, reanalisar e corrigir;
- correções não apagarão análises anteriores;
- chaves privilegiadas não serão expostas no cliente;
- sugestões não criarão prazo, tarefa ou alteração processual sem confirmação;
- evidências e conteúdo processual não serão enviados a integrações não
  autorizadas pelo escritório.

## Falhas e estados degradados

Quando uma fonte estiver indisponível, a Central mostrará a última análise
válida, sua data e a fonte que falhou. Uma falha parcial não ocultará dados das
demais fontes. Reanálises poderão ser repetidas com segurança. Ausência de
evidência produzirá valores não identificados em vez de justificativas
inventadas.

Estados da interface: carregamento, vazio, erro total, erro parcial, análise em
andamento, análise desatualizada e revisão humana necessária.

## Contrato para WhatsApp jurídico

A Central disponibilizará uma operação de leitura autorizada por tenant e
usuário capaz de retornar, por número ou cliente:

- identificação do processo;
- situação atual;
- último andamento relevante;
- fase e etapa;
- tempo e motivo da paralisação;
- responsável pela próxima ação;
- providência sugerida e confiança.

O canal de WhatsApp, autenticação do solicitante e regras de exposição externa
ficam fora desta entrega e terão especificação própria.

## Validação e critérios de aceite

- classificação determinística testada para fases, prazos e paralisações;
- análises com baixa evidência exibem incerteza explicitamente;
- correções manuais prevalecem e produzem auditoria;
- novo andamento relevante dispara reavaliação sem duplicidade;
- filtros e busca combinados preservam a rota e retornam somente o tenant;
- cards abrem a Central no filtro correspondente;
- Central, Pipeline e Lista exibem o mesmo núcleo de processos;
- falhas parciais preservam a última análise válida;
- permissões e RLS são verificadas no banco real;
- testes unitários, integração, TypeScript, lint, build e navegador aprovados.

## Fora do escopo desta entrega

- criação de pastas e documentos dentro do cadastro do cliente;
- buscador global de arquivos e pastas;
- conversa e automações pelo WhatsApp;
- movimentação processual automática;
- criação automática de prazos e tarefas sem confirmação humana.
