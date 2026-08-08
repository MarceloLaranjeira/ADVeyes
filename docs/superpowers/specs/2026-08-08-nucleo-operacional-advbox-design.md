# Núcleo operacional do ADVeyes inspirado no ADVBOX

Data: 8 de agosto de 2026
Status: aprovado para planejamento

## Objetivo

Entregar no ADVeyes um núcleo operacional jurídico completo, inspirado nos
fluxos observados no ADVBOX, sem copiar sua marca ou identidade visual. O
ADVeyes preservará sua linguagem, paleta, componentes e diferenciais de IA,
mas adotará uma experiência integrada para painel, atividades, agenda,
processos, intimações e trabalho em equipe.

Esta é a primeira entrega de um programa maior de paridade funcional. CRM,
contatos, modelos, financeiro, relatórios, configurações avançadas e
onboarding/OAB serão tratados em ciclos posteriores.

## Princípios

- Entregar fluxos verticais utilizáveis de ponta a ponta.
- Manter o banco e a RLS como autoridade de segurança.
- Preservar a identidade visual do ADVeyes.
- Reutilizar serviços, tipos e componentes existentes.
- Evitar componentes monolíticos e consultas duplicadas.
- Fazer mudanças de banco somente por migrações versionadas.
- Garantir isolamento entre escritórios em todas as operações.

## Escopo

### Painel operacional

O painel apresentará:

- tarefas concluídas no período;
- tarefas pendentes e atrasadas;
- alcance de metas;
- desempenho por profissional;
- calendário mensal com indicadores por dia;
- compromissos agrupados em não lidos, hoje e demais;
- atalhos para criar e consultar registros.

O painel executivo atual será preservado onde trouxer indicadores adicionais.
Os novos blocos operacionais serão incorporados sem duplicar métricas.

### Atividades

A rota de tarefas evoluirá para um espaço de atividades com as abas:

- Visão geral;
- Lista;
- Quadro Kanban;
- Desempenho.

A barra de ferramentas oferecerá busca, filtros, ordenação, exportação e ações
em lote. Os filtros mínimos serão responsável, processo, prazo, prioridade e
status. Cada item exibirá título, prioridade, prazo, processo, responsável e
estado de leitura.

As ações disponíveis serão criar, editar, concluir, reabrir, reatribuir,
favoritar e excluir, respeitando as permissões do usuário. O Kanban manterá as
colunas A Fazer, Fazendo e Concluída. Alterações por arrastar usarão atualização
otimista com reversão automática quando o banco rejeitar a operação.

### Agenda

A agenda reunirá, sem duplicar os dados de origem:

- tarefas com prazo;
- audiências;
- eventos e compromissos;
- prazos derivados de publicações;
- demais datas jurídicas confirmadas.

Os eventos serão consultados por uma camada de serviço comum que normaliza os
tipos e preserva o identificador e a origem de cada registro. Abrir um item
levará ao registro original ou ao painel contextual correspondente.

### Processos e intimações

As listagens de processos e intimações terão busca, filtros, ordenação,
paginação e exportação. Ao selecionar um processo, um painel lateral permitirá
consulta e edição rápida sem abandonar a listagem.

O painel lateral oferecerá:

- identificação e número CNJ;
- partes e seus papéis;
- área, grupo e tipo de ação;
- responsável;
- anotações;
- atalhos para tarefa, documento, andamento e lançamento financeiro.

A página completa do processo continuará sendo o local para timeline,
documentos, publicações, compromissos, dados financeiros e demais detalhes. Em
dispositivos móveis, o painel lateral será apresentado como uma folha de
largura total.

### Ação global

O cabeçalho terá uma ação global Adicionar, com entradas para tarefa, processo,
contato, compromisso e lançamento. Cada entrada reutilizará o formulário do
módulo correspondente e retornará à tela de origem após salvar.

## Modelo de dados

### Tarefas

Além dos campos existentes, a tarefa deverá suportar:

- `tenant_id`: escritório proprietário;
- `user_id`: criador;
- `responsavel_id`: executor atual;
- `processo_id`: processo relacionado;
- `status` e `prioridade`;
- `data_limite` e `concluida_em`;
- leitura ou não leitura;
- favorita;
- categoria ou etiquetas;
- pontos de produtividade;
- datas de criação e alteração.

Os nomes e tipos definitivos serão definidos no plano de implementação após
comparação com o esquema existente. Campos já disponíveis não serão recriados.

### Regras de integridade

- O responsável deve ter vínculo ativo com o mesmo `tenant_id` da tarefa.
- O processo vinculado deve pertencer ao mesmo `tenant_id` da tarefa.
- Alterar o status para concluída preenche `concluida_em` no banco.
- Reabrir a tarefa limpa `concluida_em`.
- Pontos só entram nas métricas quando a conclusão é válida.
- Remover ou suspender um membro não apaga seu histórico.
- Registros sem responsável permanecem visíveis e recebem apresentação segura.

As validações críticas serão feitas no banco. Validações equivalentes na
interface servirão apenas para feedback imediato.

### Visibilidade e permissões

