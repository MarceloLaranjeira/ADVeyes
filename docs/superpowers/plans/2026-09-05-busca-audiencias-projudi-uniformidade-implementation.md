# Plano de implementação: busca, audiências, Projudi e uniformidade

Especificação de origem: `docs/superpowers/specs/2026-09-05-busca-audiencias-projudi-uniformidade-design.md`

## Meta

Publicar em produção uma busca global funcional e isolada por escritório, reorganizar a tela de audiências com filtros e paginação, adaptar o conector Projudi/TJAM à mesa do advogado exibida em setembro de 2026 e uniformizar cores, ícones e marca.

## Etapa 1 — Baseline e contratos

1. Executar os testes dirigidos atuais de cabeçalho, audiências, dashboard, marca e Projudi.
2. Confirmar a versão do Supabase CLI e consultar changelog/documentação atual antes de publicar funções.
3. Criar fixtures sanitizadas que representem:
   - página de login;
   - mesa do advogado com aba Audiências;
   - categorias com contadores;
   - lista paginada;
   - linha de audiência e linha de sessão de julgamento.
4. Não copiar login, nome pessoal, cookie, `noCache`, `jsessionid` ou qualquer segredo das capturas para fixtures ou logs.

## Etapa 2 — Busca global

Arquivos principais:

- novo `src/services/global-search.ts`;
- novo `src/components/search/GlobalSearch.tsx`;
- novo `src/pages/SearchResults.tsx`;
- `src/components/layout/AppHeader.tsx`;
- `src/App.tsx`;
- novos testes de serviço e componente.

Trabalho:

1. Definir um resultado normalizado com tipo, título, subtítulo, rota e metadados mínimos.
2. Consultar contatos, processos, tarefas e audiências pelo `tenant_id` atual.
3. Normalizar o termo e escapar caracteres usados nos filtros PostgREST.
4. Não consultar com menos de dois caracteres.
5. Aplicar debounce curto e cancelar/ignorar respostas obsoletas.
6. Mostrar menu com carregamento, erro, vazio e até cinco resultados.
7. Implementar clique da lupa, `Enter`, setas, `Escape` e seleção por clique.
8. Adicionar `/pesquisa?q=...` para a lista completa, com agrupamento e links.
9. Trocar o fundo azul da pesquisa por superfície branca, borda cinza e foco acessível.

Critérios locais:

- isolamento por tenant coberto por teste;
- nenhuma consulta abaixo do limite;
- rotas corretas para os quatro tipos;
- interação por mouse e teclado coberta.

## Etapa 3 — Audiências com filtros e paginação

Arquivos principais:

- `src/pages/Audiencias.tsx`;
- `src/services/hearings.ts`;
- novo `src/lib/hearing-filters.ts`;
- novos componentes em `src/components/audiencias/` para filtros, lista e indícios;
- testes de filtros, serviço e página.

Trabalho:

1. Extrair do componente principal a barra de filtros, a lista confirmada e o painel de indícios.
2. Representar filtros na URL: `q`, `period`, `from`, `to`, `status`, `type`, `court`, `page` e `view`.
3. Usar `future` como período inicial e 25 itens por página.
4. Consultar audiências no servidor com `count: exact`, ordenação por `data_hora` e `range`.
5. Manter compromissos confirmados na visão padrão.
6. Exibir indícios em visão separada, sem empurrar a agenda para baixo.
7. Incluir sessões de julgamento na lista confirmada.
8. Fazer o PDF respeitar os filtros ativos.
9. Traduzir estados do conector e diferenciar ativo, pausado, ação humana e desconectado.

Critérios locais:

- filtros individuais e combinados;
- restauração após recarregar a URL;
- paginação sem repetição;
- audiência confirmada visível antes de indícios;
- estado `layout_changed` exibido como “Requer atualização”.

## Etapa 4 — Adaptador Projudi/TJAM 2026

Arquivos principais:

- `supabase/functions/_shared/projudi-tjam-client.ts`;
- `supabase/functions/_shared/legal-portal-sync.ts` se o novo snapshot exigir metadados adicionais;
- `src/services/legal-portal.ts` para mensagens;
- `src/test/projudi-tjam-client.test.ts` e fixtures sanitizadas.

