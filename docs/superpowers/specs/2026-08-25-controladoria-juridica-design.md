# Controladoria Jurídica e navegação da Central Processual

## Objetivo

Criar a Controladoria Jurídica: um módulo único onde o escritório enxerga e
conduz a operação processual — prazos, intimações, movimentações, protocolos,
documentos, audiências, responsáveis e status. A mesma entrega corrige a
Central Processual, que perde a tela e a posição de rolagem quando o advogado
volta da ficha de um processo, e separa os processos arquivados dos que estão
em andamento.

## Problemas confirmados

1. A operação está espalhada por quatro telas, e uma delas não existe. Prazos
   vivem em Tarefas, intimações em Intimações, audiências em Audiências e
   movimentações dentro da ficha de cada processo; protocolos não têm lugar
   nenhum. Para saber o que o escritório precisa fazer hoje é preciso abrir e
   cruzar todas elas.
2. Um prazo confirmado a partir de uma intimação vira uma linha em `tarefas`
   sem nenhum marcador. No banco ele é indistinguível de "ligar para o
   cliente", o que impede qualquer contagem confiável de prazos.
3. `publicacoes.review_status` registra a triagem do sistema
   (`pending_review`, `reviewed`), não a ciência do escritório. Não existe
   campo que responda quem tomou ciência de uma intimação e quando, então
   "intimação sem ciência" não é uma pergunta que a base saiba responder.
4. Protocolo não existe como registro. Não há como afirmar que uma peça foi
   protocolada, quando, por quem, nem guardar o comprovante junto do ato.
5. `Processos.tsx` lê `?focus=` uma única vez, na montagem, e mantém busca,
   filtros, aba e paginação em `useState`. Ao voltar da ficha de um processo
   o componente remonta, o estado volta ao padrão e a página aparece no topo.
   O advogado refaz a busca a cada consulta.
6. `status = 'Arquivado'` é apenas mais um valor do filtro. Processos
   arquivados ocupam a lista de trabalho e entram nas métricas de
   inteligência, onde aparecem como "sem avanço" — por definição, para
   sempre.

## Decisões aprovadas

- A Controladoria é um posto de comando que lê e age: concentra a visão e
  permite dar ciência, gerar prazo, atribuir responsável, mudar status,
  registrar protocolo e anexar documento sem sair da tela. Tarefas,
  Intimações e Audiências continuam existindo como espaços de trabalho
  profundos. Nenhum dado é duplicado: mesma tabela, outra lente.
- Prazo continua sendo `tarefas`, distinguido por um marcador de tipo. Nada
  migra, e a geração a partir da intimação, a Agenda, o Kanban e a atribuição
  de responsável seguem funcionando sem alteração.
- Protocolo é registro próprio, que pode encerrar um prazo ou existir sozinho
  — uma petição inicial não nasce de prazo algum.
- "Protocolado" não é status: é uma tarefa concluída com protocolo
  vinculado. O sistema não afirma que houve protocolo sem o registro do ato.
- A Área de trabalho continua sendo a leitura de negócio do escritório. Seu
  Centro de atenção e seus próximos compromissos passam a levar para a
  Controladoria.
- A agregação acontece no cliente, como no painel operacional atual.
  Contadores usam contagem exata sem retorno de linhas; listas trazem poucos
  registros, filtrados e ordenados no servidor.
- A separação entre ativos e arquivados usa o `status` cadastrado, não a fase
  inferida das movimentações.
- O estado da Central Processual passa a viver na URL, e a restauração de
  rolagem vira comportamento da régua do aplicativo.

## Modelo de dados

### Protocolos

Tabela nova, protegida por RLS e com `GRANT` explícitos:

- identificador e `tenant_id`;
- `processo_id` e `numero_processo` — o número fica guardado à parte para o
  protocolo em processo ainda não cadastrado;
- tipo: `peticao`, `contestacao`, `recurso`, `apelacao`, `embargos`,
  `manifestacao`, `cumprimento` ou `outro`;
