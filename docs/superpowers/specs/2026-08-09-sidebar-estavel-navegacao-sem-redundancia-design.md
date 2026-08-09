# Sidebar estável e navegação sem redundância

Data: 9 de agosto de 2026
Status: aprovado para planejamento

## Objetivo

Corrigir o movimento visual da barra lateral durante a troca de páginas e
reduzir os caminhos de navegação repetidos. A sidebar será a única navegação
principal do ADVeyes. O cabeçalho ficará dedicado a ações globais, enquanto os
cartões da Área de trabalho continuarão funcionando como atalhos contextuais.

## Problema atual

Cada página monta seu próprio `AppLayout`. Ao navegar, a sidebar é desmontada e
montada novamente. Sua posição de rolagem é restaurada em um efeito executado
depois da pintura da tela, o que pode mostrar o menu no topo por um instante e
em seguida movê-lo para a posição salva. Esse salto causa a impressão de que o
menu sobe ou desce sozinho ao clicar.

Além disso, vários módulos aparecem simultaneamente:

- na sidebar;
- como ícones de navegação no cabeçalho;
- no bloco `Ações Rápidas` da Área de trabalho.

Os cartões de métricas do painel também são clicáveis, mas foram classificados
como atalhos contextuais: eles apresentam dados e levam ao detalhamento da
métrica, portanto não serão tratados como menu duplicado.

## Decisão técnica

Neste ciclo será adotada a estabilização da rolagem antes da pintura da tela.
A posição do elemento rolável continuará sendo preservada entre as páginas,
mas será aplicada de forma síncrona antes de o navegador exibir o novo estado.

Essa abordagem foi escolhida porque resolve o comportamento percebido com
baixo risco e sem exigir a migração imediata de todas as páginas para rotas de
layout aninhadas. A criação futura de um shell persistente com `Outlet` continua
sendo uma melhoria arquitetônica possível, mas fica fora deste ciclo.

## Comportamento da sidebar

- A sidebar permanece fixa abaixo do cabeçalho no desktop.
- Somente a área interna de navegação possui rolagem vertical.
- Clicar em um item não altera a posição visível da lista.
- A posição muda apenas por rolagem explícita do usuário.
- Não haverá rolagem automática para colocar o item ativo no centro ou no topo.
- A posição será preservada durante a navegação dentro da aplicação.
- Uma nova sessão começa no topo; a posição não precisa sobreviver ao fechamento
  completo da aba.
- No celular, selecionar um item continua fechando o menu lateral.
- Abrir novamente o menu na mesma sessão restaura sua posição anterior.

## Navegação principal

A sidebar será a única lista de destinos principais e continuará organizada em
grupos funcionais:

- conta e operação geral;
- rotina jurídica;
- pesquisa;
- gestão;
- IA e ferramentas.

Cada rota principal aparecerá somente uma vez nessa estrutura. O destaque do
item ativo não alterará sua altura, espaçamento ou posição, evitando deslocar
os itens vizinhos.

## Cabeçalho

O cabeçalho manterá somente:

- alternador de ambiente ou escritório;
- busca global;
- ação global `Adicionar`;
- notificações;
- menu da conta;
- ação comercial de contratação, quando aplicável.

Serão removidos do cabeçalho os atalhos isolados que duplicam destinos da
sidebar:

- Assistente IA;
- Documentos ou importar;
- Controle de horas ou cronômetro;
- WhatsApp;
- Configurações.

O menu `Adicionar` permanece porque representa intenção de criação e não uma
segunda lista de navegação. Neste ciclo, seus destinos e formulários atuais
serão preservados; a abertura direta de formulários poderá ser aprimorada em
uma entrega própria.

O menu da conta poderá manter perfil, plano e saída, pois são ações relacionadas
à sessão e à conta, não substitutos da navegação de módulos.

## Área de trabalho

O bloco `Ações Rápidas` será removido integralmente, pois repete módulos que já
estão disponíveis na sidebar.

Os cartões de métricas continuarão clicáveis. Exemplos:

- Processos abre o detalhamento de processos;
- Clientes abre contatos;
- Prazos e tarefas abrem a rotina correspondente;
- Financeiro abre os lançamentos relacionados.

Esses cartões permanecem porque combinam informação, estado e acesso ao
detalhamento. Eles não serão apresentados visualmente como um segundo menu.

## Acessibilidade e interação

- A sidebar continuará operável por teclado.
- O foco visível será preservado nos links.
- Remover os atalhos do cabeçalho não eliminará nenhuma rota acessível.
- Ícones restantes no cabeçalho terão rótulos acessíveis.
- A rolagem pelo teclado, roda do mouse e gesto de toque continuará funcionando.
- O estado ativo usará cor, contraste e marcador lateral sem alterar dimensões.

## Tratamento de estados

- Um valor de rolagem ausente, inválido ou negativo será interpretado como zero.
- Se a lista ficar menor que a posição salva, o navegador limitará a rolagem ao
  máximo válido.
- Falhas de acesso ao `sessionStorage` não impedirão a renderização da sidebar;
  nesse caso, a sessão começará no topo.
- Alterações de permissão que incluam ou removam itens não provocarão tentativa
  de localizar automaticamente o item ativo.

## Critérios de aceite

- A sidebar não mostra salto para cima ou para baixo ao trocar de página.
- Clicar em um item mantém a posição de rolagem do menu no desktop.
- Rolar a página principal não movimenta a sidebar.
- Rolar a sidebar não movimenta a área principal.
- No celular, o menu fecha após selecionar uma rota.
- Os cinco atalhos duplicados são removidos do cabeçalho.
- Busca, Adicionar, notificações, conta e contratação permanecem no cabeçalho.
- O bloco `Ações Rápidas` não aparece mais na Área de trabalho.
- Os cartões de métricas permanecem clicáveis.
- Todos os módulos removidos dos atalhos continuam acessíveis pela sidebar.

## Testes previstos

- teste da leitura e validação da posição salva;
- teste da gravação da posição somente durante a rolagem;
- teste de montagem da sidebar sem reposicionamento visível posterior;
- teste de fechamento do menu no celular após seleção;
- teste de ausência dos atalhos redundantes no cabeçalho;
- teste de ausência do bloco `Ações Rápidas` no painel;
- teste de permanência dos cartões de métricas clicáveis;
- TypeScript, lint dos arquivos alterados, suíte automatizada e build.

## Fora deste ciclo

- migrar todas as páginas para uma rota de layout persistente com `Outlet`;
- reorganizar ou renomear os grupos da sidebar;
- remover cartões de métricas ou seus links contextuais;
- alterar os formulários acionados pelo menu `Adicionar`;
- criar preferências pessoais de ordenação do menu;
- implementar recolhimento da sidebar no desktop.
