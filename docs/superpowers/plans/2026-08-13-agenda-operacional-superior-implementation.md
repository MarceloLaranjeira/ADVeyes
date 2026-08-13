# Agenda operacional superior — plano de implementação

## Objetivo

Entregar a segunda tela do programa de paridade superior: uma Agenda multitenant
com escopo inteligente por perfil, quatro visualizações, filtros persistidos,
fontes operacionais normalizadas, centro de atenção e integração Google Calendar
preservada.

## Estratégia

1. Fortalecer o contrato do calendário operacional com intervalo, escopo,
   resultados parciais e metadados de processo/cliente.
2. Isolar regras puras de URL, período, filtros e conflitos para permitir testes
   determinísticos.
3. Separar a interface em cabeçalho, filtros, atenção, visualizações e painel de
   detalhes, mantendo o formulário canônico de eventos.
4. Reduzir `Agenda.tsx` à coordenação de rota, consulta, seleção e mutações.
5. Preservar os fluxos atuais do Google Calendar e a escrita canônica em
   `eventos`.
6. Validar serviços, componentes, suíte completa, TypeScript, build, lint e
   carregamento no navegador.

## Tarefas

### 1. Domínio e consultas

- ampliar `OperationalCalendarItem` com término, tipo, cliente e sincronização;
- representar falhas por fonte sem descartar dados válidos;
- consultar somente o intervalo visível;
- aplicar `tenant_id` em todas as fontes e usuário no escopo pessoal;
- carregar membros ativos para filtros e identificação de responsáveis;
- manter consultas paralelas e normalização ordenada.

### 2. Regras puras

- interpretar e serializar data, visão, escopo e filtros da URL;
- calcular intervalos de mês, semana, dia e lista;
- filtrar itens sem perder a origem;
- detectar conflitos do mesmo responsável;
- classificar urgências e itens sem responsável.

### 3. Componentes

- cabeçalho responsivo com escopo, navegação temporal e ações;
- filtros combináveis com resumo e limpeza;
- centro de atenção acionável;
- mês, semana, dia e lista sobre o mesmo conjunto;
- cartões acessíveis com texto além de cor;
- painel contextual com links para entidades canônicas;
- skeleton, vazio, falha parcial e erro total.

### 4. Coordenação e mutações

- tornar a URL a fonte de verdade do contexto navegável;
- abrir criação a partir de dia/horário;
- manter edição e exclusão de eventos com `tenant_id`;
- invalidar/refazer somente a consulta operacional relevante;
- manter falhas de Google Calendar independentes da persistência local.

### 5. Testes e aceite

- testes unitários de normalização, parâmetros, intervalos, filtros e conflitos;
- testes de componentes críticos e da rota;
- teste focado de consultas multitenant;
- regressão da suíte existente;
- TypeScript, build e lint focado;
- verificação do servidor local no navegador em desktop e viewport móvel.

## Restrições

- sem migração de banco neste ciclo;
- sem sincronização bidirecional com Google;
- sem duplicar tarefas, audiências ou processos na tabela de eventos;
- sem confiar em filtros do frontend como autorização;
- sem alterar código ou arquivos preexistentes fora do escopo, incluindo `tmp/`.

