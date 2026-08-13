# Calendário compacto na Área de trabalho

Data: 8 de agosto de 2026
Status: aprovado para planejamento

## Objetivo

Adicionar à Área de trabalho do ADVeyes um calendário mensal compacto,
inspirado na organização visual observada no ADVBOX e adaptado à identidade do
produto. O usuário poderá consultar rapidamente os compromissos do escritório,
selecionar um dia e acessar a Agenda completa sem sair do fluxo operacional.

O calendário completo já existente em `/agenda` será preservado como a visão
detalhada. Esta entrega cria uma porta de entrada resumida no painel, sem
duplicar regras ou dados.

## Experiência aprovada

### Posição e aparência

- O calendário ficará na coluna direita da Área de trabalho em telas amplas.
- O cabeçalho mostrará mês e ano, com controles para mês anterior e seguinte.
- O dia atual terá destaque em azul escuro, seguindo a paleta aprovada da tela.
- O dia selecionado terá indicação visual distinta e acessível.
- Dias com itens terão pequenos indicadores coloridos por categoria.
- Abaixo do calendário ficará o link `Mostrar agenda completa`.
- A aparência seguirá os componentes e espaçamentos atuais do ADVeyes; a
  referência do ADVBOX será usada para hierarquia e comportamento, não para
  copiar sua marca.

### Seleção de data

Ao selecionar um dia, o painel exibirá logo abaixo do calendário um resumo dos
itens daquela data. Serão mostrados no máximo três itens, ordenados por horário
e prioridade temporal. Quando houver mais registros, será exibida a ação
`Ver mais` com a quantidade restante.

Cada item resumido apresentará, quando disponível:

- horário;
- título;
- categoria ou origem;
- processo relacionado;
- responsável.

Selecionar um item abrirá sua origem ou a tela detalhada adequada. A ação
`Ver mais` e o link `Mostrar agenda completa` abrirão `/agenda` preservando a
data selecionada em um parâmetro de URL estável.

### Escopo dos dados

O calendário mostrará os compromissos de todo o escritório ativo, respeitando
o isolamento por `tenant_id` e as políticas RLS. Ele não será limitado apenas
ao usuário conectado. Serão reunidos os mesmos tipos já normalizados pela
Agenda operacional:

- eventos e compromissos;
- tarefas com data;
- audiências;
- prazos e itens jurídicos compatíveis com a fonte operacional existente.

## Arquitetura

### Reutilização da fonte de dados

A Área de trabalho reutilizará `useOperationalCalendar` e os tipos do
calendário operacional. A tela `/agenda` e o calendário compacto compartilharão
a mesma consulta e normalização, evitando divergência de datas, categorias e
permissões.

O hook receberá o escritório ativo proveniente do contexto de tenant. A RLS
continuará sendo a autoridade de segurança, enquanto os filtros da interface
servirão apenas para apresentação.

### Componentes

O calendário compacto será implementado como componente próprio e reutilizável,
separado da página da Área de trabalho. Ele será responsável por:

- navegação mensal;
- seleção de data;
- indicadores nos dias;
- lista resumida do dia selecionado;
- navegação para a Agenda completa;
- estados de carregamento, vazio e falha.

A página `Index` será responsável apenas pelo posicionamento do componente na
grade do painel e pelo tenant ativo. A lógica de normalização permanecerá no
serviço e hook já existentes.

### Estado e navegação

- O mês inicial será o mês corrente.
- A data inicial selecionada será hoje.
- A seleção feita no painel será enviada para `/agenda` por query string.
- A Agenda completa passará a reconhecer esse parâmetro e abrirá no mesmo dia.
- Um parâmetro ausente ou inválido será ignorado com retorno seguro para hoje.
- A troca de mês que não contém o dia selecionado não criará seleção implícita;
  o usuário escolherá um dia do novo mês.

## Estados da interface

### Carregamento

O espaço do calendário manterá dimensões estáveis e exibirá um estado de
carregamento discreto, evitando deslocamento da grade do painel.

### Sem itens

O mês continuará navegável. No resumo do dia será exibida a mensagem
`Nenhum compromisso neste dia`, sem ocultar a ação para a Agenda completa.

### Falha

Uma falha na consulta exibirá mensagem curta e ação `Tentar novamente`. Os
demais blocos da Área de trabalho continuarão utilizáveis.

### Dados incompletos

Itens sem horário aparecerão depois dos itens com horário. Referências ausentes
ou inacessíveis serão apresentadas com texto seguro, sem quebrar o calendário.

## Responsividade e acessibilidade

- Em telas menores, o calendário será movido para baixo do conteúdo principal.
- O componente ocupará toda a largura disponível no celular.
- Dias e controles terão alvos adequados para toque e rótulos acessíveis.
- O mês poderá ser navegado por teclado.
- A seleção terá foco visível.
- Indicadores por cor também terão informação textual ou rótulo acessível.
- Textos longos serão truncados visualmente sem perder o conteúdo acessível.

## Desempenho

A consulta será limitada ao intervalo necessário para o mês visível, incluindo
os dias adjacentes exibidos na grade. Mudanças de mês reutilizarão o cache da
biblioteca de consultas quando disponível. O agrupamento por dia será
memorizado no componente para evitar recomputações durante interações simples.

## Critérios de aceite

- A Área de trabalho exibe o calendário na coluna direita em desktop.
- O calendário usa a paleta azul aprovada.
- Os controles anterior e seguinte alteram corretamente o mês visível.
- Dias com compromissos exibem indicadores.
- Selecionar um dia mostra até três itens desse dia.
- Havendo mais de três itens, a interface mostra `Ver mais`.
- O calendário considera todo o escritório ativo dentro das permissões da RLS.
- `Mostrar agenda completa` abre `/agenda` na data selecionada.
- A Agenda aceita a data recebida sem alterar seu funcionamento atual.
- Eventos, tarefas, audiências e prazos mantêm a mesma categorização da Agenda.
- Estados vazio, carregando e falha são apresentados sem quebrar o painel.
- O componente funciona em desktop e celular e pode ser operado por teclado.

## Testes previstos

- teste unitário do agrupamento e da ordenação dos itens por dia;
- teste de limite de três itens e cálculo da quantidade restante;
- teste do parâmetro de data válido e inválido na Agenda;
- teste do mês anterior e seguinte;
- teste de seleção de data e navegação para `/agenda`;
- teste dos estados vazio, carregando e falha;
- teste de renderização responsiva dos pontos críticos;
- verificação de TypeScript, lint dos arquivos alterados, suíte automatizada e
  build de produção.

## Fora deste ciclo

- criar, editar ou excluir compromissos diretamente no calendário compacto;
- substituir a página completa de Agenda;
- alterar o modelo de permissões do escritório;
- criar uma nova fonte de dados paralela para o painel;
- modificar a integração com Google Calendar;
- implementar filtros individuais por colaborador no calendário compacto.

Essas capacidades poderão ser avaliadas depois que a consulta resumida no
painel estiver validada em uso real.