- data do protocolo e número do recibo devolvido pelo tribunal;
- responsável e autor do registro;
- `tarefa_id` opcional: o prazo que este protocolo encerra;
- observação, criação e atualização.

As políticas de RLS seguem exatamente as das tabelas irmãs do módulo `legal`
— `private.has_tenant_permission(tenant_id, 'legal', <ação>)` —, o que dá
visibilidade de escritório. Ver a seção Alcance de dados sobre por que essa é
a regra vigente e por que protocolos não pode divergir dela.

### Acréscimos a tabelas existentes

Todos com valor padrão que preserva o comportamento atual:

- `tarefas.tipo` (`tarefa` ou `prazo`, padrão `tarefa`) — separa prazo
  processual de tarefa comum;
- `documentos.protocolo_id` — permite anexar a peça protocolada e o
  comprovante ao ato, e não apenas ao processo;
- `publicacoes.ciencia_em` e `publicacoes.ciencia_por` — registram que o
  escritório tomou ciência, quem tomou e quando;
- `review-publication-deadline` passa a marcar como `prazo` a tarefa que cria.

Uma ideia foi descartada durante a implementação: gravar também
`source_type = 'publicacao'` e `source_id` nessa tarefa, para encurtar o
caminho de volta até a intimação. Não é possível. O índice único
`tarefas_external_source_uidx (tenant_id, source_type, source_id)` já pertence
à tarefa de triagem que a ingestão cria para cada publicação nova, e o segundo
registro colidiria, fazendo falhar toda confirmação de prazo. O caminho de
volta continua sendo `deadline_suggestions.confirmed_task_id`.

### Status da providência

Três dos quatro estados já existem em `tarefas`: `pendente`, `em_andamento`
(elaboração) e `concluída`. É criado `em_revisao`, entre elaboração e
conclusão. O acréscimo aparece como uma coluna a mais no Kanban de Tarefas —
é o único efeito da entrega fora do módulo novo.

## Interface

A rota é `/controladoria`, com item no grupo Rotina jurídica da barra
lateral, acima de Agenda.

### Camada de ação

O topo responde o que exige ação agora, misturando domínios. Cinco contadores
— vencidos, vence hoje, próximos sete dias, sem ciência e sem responsável —
filtram a lista logo abaixo em vez de abrir outra tela.

Vencidos, vence hoje e próximos sete dias contam tarefas com `tipo = 'prazo'`
não concluídas. Sem ciência conta publicações do tipo intimação ainda sem
`ciencia_em` e que não foram dispensadas. Sem responsável conta prazos não
concluídos sem `responsavel_id`, independentemente da data.

A lista unificada ordena por urgência e mostra, em cada linha, o tipo, o
título, o processo, o cliente, o responsável e quanto falta: `venceu há 2
dias`, `hoje`, `amanhã`, `faltam 4 dias`. Ao lado ficam os próximos
compromissos, que são as audiências dos próximos sete dias, e o que foi feito
no período — protocolos registrados e prazos concluídos.

### Abas

Abaixo da camada de ação, uma aba por domínio, cada uma com filtro por
responsável, status, processo e período:

| Aba | Ações disponíveis | Origem |
|---|---|---|
| Prazos | mudar status, atribuir responsável, registrar protocolo | `tarefas` com `tipo = 'prazo'` |
| Intimações | dar ciência, gerar prazo, dispensar | `publicacoes` |
| Audiências | marcar realizada ou adiada | `audiencias` |
| Protocolos | registrar, anexar peça e comprovante | `protocolos` e `documentos` |
| Movimentações | criar providência a partir do andamento | `process_movements` e `andamentos` |
| Documentos | anexar e baixar | `documentos` |

Responsáveis não formam aba: são coluna e filtro em todas elas, porque a
pergunta é sempre quem responde por aquele prazo ou providência.

Dois filtros valem para a tela inteira: escopo — meus ou do escritório — e
período dos blocos de compromissos e do que já foi feito.

### Organização do código

