# Busca global, audiências Projudi e uniformidade visual

Data: 5 de setembro de 2026

## Objetivo

Corrigir a visão operacional do ADVeyes para que a busca global funcione, a tela de audiências priorize compromissos com data e hora confirmadas, o conector autenticado do Projudi/TJAM acompanhe a interface atual do tribunal e a paleta visual permaneça uniforme.

## Diagnóstico confirmado

- O campo de busca do cabeçalho é apenas visual: não possui estado, evento de submissão nem consulta de dados.
- O escritório Albertino e Advogados Associados possui 24 indícios de audiência, mas nenhuma audiência com data e hora confirmadas.
- O escritório Alves e Quirino possui 117 indícios e apenas um compromisso confirmado. A lista de indícios empurra esse compromisso para o fim da página.
- As conexões Projudi/TJAM examinadas estão pausadas com `layout_changed` e sem sincronização concluída.
- A página autenticada atual do Projudi apresenta uma aba de audiências com categorias e quantidades. O conector existente não percorre corretamente essa nova navegação.
- O cabeçalho, os cartões operacionais, os estados e as etiquetas usam azul em excesso e de forma inconsistente.
- Nomes longos de escritórios podem ser cortados ou reduzidos a reticências no bloco de marca.

## Decisões aprovadas

- A busca global mostrará resultados rápidos enquanto o usuário digita.
- A tela de audiências usará filtros sempre visíveis.
- O período inicial exibirá todas as audiências futuras, com paginação.
- Sessões de julgamento serão importadas junto com audiências, identificadas pelo tipo correto.
- A correção será integrada: interface, busca, ordenação, filtros e conector Projudi no mesmo pacote.

## 1. Busca global

O cabeçalho terá um formulário de busca com superfície branca, borda cinza e ícone de lupa neutro. A pesquisa começa após dois caracteres e usa atraso curto para evitar consultas em excesso.

Os resultados serão agrupados por contatos, processos, tarefas, audiências e sessões de julgamento. O menu rápido mostrará até cinco resultados relevantes.

Clicar em um resultado abrirá o registro correspondente. Clicar na lupa ou pressionar `Enter` abrirá uma página completa de resultados, preservando o termo na URL. A navegação por teclado permitirá percorrer resultados, abrir o item e fechar a lista.

Todas as consultas serão limitadas ao `tenant_id` do escritório selecionado. A interface exibirá carregamento, ausência de resultados e falha de consulta sem travar o cabeçalho.

## 2. Tela de audiências

A tela terá uma barra de filtros sempre visível com:

- busca por número do processo, cliente, vara, magistrado ou texto;
- período;
- status;
- tipo de audiência ou sessão;
- tribunal ou origem.

O período padrão será “Todas as futuras”. Também haverá opções para hoje, próximos 7 dias, próximos 30 dias, intervalo personalizado, passadas e todas.

Os filtros serão persistidos na URL. A lista será ordenada por `data_hora` crescente e paginada em 25 registros. A exportação em PDF respeitará os filtros ativos.

A área de conteúdo terá dois conjuntos claramente separados:

1. Compromissos confirmados, contendo somente registros com data e hora comprovadas.
2. Indícios para revisão, contendo movimentações que mencionam audiência, mas não comprovam data e hora.

Compromissos confirmados sempre aparecerão primeiro. Indícios não ocuparão a lista principal nem esconderão audiências reais. As sessões de julgamento ficarão na mesma lista, com o tipo “Sessão de julgamento”.

## 3. Conector Projudi/TJAM

O adaptador continuará usando a função segura já existente. Credenciais não serão incluídas em logs, respostas ou evidências persistidas.

Após autenticar, o conector deverá:

1. reconhecer a página “Mesa do Advogado Particular” atual;
2. localizar a aba de audiências pela navegação e pelo conteúdo, sem depender de uma única URL fixa;
3. descobrir as categorias apresentadas pelo tribunal, incluindo conciliação, interrogatório, audiência una, instrução e julgamento e sessões de julgamento;
4. seguir somente URLs da origem oficial `https://projudi.tjam.jus.br`;
5. percorrer paginação e páginas de detalhes quando necessário;
6. extrair número do processo, tipo, início, término quando disponível, status, vara, local, modalidade e link remoto;
7. normalizar horários para `America/Manaus`;
8. gerar identificador externo estável para impedir duplicações.

