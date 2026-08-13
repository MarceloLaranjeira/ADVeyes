# ADVeyes — Atividades operacionais superiores

Data: 13 de agosto de 2026  
Status: aprovado e implementado

## Objetivo

Evoluir a tela de Atividades do ADVeyes até cobrir os fluxos operacionais
mapeados na referência e superá-los em gestão de carga, contexto jurídico,
acessibilidade, ações em lote e rastreabilidade. A entrega preservará a fonte
canônica `tarefas`, o estado individual em `tarefa_user_state`, os recursos
atuais de responsáveis, favoritos, leitura e pontos e as integrações com
publicações e processos.

Foi escolhida a evolução estrutural. A página existente será decomposta em
unidades focadas enquanto os serviços, formulários e contratos válidos forem
reutilizados. Não haverá reescrita geral do módulo nem duplicação de atividade
por visualização.

## Escopo inicial por perfil

- proprietário e administrador iniciam em `Visão geral`;
- colaborador inicia em `Minha Lista`;
- o usuário poderá trocar de visualização sem perder filtros ou posição;
- a visão do escritório será oferecida somente a quem tiver permissão;
- `Minha Lista` aplicará o usuário autenticado como responsável;
- filtros de interface não substituirão RLS ou permissões do banco.

## Visualizações

Todas as visualizações serão projeções do mesmo conjunto filtrado:

- `Visão geral`, para prioridades, carga, atrasos e produtividade;
- `Lista`, para execução, seleção, ordenação, paginação e lote;
- `Kanban`, para fluxo por status;
- `Calendário`, para distribuição por prazo;
- `Desempenho`, para conclusão, pontos e carga por profissional.

A URL será a fonte de verdade para visualização, escopo, busca, filtros,
ordenação e página. Atualizar, compartilhar ou retornar à rota deverá restaurar
o mesmo contexto. Parâmetros inválidos usarão padrões seguros.

No celular, `Lista` será a apresentação prioritária. O Kanban terá rolagem
horizontal controlada e toda ação por arraste terá alternativa por menu.

## Busca, filtros e ordenação

A barra unificada combinará:

- busca por título, descrição, processo ou cliente;
- responsável;
- processo;
- status;
- prioridade;
- categoria;
- situação de prazo;
- favoritas;
- não lidas.

Ordenações iniciais:

- prazo crescente ou decrescente;
- prioridade;
- criação recente ou antiga;
- título;
- pontos.

Limpar filtros preservará a visualização e o escopo. A seleção múltipla será
limpa quando uma mudança de filtros retirar os itens selecionados do resultado.

## Lista, seleção e paginação

A Lista exibirá título, status, prioridade, prazo, processo, cliente,
responsável, categoria e pontos. Terá alternativa em cartões responsivos sem
perder ações essenciais.

A seleção múltipla permitirá, conforme permissão:

- reatribuir responsável;
- mudar status;
- mudar prioridade;
- alterar prazo;
- marcar como lida;
- excluir.

A paginação será real sobre o conjunto filtrado e ordenado. O tamanho inicial
será adequado à leitura em desktop e poderá ser alterado entre opções
predefinidas. Operações em lote atuarão sobre os identificadores selecionados,
não apenas sobre a página visível.

## Kanban e Calendário

O Kanban manterá as colunas `Pendente`, `Em andamento` e `Concluída`. Arrastar,
usar o menu da atividade ou executar uma ação em lote chamará a mesma mutação de
status. A conclusão atualizará `concluida_em` pela regra canônica existente.

O Calendário reutilizará as regras e componentes compartilháveis da Agenda.
Atividades com data limite serão posicionadas no dia correspondente. O clique
abrirá o painel contextual da atividade; o calendário não criará cópia em
`eventos`.

## Visão geral e desempenho

A Visão geral mostrará:

- atividades pendentes, em andamento e concluídas no período;
- atividades atrasadas;
- pontos concluídos;
- prioridades imediatas;
- carga por profissional;
- atividades sem responsável.

Desempenho usará datas persistidas pelo banco. Pontos só contarão após conclusão
válida, considerando `concluida_em`. Os comparativos não inferirão conclusão
apenas pelo estado visual atual.

## Painel contextual e formulário

Selecionar uma atividade abrirá um painel sem desmontar a listagem. Ele exibirá:

- título, descrição, status, prioridade e prazo;
- responsável;
- processo e cliente;
- origem e vínculo jurídico;
- categoria ou etiquetas;
- pontos;
- estado individual de leitura e favorito;
- histórico permitido quando disponível;
- ações de edição, conclusão, reatribuição, favorito e exclusão.

O formulário existente continuará sendo o formulário canônico. Poderá ser
aberto pela ação global, por coluna do Kanban ou pelo painel contextual.
Formulários preservarão os valores após falha.

Atividades originadas de publicação ou prazo jurídico manterão a origem e o
processo visíveis. Campos protegidos por esse vínculo não serão removidos
silenciosamente.

## Exportação

A exportação CSV respeitará escopo, filtros e ordenação. Incluirá:

- título;
- status;
- prioridade;
- responsável;
- processo;
- cliente;
- prazo;
- categoria;
- pontos.

Os valores serão escapados corretamente para CSV e datas serão apresentadas em
formato compreensível. A exportação não incluirá registros fora da autorização
do usuário.

## Arquitetura de frontend

A rota de Atividades será composta por unidades focadas:

- contrato de rota e filtros;
- serviço e hook de leitura operacional;
- cabeçalho, seletor de escopo e alternância de visualização;
- barra de busca, filtros, ordenação e exportação;
- métricas e visão geral;
- Lista e paginação;
- Kanban;
- Calendário;
- Desempenho;
- cartão ou linha de atividade;
- barra de ações em lote;
- painel contextual;
- formulário canônico;
- estados de carregamento, vazio, falha parcial e erro total.

