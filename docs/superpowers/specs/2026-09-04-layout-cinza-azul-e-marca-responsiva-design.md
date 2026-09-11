# Layout cinza e azul com marca responsiva

**Data:** 4 de setembro de 2026  
**Status:** aprovado para planejamento

## Objetivo

Substituir a aparência bege e azul-marinho do ADVeyes por uma identidade mais
clara: fundo cinza muito claro, superfícies brancas, sidebar e ações em azul
profissional. Corrigir também a apresentação da marca de cada escritório para
que logos e nomes longos permaneçam proporcionais e legíveis.

Esta mudança abrange a área autenticada, login, cadastro e demais telas
públicas. Não altera banco de dados, integrações, processos ou regras de prazo.

## Direção visual aprovada

A opção escolhida foi **A — Azul profissional**.

| Papel | Cor | Uso |
|---|---|---|
| Fundo | `#F2F5F8` | Canvas geral das páginas |
| Superfície | `#FFFFFF` | Cartões, diálogos, cabeçalhos e formulários |
| Sidebar | `#28577F` | Navegação principal e área da marca |
| Sidebar ativa | `#3971A3` | Item ativo e hover |
| Ação principal | `#3B73A3` | Botões primários e elementos de destaque |
| Ação principal hover | `#2F628B` | Estado hover/foco do botão |
| Borda | `#DCE3EA` | Divisores, inputs e cartões |
| Texto principal | `#1F2937` | Títulos e conteúdo |

As cores semânticas de erro, alerta, sucesso e informação permanecem distintas.
O dourado deixa de marcar navegação ativa e não será usado como cor estrutural.

## Aplicação do tema

Os tokens de `src/index.css` serão a fonte principal da paleta. Componentes que
tenham cores antigas fixadas diretamente nas classes serão ajustados apenas
quando necessário para aderir aos tokens. A mudança deve alcançar:

- layout autenticado, cabeçalho e sidebar;
- login, cadastro, conclusão de cadastro e recuperação de senha;
- onboarding e telas públicas;
- botões primários, focos, links ativos e estados de navegação;
- cartões, campos e superfícies de conteúdo.

Personalizações cadastradas por escritório continuam permitidas nos pontos já
previstos, desde que não reduzam contraste ou legibilidade do texto.

## Componente de marca

No desktop, a área da marca permanece com 240 por 64 pixels, alinhada à
largura da sidebar. A marca se adapta dentro desse limite sem aumentar o
cabeçalho.

- Logos enviadas usam `object-fit: contain` e nunca são cortadas ou esticadas.
- Logos horizontais, quadradas e verticais recebem limites de largura e altura
  apropriados ao formato.
- Quando existe apenas o ícone, ele ocupa no máximo 40 por 40 pixels e o nome
  aparece ao lado.
- Sem arquivo personalizado, o sistema exibe o símbolo padrão e o nome do
  escritório.
- Nomes longos quebram em no máximo três linhas, com redução moderada da fonte
  e quebra segura de palavras.
- No celular, uma variante compacta preserva espaço para busca e ações.
- A prévia de Identidade Visual deve reproduzir as mesmas regras do cabeçalho.

Se a logo enviada já contiver o nome do escritório, a imagem completa será
mostrada sem repetir um segundo nome textual ao lado.

## Acessibilidade e estados

Texto e ícones devem manter contraste adequado nos fundos claros e azuis. O
estado de foco continua visível em teclado, o item ativo não depende apenas de
cor e botões desabilitados permanecem distinguíveis. Estados semânticos não
serão convertidos para azul.

## Componentes afetados

- tokens e estilos globais em `src/index.css`;
- `LogoFull` e variantes de marca em `src/components/common/Logo.tsx`;
- área de marca do `AppHeader`;
- estados ativo e hover do `AppSidebar`;
- prévia em `IdentidadeVisual`;
- telas públicas que ainda possuam bege, navy ou azul antigo fixado diretamente.

Não será realizado refactor de páginas sem relação com a identidade visual.

## Validação

A implementação será aprovada somente depois dos seguintes controles:

1. testes de componente para logo horizontal, quadrada, vertical e ausente;
2. teste de nome curto e nome muito longo;
3. verificação visual em desktop e celular;
4. verificação de login, cadastro, painel e Identidade Visual;
5. TypeScript, lint, testes automatizados e build de produção;
6. verificação do bundle e das rotas principais após a publicação.

## Critérios de aceite

- nenhuma área estrutural permanece com o fundo bege anterior;
- conteúdo principal usa cinza claro e superfícies brancas;
- sidebar e botões primários usam a escala azul aprovada;
- navegação ativa não usa o detalhe dourado anterior;
- logo e nome nunca ultrapassam nem deformam o bloco da marca;
- nomes longos continuam legíveis sem alterar a altura do cabeçalho;
- funcionamento existente do ADVeyes permanece inalterado.