Datas sem hora comprovada permanecerão como indício. Nenhum compromisso será inventado. O conector preservará registros importados anteriormente em caso de falha.

## 4. Estados e mensagens

As mensagens técnicas serão traduzidas para linguagem operacional:

- `invalid_credentials`: login ou senha recusados;
- `captcha_required`: validação humana exigida pelo tribunal;
- `certificate_required`: certificado digital exigido;
- `portal_unavailable`: portal temporariamente indisponível;
- `portal_timeout`: tempo de resposta excedido;
- `layout_changed`: conector requer atualização após mudança na agenda.

Uma conexão pausada será apresentada como “Requer atualização”, e não como desconectada. O botão será “Revalidar acesso”. O estado deve informar que as credenciais e as audiências já importadas foram preservadas.

## 5. Uniformidade visual e marca

- Campo de busca e ícones operacionais usarão branco, cinza frio e grafite.
- Azul ficará reservado à navegação ativa, foco e ações principais.
- Cores de status usarão somente significados consistentes: verde para sucesso, âmbar para atenção e vermelho para falha ou cancelamento.
- Cartões, filtros, etiquetas e ícones usarão os mesmos tokens de superfície, borda e texto.
- O bloco de marca reservará uma área para o símbolo e outra para o nome.
- Nomes longos poderão ocupar até três linhas, com redução controlada do tamanho da fonte e sem truncamento prematuro.
- Quando não houver logo, o nome aproveitará a largura disponível sem deixar um quadrado vazio desproporcional.

## 6. Componentes e limites

As responsabilidades serão separadas em unidades pequenas:

- `GlobalSearch`: estado, consulta, agrupamento e navegação dos resultados rápidos;
- serviço de busca: consultas tenant-scoped e normalização dos resultados;
- filtros de audiências: estado serializável na URL e predicados de exibição;
- lista de audiências: paginação, ordenação e cartões;
- painel de indícios: revisão separada da agenda confirmada;
- adaptador Projudi/TJAM: autenticação, descoberta de links, paginação e extração;
- tokens visuais: superfícies neutras e estados semânticos.

Não fazem parte deste pacote a criação de conectores autenticados para outros tribunais, a automação por navegador do usuário ou a transformação automática de indícios sem data em compromissos.

## 7. Testes e critérios de aceite

### Busca

- Não consulta com menos de dois caracteres.
- Mostra resultados agrupados e limitados ao escritório selecionado.
- Lupa e `Enter` executam a busca completa.
- Clique e teclado abrem a rota correta.
- Estados vazio, carregando e erro são visíveis.

### Audiências

- O padrão lista todas as futuras em ordem crescente.
- Cada filtro funciona sozinho e em combinação.
- A URL restaura os filtros após recarregar.
- A paginação não duplica nem omite registros.
- Compromissos confirmados aparecem antes dos indícios.
- Sessões de julgamento são exibidas com tipo próprio.
- O PDF respeita a seleção atual.

### Projudi

- Fixtures da interface antiga e da interface 2026 são aceitas.
- Categorias e paginação são descobertas sem URL fixa.
- URLs externas ou não autorizadas são recusadas.
- Credenciais e identificadores de sessão são removidos de logs e evidências.
- A sincronização repetida é idempotente.
- Mudanças desconhecidas pausam o conector sem apagar dados.

### Visual

- A pesquisa não usa fundo azul.
- Ícones operacionais são neutros por padrão.
- Foco, contraste e navegação atendem leitura em desktop e celular.
- Nomes longos de escritórios permanecem legíveis sem cortar a marca.

## Entrega

A implementação será validada com testes dirigidos, suíte completa, TypeScript, lint, build de produção e verificação visual em desktop e celular. O conector será publicado somente após os testes de extração e a verificação de que nenhum dado sensível aparece nos logs.
