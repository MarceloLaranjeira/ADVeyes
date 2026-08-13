# Plano de implementação — Meu Painel

Data: 13 de agosto de 2026

Especificação de referência:
`docs/superpowers/specs/2026-08-13-adveyes-paridade-superior-advbox-design.md`

## Objetivo

Concluir a primeira tela do programa de paridade superior: um painel operacional
que responda rapidamente o que exige atenção, o que está agendado, como o
escritório está performando e se as integrações jurídicas estão saudáveis.

## Decisões

- Não alterar o esquema nesta entrega.
- Manter Supabase e RLS como autoridade; toda consulta inclui `tenant_id`.
- Substituir as consultas diretas da página por serviço e hook próprios.
- Consultar somente colunas necessárias e manter falhas parciais visíveis.
- Preservar calendário operacional, distribuição por área e rotas existentes.
- Exibir métricas financeiras do período com rótulos inequívocos.
- Priorizar ações e riscos antes de indicadores de inventário.

## Tarefas

### 1. Domínio do painel

Criar:

- `src/types/operational-dashboard.ts`;
- `src/services/operational-dashboard.ts`;
- `src/hooks/useOperationalDashboard.ts`.

O serviço carregará, em paralelo, processos, contatos, documentos, tarefas,
audiências, notificações, financeiro, leads, horas, metas e monitoramento. Cada
resultado será normalizado em um contrato único. Erros de módulos opcionais
gerarão avisos parciais; a tela não perderá todos os dados por uma única falha.

### 2. Componentes

Criar:

- `src/components/dashboard/OperationalKpis.tsx`;
- `src/components/dashboard/AttentionCenter.tsx`;
- `src/components/dashboard/FinancialOverview.tsx`;
- `src/components/dashboard/MonitoringOverview.tsx`;
- `src/components/dashboard/DashboardSkeleton.tsx`.

Os componentes receberão dados prontos e não acessarão o Supabase.

### 3. Integração da página

Refatorar `src/pages/Index.tsx` para:

- usar o hook do painel;
- mostrar saudação, escritório, horário da atualização e ação de recarga;
- apresentar centro de atenção e ações recomendadas;
- manter abas de visão, lista, quadro, desempenho e configurações;
- integrar calendário, audiências, notificações, áreas e processos recentes;
- oferecer estados de carregamento, falha total, dados parciais e vazio;
- remover consultas e estado duplicados da página.

### 4. Testes

Criar:

- `src/test/operational-dashboard.test.ts` para métricas, datas e avisos;
- `src/test/Index.test.tsx` para carregamento, erro, recarga e conteúdo crítico.

Atualizar testes afetados somente quando o comportamento aprovado mudar.

### 5. Verificação

Executar:

- testes focados;
- `npm run test`;
- `npx tsc --noEmit`;
- `npm run build`;
- lint dos arquivos alterados;
- revisão de práticas React;
- fluxo visual autenticado em desktop e viewport móvel.

## Critérios de aceite

- trocar de escritório invalida e recarrega apenas os dados do novo tenant;
- nenhuma consulta do painel mistura tenants;
- falha em um módulo opcional não apaga os demais indicadores;
- tarefas vencidas, de hoje e próximas levam à tela correta;
- métricas mensais usam datas do mês corrente;
- calendário e audiências mostram o mesmo universo operacional;
- a tela é utilizável por teclado e em celular;
- testes, TypeScript e build passam sem regressão nova.
