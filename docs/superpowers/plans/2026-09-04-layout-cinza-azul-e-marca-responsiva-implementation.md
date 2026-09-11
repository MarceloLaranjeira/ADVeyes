# Plano de implementação: layout cinza e azul e marca responsiva

## Resultado esperado

O ADVeyes passa a usar fundo cinza claro, superfícies brancas e navegação azul
profissional em todas as telas, sem alterar funcionalidades. A área de marca
acomoda logos de formatos variados e nomes longos sem corte ou deformação.

## Etapa 1 — Paleta global

Arquivos:

- `src/index.css`
- `src/lib/brand-presets.ts`

Ações:

1. substituir os tokens quentes por neutros frios;
2. definir azul profissional como cor primária e da sidebar;
3. alinhar estados hover, foco, bordas e superfícies;
4. atualizar a amostra do preset padrão ADVeyes;
5. manter cores semânticas de sucesso, alerta e erro.

## Etapa 2 — Navegação e telas públicas

Arquivos:

- `src/components/layout/AppSidebar.tsx`
- `src/pages/Cadastro.tsx`
- demais telas encontradas por busca de cores antigas fixadas.

Ações:

1. remover a faixa dourada dos itens ativos;
2. usar contraste adicional de peso e indicador azul-claro/branco;
3. substituir navy e bege fixos nas telas públicas pelos tokens aprovados;
4. preservar ilustrações e cores semânticas sem relação com o tema.

## Etapa 3 — Marca responsiva

Arquivos:

- `src/components/common/Logo.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/configuracoes/IdentidadeVisual.tsx`

Ações:

1. criar limites explícitos para a caixa da marca em desktop e celular;
2. manter imagens com `object-fit: contain`;
3. limitar nomes longos a três linhas com tamanho adaptativo;
4. usar o nome curto na variante móvel quando disponível;
5. fazer a prévia usar o mesmo componente e a mesma geometria do cabeçalho.

## Etapa 4 — Testes e qualidade

Arquivos:

- `src/test/Logo.test.tsx`
- `src/test/AppSidebar.test.tsx`
- novo teste de tokens visuais, se necessário.

Controles:

1. logo horizontal, quadrada, vertical e ausente;
2. nome curto, nome longo e variante móvel;
3. item ativo sem dourado;
4. busca por cores antigas no código;
5. testes focados, TypeScript, lint e suíte completa;
6. build de produção.

## Etapa 5 — Publicação

1. publicar o frontend no projeto Vercel `adveyes`;
2. confirmar estado `READY` e alias `adveyes.automatikus.com.br`;
3. conferir que o domínio entrega o bundle novo;
4. validar rotas públicas e carregamento da aplicação.
