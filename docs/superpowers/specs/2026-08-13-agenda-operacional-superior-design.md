# ADVeyes — Agenda operacional superior

Data: 13 de agosto de 2026  
Status: aprovado e implementado

## Objetivo

Reconstruir a Agenda do ADVeyes sobre a base funcional existente, preservando
dados reais, isolamento multitenant e integração com Google Calendar. A nova
experiência cobrirá as visões mensal, semanal e diária observadas na referência,
acrescentará uma visão em lista e destacará riscos operacionais próprios do
ADVeyes.

Esta entrega segue a abordagem de evolução estrutural: o esquema canônico, o
normalizador operacional e a fila de sincronização existentes serão
reutilizados. A página monolítica será dividida somente nos limites necessários
à Agenda, sem reescrita geral ou duplicação de domínio.

## Escopo funcional

### Escopo inicial por perfil

- proprietário e administrador iniciam em `Escritório`;
- colaborador inicia em `Minha Agenda`;
- a troca entre os dois escopos é imediata quando a permissão permitir;
- a interface não oferecerá um escopo que o usuário não possa consultar;
- RLS e permissões do banco continuam sendo a autoridade de acesso.

### Visualizações

A Agenda terá quatro visualizações equivalentes sobre o mesmo conjunto
normalizado:

- `Mês`, para distribuição e volume;
- `Semana`, para ocupação por horário e conflitos;
- `Dia`, para execução detalhada;
- `Lista`, para triagem, pesquisa e uso prioritário no celular.

A data, a visualização, o escopo e os filtros relevantes serão representados na
URL. Recarregar, compartilhar ou retornar à rota deverá restaurar o mesmo
contexto. Parâmetros ausentes ou inválidos usarão padrões seguros sem quebrar a
tela.

### Filtros

A barra de filtros combinará, quando aplicável:

- profissional responsável;
- tipo de item;
- processo;
- cliente;
- status;
- origem.

Os filtros atuarão sobre o serviço consultado e não substituirão autorização.
Limpar filtros preservará a data e a visualização atuais.

### Itens da Agenda

A Agenda reunirá sem duplicação:

- compromissos da tabela `eventos`;
- tarefas com data limite;
- prazos jurídicos confirmados disponíveis no domínio operacional;
- audiências.

Cada item normalizado manterá sua origem, identificador, data inicial, data
final quando houver, título, tipo, status, responsável e vínculos conhecidos
com processo e cliente. Uma alteração será persistida na entidade de origem, e
nunca em uma cópia exclusiva da Agenda.

### Criação e painel contextual

O usuário poderá iniciar uma criação pelo botão global da página ou pelo clique
em uma data ou horário. O formulário canônico receberá o contexto selecionado e
preservará seus valores em caso de falha.

O clique em um item abrirá um painel contextual sem desmontar a Agenda. O painel
mostrará os detalhes disponíveis, origem, responsável, processo, cliente,
sincronização e ações permitidas. Links para a ficha original preservarão o
contexto de retorno da Agenda.

### Centro de atenção

O ADVeyes acrescentará uma camada operacional que não altera os registros por
conta própria. Serão destacados:

- sobreposição de compromissos do mesmo responsável;
- prazos vencidos ou próximos;
- audiências sem responsável;
- itens com falha ou pendência de sincronização.

Conflitos de horário serão avisos. O usuário autorizado poderá confirmar o
salvamento mesmo com conflito. Sugestões de responsável, preparação ou próximo
passo sempre dependerão de confirmação humana.

## Arquitetura de frontend

A rota `Agenda` será uma composição de unidades focadas:

- cabeçalho com navegação temporal, seletor de escopo e ação de criação;
- barra de filtros;
- visualizações de mês, semana, dia e lista;
- cartão ou bloco normalizado de item;
- centro de atenção;
- painel contextual;
- formulário canônico de compromisso;
- estado compacto da integração Google Calendar;
- estados de carregamento, vazio, falha parcial e erro total.

O componente de rota coordenará apenas parâmetros, seleção e composição. Regras
de normalização, filtragem, conflito e intervalo ficarão fora da camada visual e
terão testes próprios.

## Dados e fluxo

`useOperationalCalendar` continuará como a entrada de leitura e será ampliado
para trabalhar com um contrato explícito contendo escritório, intervalo,
escopo e filtros. A chave de cache incluirá esses parâmetros.

O fluxo será:

1. a rota valida os parâmetros da URL;
2. o contexto fornece usuário, escritório ativo, função e permissões;
3. o hook consulta somente o intervalo e o escopo necessários;
4. o serviço aplica `tenant_id` a todas as fontes e o filtro de responsável em
   `Minha Agenda`;
5. o banco aplica RLS e integridade;
6. o serviço normaliza entidades sem remover sua identidade original;
7. a tela calcula agrupamentos e avisos determinísticos;
8. mutações escrevem na entidade canônica e invalidam apenas os períodos
   afetados;
9. a fila do Google Calendar processa a sincronização de forma independente.

