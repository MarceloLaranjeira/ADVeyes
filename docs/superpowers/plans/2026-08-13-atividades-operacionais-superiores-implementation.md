# Atividades operacionais superiores — plano de implementação

## Objetivo

Entregar a terceira tela do programa de paridade superior, preservando o domínio
existente e completando a experiência com escopo por perfil, URL persistente,
cinco visualizações, filtros completos, ordenação, paginação, exportação, painel
contextual e ações em lote.

## Estratégia

1. Ampliar o contrato de atividades com relações de processo e cliente,
   resultados parciais e operações em lote tenant-scoped.
2. Isolar em funções puras as regras de rota, filtros, ordenação, paginação,
   métricas e CSV.
3. Extrair componentes reutilizáveis para toolbar, métricas, lista, Kanban,
   calendário, desempenho, painel contextual e lote.
4. Reduzir `Tarefas.tsx` à coordenação de rota, seleção, formulário e mutações.
5. Preservar favorito, leitura, pontos, origem jurídica e formulário canônico.
6. Validar consultas reais, testes, TypeScript, lint, build e navegador.

## Tarefas

### 1. Dados e domínio

- carregar atividades, estado individual, processo e cliente por `tenant_id`;
- preservar falhas parciais de relações auxiliares;
- aplicar escopo pessoal quando exigido;
- oferecer mutação única e operação em lote com resultado por item;
- manter rollback nas alterações otimistas.

### 2. Regras puras

- interpretar e serializar a URL;
- combinar filtros e busca;
- ordenar e paginar;
- calcular métricas operacionais e produtividade;
- gerar CSV seguro;
- reconciliar seleção após mudança de resultado.

### 3. Interface

- cabeçalho, escopo e cinco visualizações;
- toolbar completa;
- visão geral e desempenho;
- lista selecionável e paginada;
- Kanban com menu alternativo ao arraste;
- calendário de prazos;
- painel contextual;
- barra de lote e estados de carregamento, vazio e falha.

### 4. Mutações

- criação, edição e exclusão canônicas;
- status, prioridade, responsável e prazo por uma única camada;
- favoritos e leitura por usuário;
- lote com sucessos e falhas separados;
- itens malsucedidos permanecem selecionados.

### 5. Validação

- testes de domínio e rota;
- testes de componentes e página;
- consulta somente leitura ao Supabase real;
- suíte completa, TypeScript, lint focado e build;
- verificação local no navegador.

## Restrições

- sem migração de banco neste ciclo;
- sem criar status personalizados;
- sem duplicar tarefas no calendário ou em outras tabelas;
- sem usar filtros do cliente como autorização;
- sem alterar `tmp/` ou mudanças preexistentes fora do escopo.