A rota coordenará parâmetros, seleção e composição. Filtragem, ordenação,
paginação, métricas, exportação e preparação de operações em lote ficarão em
funções testáveis fora da camada visual.

## Dados e fluxo

`tarefas` continuará como fonte canônica. `tarefa_user_state` permanecerá a
fonte de favorito e leitura por usuário. Processo, cliente e responsável serão
carregados por relações pertencentes ao mesmo escritório, evitando buscas
repetidas dentro de cada visualização.

O fluxo será:

1. a rota valida os parâmetros da URL;
2. o contexto fornece usuário, escritório, função e escopo permitido;
3. o hook consulta atividades, estados individuais e relações do escritório;
4. o serviço aplica `tenant_id` explicitamente às fontes;
5. o banco aplica RLS, integridade e auditoria;
6. regras puras filtram, ordenam, paginam e calculam métricas;
7. todas as visualizações recebem o mesmo resultado;
8. mutações atualizam a entidade canônica e invalidam apenas as consultas
   afetadas;
9. atualizações otimistas guardam snapshot e restauram o estado anterior em
   caso de erro.

## Operações em lote

As operações serão processadas por identificadores explícitos e usarão a mesma
camada de mutação das ações individuais. O resultado distinguirá:

- itens alterados com sucesso;
- itens rejeitados por permissão ou integridade;
- itens que falharam por indisponibilidade transitória.

Uma falha não ocultará atividades não alteradas. Itens com falha continuarão
selecionados para correção ou nova tentativa. Exclusões só desaparecerão após
confirmação do banco.

## Segurança e multitenancy

- todas as leituras e mutações usarão o `tenant_id` ativo;
- responsável e processo deverão pertencer ao mesmo escritório da atividade;
- proprietário e administrador verão o escritório conforme permissão;
- colaboradores iniciarão no escopo próprio e não poderão ampliá-lo sem
  autorização;
- RLS continuará sendo a autoridade final;
- filtros no cliente não serão controles de segurança;
- origem jurídica, vínculo processual, responsável, status e prazo continuarão
  sujeitos às regras de auditoria existentes;
- nenhuma chave privilegiada será enviada ao navegador.

## Tratamento de falhas

- carregamento mostrará uma estrutura estável da visualização selecionada;
- falha parcial preservará atividades válidas e indicará a relação
  indisponível;
- erro total oferecerá nova tentativa sem apagar a URL;
- estado vazio diferenciará ausência real de resultado filtrado;
- formulários conservarão dados após erro;
- mutações otimistas farão rollback;
- exclusões só desaparecerão após confirmação;
- operações em lote manterão selecionados os itens que falharem;
- referências removidas ou inacessíveis aparecerão como indisponíveis;
- mensagens preservarão uma causa técnica útil sem expor dados sensíveis.

## Acessibilidade e responsividade

- Lista será prioritária em telas estreitas;
- Kanban terá rolagem controlada;
- painéis e filtros móveis ocuparão a largura disponível;
- ações terão nomes acessíveis e foco visível;
- seleção em lote será operável por teclado;
- status, prioridade e atraso nunca serão comunicados somente por cor;
- drag and drop terá alternativa equivalente por menu;
- alvos de toque terão tamanho adequado.

## Estratégia de testes

### Unidade

- interpretação e serialização da URL;
- combinação de filtros;
- ordenação;
- paginação;
- métricas e pontos concluídos;
- exportação CSV;
- preparação e resultado de operações em lote;
- regras de prazo e atraso.

### Componentes

- abertura padrão por perfil;
- alternância entre as cinco visualizações;
- busca, filtros e limpeza;
- seleção e barra de lote;
- paginação;
- Kanban por arraste e menu;
- Calendário e abertura da atividade;
- painel contextual;
- estados de carregamento, vazio, falha parcial e erro.

### Serviço e integração

- consultas filtram o escritório ativo;
- escopo próprio aplica o usuário correto;
- relações são limitadas ao mesmo escritório;
- mutações otimistas restauram o snapshot em falha;
- lote separa sucessos e falhas;
- origem jurídica e processo não são perdidos;
- exportação respeita autorização e filtros.

### Validação final

- consulta segura ao Supabase real em modo somente leitura;
- fluxo autenticado em desktop e celular;
- comparação funcional com a referência;
- suíte completa de testes;
- `npx tsc --noEmit`;
- `npm run build`;
- lint focado nos arquivos alterados.

## Critérios de aceite

- proprietário e administrador abrem na Visão geral;
- colaborador abre em Minha Lista;
- Visão geral, Lista, Kanban, Calendário e Desempenho usam o mesmo conjunto
  filtrado;
- visualização, escopo, filtros, ordenação e página sobrevivem ao
  recarregamento;
- busca e filtros podem ser combinados;
- Lista permite seleção, paginação, ordenação, exportação e lote;
- Kanban possui alternativa acessível ao arraste;
- Calendário abre a atividade correta sem duplicá-la;
- painel contextual preserva posição da listagem;
- pontos usam conclusão persistida;
- lote informa sucessos e falhas e mantém selecionados os itens malsucedidos;
- falhas parciais não apagam dados válidos;
- não há acesso cruzado entre escritórios;
- interface funciona em desktop e celular;
- testes, TypeScript, build e lint focado são aprovados.

## Fora deste ciclo

- motor genérico de automações configuráveis;
- novos status personalizados por escritório;
- decisões jurídicas automáticas sem confirmação humana;
- chat interno completo por atividade;
- edição colaborativa em tempo real de descrição;
- reestruturação geral de Processos, Intimações ou CRM;
- cópia da identidade visual, textos ou ativos da ADVBOX.