Falha no Google Calendar não desfará um compromisso já confirmado pelo banco.
A interface exibirá o estado de sincronização e permitirá nova tentativa segura.

## Segurança e multitenancy

- todas as leituras e mutações pertencentes ao escritório usarão o
  `tenant_id` ativo;
- o responsável selecionado deverá pertencer ao mesmo escritório;
- filtros no cliente não serão considerados controles de segurança;
- proprietário e administrador terão visão do escritório conforme suas
  permissões;
- colaborador terá a visão própria como padrão e somente ampliará o escopo se
  autorizado;
- exclusão, edição e visualização de detalhes respeitarão RLS e permissões da
  entidade de origem;
- nenhuma credencial do Google Calendar será manipulada diretamente pela tela.

## Tratamento de estados e falhas

- carregamento exibirá uma estrutura estável da visualização selecionada;
- falha parcial manterá as fontes válidas e identificará a origem indisponível;
- erro total oferecerá nova tentativa sem apagar parâmetros;
- estado vazio diferenciará ausência real de ausência causada por filtros;
- formulários permanecerão preenchidos após falha de persistência;
- exclusões só serão removidas da tela depois da confirmação do banco;
- referências removidas ou inacessíveis aparecerão como indisponíveis;
- mensagens serão compreensíveis e preservarão causa técnica útil;
- sincronização pendente ou falha será visível sem bloquear o trabalho local.

## Responsividade e acessibilidade

- `Lista` será a apresentação prioritária em telas estreitas;
- `Mês`, `Semana` e `Dia` continuarão disponíveis no celular;
- filtros móveis abrirão em folha de largura total;
- o painel contextual ocupará a largura disponível no celular;
- ações terão nomes acessíveis, foco visível e operação por teclado;
- cor nunca será o único indicador de tipo, risco ou status;
- alvos de toque terão dimensões adequadas;
- a grade temporal terá alternativa equivalente em lista.

## Integração Google Calendar

A integração existente será preservada. Seu estado aparecerá de forma compacta
no cabeçalho, com conexão, pendência, falha e sincronização manual quando
aplicável. A Agenda continuará usando a fila segura e as credenciais por usuário
já projetadas para o ambiente multitenant.

Este ciclo não cria sincronização bidirecional nem muda o provedor OAuth. A
regressão dos fluxos atuais de conectar, sincronizar, tentar novamente e
desconectar fará parte do aceite.

## Estratégia de testes

### Unidade

- normalização das fontes;
- intervalos de mês, semana e dia;
- parâmetros válidos e inválidos da URL;
- combinação de filtros;
- detecção de sobreposição por responsável;
- classificação de atraso e proximidade;
- ordenação determinística dos itens.

### Componentes

- alternância de escopo e visualização;
- navegação temporal;
- filtros e limpeza;
- estados de carregamento, vazio e falha parcial;
- abertura do painel contextual;
- criação a partir de data e horário;
- avisos do centro de atenção;
- comportamento móvel prioritário em lista.

### Serviço e integração

- todas as consultas filtram o escritório ativo;
- `Minha Agenda` aplica o responsável correto;
- falha de uma fonte não apaga as demais;
- mutações invalidam o intervalo afetado;
- integração Google Calendar mantém os fluxos existentes;
- navegação para a entidade original preserva o retorno.

### Validação final

- fluxo autenticado em desktop e celular;
- comparação funcional com as visões da referência;
- suíte completa de testes;
- `npx tsc --noEmit`;
- `npm run build`;
- lint focado nos arquivos alterados.

## Critérios de aceite

- o escopo inicial corresponde ao perfil do usuário;
- usuários autorizados alternam entre visão pessoal e do escritório;
- mês, semana, dia e lista exibem o mesmo conjunto filtrado;
- data, visão, escopo e filtros relevantes sobrevivem ao recarregamento;
- compromissos, tarefas, prazos e audiências mantêm a origem canônica;
- filtros podem ser combinados sem quebrar navegação ou seleção;
- um item abre o contexto correto e retorna à mesma posição;
- conflitos, urgências, ausência de responsável e falhas de sincronização são
  visíveis;
- falha de sincronização não perde um item salvo no ADVeyes;
- a tela funciona em desktop e celular e não depende somente de cor;
- não há acesso cruzado entre escritórios;
- nenhum fluxo existente do Google Calendar sofre regressão conhecida;
- testes, TypeScript, build e lint focado são aprovados.

## Fora deste ciclo

- sincronização bidirecional Google Calendar para ADVeyes;
- alteração do provedor ou dos escopos OAuth;
- automações que tomem decisões jurídicas sem confirmação;
- edição completa de tarefas, prazos e audiências dentro da Agenda quando o
  formulário canônico da entidade ainda não puder ser reutilizado;
- drag and drop de compromissos como único meio de reagendamento;
- reestruturação geral de outros módulos;
- cópia da identidade visual, dos textos ou dos ativos da ADVBOX.