A página é apenas composição. Cada bloco e cada aba são componentes em
`src/components/controladoria/`, e o cálculo — dias restantes, classificação
de urgência, ordenação e agrupamento — fica em `src/lib/controladoria.ts`,
testável sem renderizar nada. A página de Intimações, com mais de mil e
duzentas linhas, é o exemplo do que evitar.

## Serviço e consultas

`src/services/controladoria.ts` segue o formato do painel operacional: uma
função por bloco, todas disparadas em paralelo por um hook, com avisos por
bloco.

Os cinco contadores usam contagem exata sem retorno de linhas. Os três
primeiros recaem sobre o índice existente
`tarefas_tenant_status_idx (tenant_id, status, data_limite)`; a tabela de
protocolos nasce com os seus.

As listas trazem pouco e já ordenado pelo servidor: na camada de ação, vinte
prazos vencidos ou vencendo em até sete dias somados a dez intimações sem
ciência; cinco audiências nos compromissos; e os protocolos do período no
bloco do que foi feito. As abas paginam por intervalo, sem carregar tudo para
filtrar no navegador.

O período padrão dos blocos de compromissos e do que já foi feito é de sete
dias, ajustável na própria tela.

### Alcance de dados

Hoje a visibilidade dos módulos jurídicos é do escritório inteiro, e isso é
deliberado. A migration `20260807210000_processos_tarefas_tenant_rls.sql`
removeu a restrição por registro de `clientes`, `processos`, `eventos`,
`tarefas`, `audiencias` e `documentos`, deixando as políticas apenas com
`private.has_tenant_permission(tenant_id, 'legal', <ação>)`. O comentário da
própria migration explica: a condição por registro estava quebrada e, como
`assigned` é o padrão de `tenant_memberships.data_scope`, mantê-la esconderia
tudo de todo advogado recém-convidado. A função
`private.can_access_tenant_record` continua existindo, e o mapa
`tenant_record_assignments` também, mas nenhuma política os consulta.

Duas consequências para esta entrega:

- `protocolos` nasce com as mesmas políticas das tabelas irmãs. Dar a ela
  restrição por registro criaria a única tabela do módulo jurídico invisível
  para quem foi convidado ontem — incoerência sem ganho real, já que o prazo
  ao lado continuaria visível.
- O seletor entre meus e do escritório é apenas um filtro de conveniência
  sobre o que a pessoa já enxerga. Ele não é, e o desenho não deve tratá-lo
  como, uma fronteira de segurança.

Reativar o alcance por registro é uma entrega própria: muda o que todos os
usuários atuais enxergam, exige popular `tenant_record_assignments` para o
acervo existente e precisa de decisão sobre o padrão de quem entra. Fica
fora deste plano.

O cálculo de quanto falta é a diferença entre `data_limite` e hoje, em dias
corridos, no fuso do navegador — o mesmo que o restante do sistema usa. Dias
corridos porque a data já está correta: quem a calculou em dias úteis foi o
calendário forense no momento da confirmação, e ele continua sendo a
autoridade sobre isso.

Um bloco que falha mostra o próprio erro e os demais continuam, como o painel
já faz hoje. Depois de cada ação, apenas a consulta afetada é invalidada.

## Central Processual

### Estado na URL

Aba, busca, fase, quem precisa agir, risco, área, "somente sem avanço",
quantidade carregada e situação passam a ser espelhados na URL por
`src/lib/process-workspace.ts`, com funções puras de leitura e escrita, no
mesmo padrão já usado pela página de Tarefas.

A escrita usa substituição, não empilhamento. Sem isso, cada tecla digitada
na busca vira uma entrada de histórico e o botão Voltar passa a desfazer
letra por letra.

### Rolagem

A restauração vira comportamento da régua do aplicativo, valendo para
qualquer página de lista:

- a restauração automática do navegador é desligada;
- navegação nova rola para o topo, que é o esperado ao abrir um processo;
- voltar restaura a posição guardada para aquela entrada de histórico,
  identificada pela chave que o roteador atribui a cada entrada;
- a restauração insiste a cada quadro até a página ficar alta o bastante,
  desistindo por volta de um segundo. Sem essa insistência ela acontece antes
  de os dados chegarem, quando a página ainda tem altura zero, e não faz
  nada.

