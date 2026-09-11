# Consolidação da Central Processual, navegação e cards jurídicos

Data: 26 de agosto de 2026  
Status: aprovado pelo usuário

## Objetivo

Eliminar a Busca Processual como módulo independente e incorporar suas funções
úteis à Central Processual. Reorganizar a navegação por domínio, separar a
operação processual do relacionamento com clientes e leads, remover
redundâncias, corrigir o enquadramento da logo e tornar os cards jurídicos
acionáveis e informativos.

A entrega abrange somente cards relacionados a processos, prazos, intimações,
andamentos e audiências. Cards financeiros, comerciais ou administrativos não
entram neste ciclo.

## Decisões aprovadas

- adotar consolidação funcional, não apenas visual;
- remover `Busca processual` do sidebar;
- incorporar a consulta oficial da tela antiga à Central Processual;
- manter `/busca` e `/jurisprudencia` como redirecionamentos compatíveis;
- preservar Controladoria, Intimações, Tarefas e Audiências como ambientes
  especializados, sem absorvê-los integralmente na Central;
- fazer cada card jurídico abrir o registro em seu ambiente interno de origem;
- manter links de tribunais e fontes oficiais como ações secundárias;
- exibir polos ativo e passivo nos cards/listas processuais e na ficha completa;
- exibir a data absoluta de vencimento e a situação relativa em cards de prazo;
- reorganizar o sidebar por domínio funcional e eliminar destinos repetidos;
- ajustar a logo para caber integralmente no cabeçalho em qualquer formato.

## Navegação principal

O sidebar passa a seguir esta hierarquia:

### Visão geral

- Painel executivo, quando disponível para a conta;
- Área de trabalho.

### Processos

- Central Processual;
- Controladoria Jurídica;
- Intimações;
- Audiências.

### Relacionamento

- Contatos;
- CRM — Leads.

### Organização

- Agenda;
- Tarefas;
- Documentos.

### Gestão

- Financeiro;
- Controle de horas;
- Gestão de equipe;
- Contratos;
- Indicadores.

### Ferramentas

- Integrações jurídicas;
- Criação de peças;
- WhatsApp;
- Portal do cliente;
- Configurações.

Cada destino principal aparece uma única vez. A classificação é semântica:
processos reúne acompanhamento e operação jurídica; relacionamento reúne
cadastros e captação; organização reúne compromissos e trabalho; gestão reúne
administração do escritório; ferramentas reúne integrações e canais auxiliares.

## Central Processual consolidada

A rota `/processos` continua sendo a porta de entrada da Central. Ela preserva
as visualizações atuais Central, Pipeline e Lista e recebe um bloco de Consulta
oficial, composto a partir dos serviços e componentes úteis existentes em
`BuscaJurisprudencia`.

A consulta deve aceitar os mesmos identificadores válidos já suportados,
principalmente número CNJ. Resultados confirmados devem continuar usando o
fluxo existente de cadastro ou confirmação, sem criar tabela paralela nem
duplicar processos.

Depois que a consulta for incorporada, a página autônoma de Busca Processual
deixa de ser renderizada. As rotas antigas redirecionam com `replace` para a
Central e preservam parâmetros aproveitáveis, em especial o termo de busca.
Links salvos não terminam em página inexistente.

Falha em uma fonte externa afeta apenas a Consulta oficial. Processos já
cadastrados, diagnósticos e filtros da Central permanecem utilizáveis.

## Cards jurídicos e destinos

O card inteiro é acionável por mouse, teclado e toque. Deve possuir foco
visível, semântica de link ou botão apropriada e rótulo acessível. Ações
internas, como menu, confirmação ou link oficial, interrompem a propagação para
não acionar também o destino principal.

O destino depende do tipo de registro:

| Tipo | Destino principal |
|---|---|
| Processo | `/processos/:id` |
| Prazo | `/controladoria?tab=prazos&focus=:id` |
| Intimação | `/intimacoes?focus=:id` |
| Andamento | `/processos/:processoId?tab=andamentos&focus=:id` |
| Audiência | `/audiencias?focus=:id` |

Quando o identificador do detalhe não estiver disponível, o card abre a lista
do domínio já filtrada pelo processo ou termo conhecido. Não haverá card com
aparência interativa sem ação real.

Os ambientes de destino leem `focus` da URL, destacam o registro quando ele
estiver carregado e preservam o parâmetro durante filtros compatíveis. O estado
relevante vive na URL para que atualização, compartilhamento e uso do botão
Voltar mantenham o contexto.

Links de tribunal ou fonte oficial permanecem separados, identificados como
externos, abertos em nova aba com `noopener` e `noreferrer`.

## Prazos e vencimentos

Cards de prazo ou cards jurídicos que representem prazo mostram sempre:

- data final absoluta em `dd/mm/aaaa`;
- situação relativa calculada no fuso do navegador;
- tratamento visual coerente com urgência.

Os textos normalizados serão:

- `Vence hoje`;
- `Vence amanhã`;
- `Faltam N dias`;
- `Venceu ontem`;
- `Venceu há N dias`;
- `Vencimento não definido`, quando a fonte não contém uma data válida.

O cálculo usa a data de vencimento persistida (`data_limite`, `data_prazo` ou o
campo equivalente já autorizado para o domínio). Ele não recalcula prazo
forense nem inventa uma data a partir do texto da intimação.

## Polos ativo e passivo