Trabalho:

1. Preservar autenticação, cookies efêmeros, timeout e validações existentes.
2. Reconhecer a mesa atual do advogado após o login.
3. Descobrir links de audiência pelo contexto ao redor do link, pois o texto clicável pode ser apenas uma quantidade.
4. Interpretar links em `href` e `onclick` sem executar JavaScript do portal.
5. Percorrer as categorias autorizadas, inclusive sessões de julgamento.
6. Descobrir paginação por texto, contexto e rota, com limites rígidos de páginas e URLs visitadas.
7. Restringir todas as requisições à origem oficial e aos protocolos HTTPS.
8. Extrair data, hora, processo, tipo, status, órgão, local, modalidade e link remoto das linhas e páginas de detalhe.
9. Remover parâmetros de sessão, cookies e identificadores transitórios de URLs persistidas.
10. Manter sincronização idempotente pelo identificador externo estável.
11. Registrar somente diagnóstico estrutural sanitizado quando o layout não for reconhecido.
12. Preservar registros existentes quando uma categoria falhar.

Critérios locais:

- fixture da interface atual reconhecida;
- todas as categorias percorridas;
- sessão de julgamento extraída;
- paginação limitada e sem ciclo;
- URL externa rejeitada;
- nenhum segredo presente em snapshot, erro ou log.

## Etapa 5 — Cores, ícones e marca

Arquivos principais:

- `src/index.css`;
- `src/components/dashboard/OperationalKpis.tsx`;
- componentes operacionais que ainda aplicam `primary` a ícones neutros;
- `src/components/common/Logo.tsx`;
- `src/components/layout/AppSidebar.tsx` e `AppHeader.tsx` apenas onde necessário;
- testes visuais/estruturais existentes.

Trabalho:

1. Definir classes/tokens neutros para ícones de cartões e campos.
2. Reservar azul para item de navegação ativo, foco e ação principal.
3. Aplicar cores semânticas somente a sucesso, atenção e falha.
4. Ajustar o bloco de marca para separar símbolo e nome.
5. Permitir até três linhas para nomes longos e reduzir a fonte de forma controlada.
6. Eliminar o espaço de símbolo quando não houver logo personalizada.
7. Conferir contraste em desktop e celular.

## Etapa 6 — Verificação local

1. Rodar testes dirigidos a cada etapa.
2. Rodar `npx tsc --noEmit`.
3. Rodar `npm run lint`.
4. Rodar a suíte completa com `npm test`.
5. Rodar `npm run build`.
6. Abrir a aplicação local e validar:
   - busca rápida e página completa;
   - filtros e paginação;
   - audiência confirmada antes dos indícios;
   - mensagem do conector pausado;
   - marca longa;
   - contraste e responsividade.
7. Conferir console sem erros e ausência de tela em branco.

## Etapa 7 — Publicação controlada

1. Revisar o diff e manter fora do commit alterações preexistentes não relacionadas.
2. Publicar a função `legal-portal-admin` e qualquer dependência alterada com JWT habilitado.
3. Verificar logs da função sem dados sensíveis.
4. Publicar o frontend em produção.
5. Validar o domínio oficial em desktop e celular.
6. Revalidar uma conexão pausada somente por ação autorizada do escritório; não reutilizar credenciais fora do fluxo seguro.
7. Confirmar no banco a quantidade de audiências recebidas, criadas e atualizadas sem expor dados pessoais.

## Estratégia de rollback

- Frontend: promover a implantação anterior da Vercel.
- Edge Function: republicar a versão anterior do adaptador.
- Dados: como a sincronização é idempotente e não apaga audiências anteriores durante falha, não haverá exclusão automática a reverter.

## Resultado esperado

O usuário consegue pesquisar registros pelo cabeçalho, localizar audiências com filtros claros e ver compromissos confirmados imediatamente. A integração Projudi/TJAM acompanha a mesa do advogado atual, importa também sessões de julgamento e falha de modo seguro quando o tribunal mudar novamente.