- Proprietário e administrador iniciam com a visão do escritório.
- Demais colaboradores iniciam em Minhas tarefas.
- A possibilidade de ampliar a visão depende das permissões do membro.
- Filtros de interface não substituem autorização.
- SELECT, INSERT, UPDATE e DELETE continuarão protegidos por políticas RLS com
  predicados de escritório e permissão.
- Qualquer função privilegiada necessária ficará fora de esquemas expostos,
  terá `search_path` controlado e permissões explícitas.

### Auditoria e notificações

Serão auditadas as mudanças relevantes de responsável, status, prazo e vínculo
processual. Os eventos mínimos de notificação serão atribuição, reatribuição,
prazo próximo, atraso e conclusão. A infraestrutura existente de notificações
e preferências será reutilizada.

## Arquitetura de frontend

O trabalho será dividido em unidades pequenas:

- serviço e hook de atividades;
- serviço e hook do painel operacional;
- serviço normalizador de agenda;
- seletor reutilizável de membros ativos;
- filtros reutilizáveis de responsável e processo;
- cartão e linha de atividade;
- painel contextual de processo;
- componentes de métricas e desempenho.

TanStack Query será preferido para cache, invalidação e estados assíncronos onde
for compatível com a arquitetura atual. Estado local ficará restrito a
formulários, seleção, filtros temporários e interação de arrastar.

## Fluxo de dados

1. A tela obtém o escritório ativo do `TenantContext`.
2. O serviço consulta somente registros desse escritório.
3. A RLS valida o usuário e sua permissão.
4. Dados de membros ativos alimentam responsáveis, avatares e filtros.
5. Mutações invalidam apenas as consultas afetadas.
6. Atualizações em tempo real mantêm notificações e atividades sincronizadas.
7. Métricas são calculadas com datas persistidas pelo banco, especialmente
   `concluida_em`, e não inferidas apenas do estado atual.

## Tratamento de falhas

- Falhas mostrarão uma mensagem compreensível e a causa técnica útil.
- A interface oferecerá nova tentativa quando a operação for repetível.
- Exclusões só desaparecerão da tela após confirmação do banco.
- Atualizações otimistas guardarão o estado anterior e farão rollback em erro.
- Busca, filtros e ordenação permanecerão ativos após atualização dos dados.
- Referências removidas ou inacessíveis serão mostradas como indisponíveis sem
  quebrar a tela.
- Operações em lote informarão sucessos e falhas parciais separadamente.

## Responsividade e acessibilidade

- Kanban terá rolagem horizontal controlada em telas estreitas.
- A lista será a alternativa prioritária no celular.
- Painéis laterais virarão folhas de largura total.
- Ações terão rótulos acessíveis e foco visível.
- Cores de status serão acompanhadas de texto ou ícone.
- Drag and drop terá alternativa por menu para teclado e toque.

## Entregas

### Entrega 1 — Banco e segurança

- complementar o esquema de atividades;
- validar responsável e processo por escritório;
- implementar auditoria necessária;
- revisar RLS e grants;
- atualizar tipos TypeScript;
- adicionar testes SQL.

### Entrega 2 — Atividades

- carregar membros ativos;
- permitir responsável selecionável;
- implementar lista, Kanban, filtros e ações em lote;
- incluir leitura, favorita, etiquetas e pontos;
- criar visão de desempenho.

### Entrega 3 — Painel e agenda

- adicionar métricas operacionais;
- exibir desempenho por profissional;
- integrar calendário e compromissos;
- criar atalhos de ação.

### Entrega 4 — Processos e intimações

- aprimorar listagens e filtros;
- implementar painel contextual;
- conectar tarefas, documentos, andamentos e financeiro;
- integrar responsáveis e intimações.

## Testes e critérios de aceite

### Banco

- Um usuário nunca acessa registros de outro escritório.
- Um responsável de outro escritório é rejeitado.
- Um processo de outro escritório não pode ser vinculado.
- Concluir e reabrir atualizam `concluida_em` corretamente.
- Suspender um membro preserva o histórico.
- O Advisor do Supabase não recebe novos alertas relacionados às mudanças.

### Interface

- Proprietário e administrador veem o escritório por padrão.
- Colaborador vê suas tarefas por padrão.
- Filtros, busca e ordenação podem ser combinados.
- Lista e Kanban mostram os mesmos registros filtrados.
- Reatribuição atualiza responsável, avatar e métricas.
- Agenda abre o registro correto de cada origem.
- Painel contextual funciona em desktop e celular.
- Falhas de mutação restauram o estado anterior.

### Qualidade

- testes unitários de datas, filtros e métricas;
- testes de componentes críticos;
- testes SQL de RLS e integridade;
- fluxo de navegador em desktop e celular;
- `npm run build`, `npx tsc --noEmit` e testes aprovados;
- nenhuma regressão nova de lint nos arquivos alterados.

## Fora deste ciclo

- reprodução da identidade visual do ADVBOX;
- CRM completo e suas automações;
- biblioteca pública de modelos;
- contabilidade e conciliação bancária avançadas;
- relatórios gerais fora do núcleo operacional;
- onboarding comercial completo;
- migração automática de dados de concorrentes.

Esses itens permanecem no objetivo de paridade funcional, mas terão designs e
planos próprios após a conclusão do núcleo operacional.