Cards e linhas processuais mostram os rótulos `Polo ativo` e `Polo passivo`,
com truncamento visual que preserve o valor completo por recurso acessível ou
na ficha. A ficha completa mantém o resumo no cabeçalho ou na visão geral e a
relação detalhada na aba Partes.

A resolução dos nomes segue esta precedência:

1. campos consolidados `polo_ativo` e `polo_passivo` do processo;
2. partes importadas e classificadas pelo lado processual;
3. `Não identificado`.

O sistema não deduz polo a partir do nome do cliente e não apresenta uma parte
incerta como fato.

## Componentes e responsabilidades

A mudança preserva a Central como coordenadora e separa responsabilidades:

- painel de Consulta oficial: entrada, validação, carregamento e resultados da
  consulta externa;
- adaptador de compatibilidade das rotas antigas;
- construtor de destinos jurídicos: produz URLs consistentes por tipo e
  identificador;
- card jurídico navegável: interação, teclado, foco e proteção das ações
  internas;
- resumo de polos: resolução e apresentação de ativo e passivo;
- apresentação de vencimento: formatação absoluta, texto relativo e urgência;
- leitores de `focus` em Controladoria, Intimações, Audiências e ficha do
  processo;
- sidebar: somente declaração da taxonomia e renderização dos grupos.

Funções de formatação, resolução de polos e construção de URLs devem ser puras
e testáveis. Páginas compõem esses elementos e não repetem regras.

## Logo e identidade visual

O bloco da marca no cabeçalho mantém a largura da régua lateral no desktop. A
imagem respeita proporção natural, usa contenção dentro da área disponível e
possui limites simultâneos de largura e altura, com margem segura. Nenhum pai
deve cortar o conteúdo necessário da marca.

No celular, a logo usa um limite menor sem trocar a proporção. O comportamento
deve ser verificado com marca horizontal, vertical e de duas linhas, incluindo
a marca configurada pelo tenant e o fallback da plataforma.

## Dados incompletos e falhas

- prazo sem data válida exibe `Vencimento não definido` e não recebe contagem
  relativa;
- polo ausente exibe `Não identificado`;
- foco não encontrado mostra a lista normalmente e um aviso não bloqueante;
- destino sem identificador específico usa a lista de origem filtrada;
- falha externa é isolada da leitura dos processos internos;
- uma ação secundária com erro não remove a capacidade de abrir o registro;
- parâmetros inválidos da URL são ignorados ou normalizados para padrões
  seguros.

## Acessibilidade

- cards operam com Enter e, quando tiverem semântica de botão, Espaço;
- foco é visível em todos os temas suportados;
- o nome acessível inclui tipo e identificação principal do registro;
- cor não é o único indicador de prazo vencido ou próximo;
- textos de polo usam rótulos explícitos;
- ícones externos possuem rótulo;
- áreas clicáveis não contêm controles aninhados inválidos.

## Validação

### Inventário e regressão

- localizar todos os cards de processos, prazos, intimações, andamentos e
  audiências;
- confirmar destino real para cada card;
- localizar e eliminar itens redundantes do sidebar;
- confirmar que rotas removidas possuem redirecionamento compatível;
- revisar erros já presentes nas áreas alteradas antes de concluir.

### Testes automatizados

- formatação de datas e classificação relativa do vencimento;
- ausência e invalidade de datas;
- resolução de polos pela precedência definida;
- construção de cada destino e seus fallbacks;
- interação por clique e teclado nos cards;
- ações internas sem navegação acidental;
- leitura e preservação de `focus`;
- redirecionamentos de `/busca` e `/jurisprudencia`;
- taxonomia e ausência de redundâncias no sidebar;
- enquadramento estrutural da logo.

### Fluxo visual e completo

- desktop e celular;
- Central, Controladoria, Intimações, Audiências e ficha processual;
- card de processo com os dois polos;
- prazo futuro, hoje, vencido e sem data;
- card para o ambiente de origem e retorno com filtros e rolagem preservados;
- consulta oficial com sucesso, vazia e com falha parcial;
- logo horizontal, vertical e de duas linhas sem corte.

Também serão executados TypeScript, lint dos arquivos alterados, suíte
automatizada e build de produção. Falhas preexistentes fora do escopo serão
registradas separadamente; nenhuma regressão causada pela entrega será aceita.

## Critérios de aceite

- `Busca processual` não aparece no sidebar;
- `/busca` e `/jurisprudencia` levam à Central sem quebrar links antigos;
- a Central oferece a consulta oficial antes isolada na busca;
- Processos e Relacionamento aparecem em grupos distintos;
- não há destino principal duplicado no sidebar;
- todos os cards jurídicos do escopo abrem um ambiente interno válido;
- cards de prazo exibem vencimento absoluto e relativo;
- polos ativo e passivo aparecem nos cards/listas processuais e na ficha;
- dados ausentes não são inventados;
- a logo aparece integralmente no desktop e no celular;
- navegação por teclado e foco visível funcionam;
- voltar preserva filtros e posição nos fluxos verificados;
- testes e build passam sem regressões da entrega.

## Fora do escopo

- tornar clicáveis cards financeiros, comerciais ou administrativos;
- absorver Controladoria, Intimações, Tarefas ou Audiências integralmente na
  Central Processual;
- remover as rotas especializadas desses módulos;
- alterar o cálculo jurídico de prazos;
- inferir polos por IA;
- redesenhar visualmente todas as páginas do sistema;
- modificar políticas de RLS ou o alcance de dados por usuário.