### Arquivados

Um seletor de situação com três estados — ativos, que é o padrão, arquivados
e todos — também espelhado na URL. Com os arquivados fora do padrão, os
cartões de métrica deixam de contar como "sem avanço" processos que, por
definição, não avançam mais.

## Backend e autorização

O registro de protocolo grava o protocolo e conclui o prazo em uma única
operação transacional no banco. Dois comandos soltos permitiriam o estado
meio-feito em que o prazo consta concluído sem protocolo — exatamente a
afirmação falsa que este módulo existe para eliminar.

A função valida o ator, confere que a tarefa pertence ao mesmo escritório e
usa `search_path` fixo, com execução revogada de `PUBLIC`, como as demais
funções privilegiadas do projeto.

A Controladoria não cria autoridade nova: quem pode ver e agir sobre prazos,
intimações, audiências e documentos continua sendo decidido pelas políticas
já vigentes desses módulos, sem exceção nem atalho — reunir tudo em uma tela
não pode conceder nada que a tela de origem negaria. Protocolos entram na
matriz de permissões da interface dentro do grupo Processos, refletindo a
política `legal` que a tabela usa.

## Erros e observabilidade

O que passa por Edge Function — a geração de prazo a partir da intimação —
usa o tradutor de erros compartilhado, com código estável e identificador de
diagnóstico.

O que consulta tabela diretamente distingue três situações: ausência de
permissão, que não é falha e merece mensagem própria; indisponibilidade; e
falha desconhecida. Detalhes internos do banco nunca chegam ao navegador.

## Testes e critérios de aceite

### Banco

- isolamento de protocolos entre escritórios;
- membro ativo com permissão de leitura no módulo jurídico enxerga os
  protocolos do próprio escritório, incluindo os de outro responsável — é a
  regra vigente das tabelas irmãs, e o teste existe para travá-la contra
  divergência acidental;
- quem não é membro ativo não enxerga nada;
- registro de protocolo é atômico: falha na conclusão do prazo não deixa
  protocolo órfão, e o inverso também não ocorre;
- protocolo apontando para tarefa de outro escritório é recusado;
- tarefa sem `tipo` continua valendo como tarefa comum.

### Frontend

- dias restantes classificados em vencido, hoje, amanhã e faltam N dias;
- ordenação da camada de ação por urgência;
- contadores que filtram a lista sem trocar de tela;
- ações de dar ciência, gerar prazo, atribuir responsável e registrar
  protocolo a partir da própria Controladoria;
- ida e volta entre estado e URL na Central Processual, com padrões
  preservados;
- arquivados fora da lista padrão e fora das métricas;
- rolagem restaurada ao voltar e topo ao avançar.

### Fluxo completo

O critério final é o advogado abrir a Controladoria e, sem clicar em nada,
ver o que venceu, o que vence hoje, quantos dias faltam nos próximos, o que
entrou sem ciência, o que foi feito na semana e quais são os próximos
compromissos; dar ciência a uma intimação e gerar o prazo dali mesmo;
atribuir um responsável; registrar o protocolo que encerra esse prazo com o
comprovante anexado; e, na Central Processual, abrir um processo e voltar
para a mesma tela, com os mesmos filtros e na mesma posição de rolagem.

## Fora desta entrega

Notificação de prazo vencendo, exportação e relatórios da Controladoria,
edição em lote e sincronização de audiência com calendário externo. Todos
cabem depois, sobre a base pronta.

## Implantação

1. Aplicar e testar a migration em desenvolvimento.
2. Publicar a função de registro de protocolo e a alteração da geração de
   prazo.
3. Publicar o frontend com a Controladoria, a Central Processual revista e a
   restauração de rolagem.
4. Executar os advisors de segurança e desempenho.
5. Validar com contas de proprietário, advogado com alcance total e advogado
   com alcance restrito.
6. Implantar em janela de baixo uso e acompanhar erros e tempo de resposta da
   camada de ação.
