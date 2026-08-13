# ADVeyes — paridade funcional superior à ADVBOX

Data: 13 de agosto de 2026  
Status: aprovado para especificação

## Objetivo

Evoluir o ADVeyes, tela por tela, até cobrir os fluxos operacionais mapeados na
ADVBOX e superá-los em integração, automação, inteligência jurídica,
rastreabilidade e experiência de uso. O programa preserva a base já construída:
multitenancy, RLS, integrações jurídicas, núcleo operacional, portal do cliente,
WhatsApp, jurisprudência e IA jurídica.

O objetivo não é reproduzir código, marca ou identidade visual de terceiros.
O ADVeyes manterá identidade própria e implementará os comportamentos relevantes
com arquitetura, componentes e dados próprios.

## Decisão de estratégia

Foi escolhida a evolução tela por tela. Cada tela será concluída de ponta a
ponta antes do avanço para a seguinte: interface, dados reais, permissões,
automações, responsividade, acessibilidade e testes.

Essa estratégia não autoriza duplicação de domínio. As telas compartilham uma
fundação comum de serviços, entidades e componentes. Quando uma capacidade
existe em mais de uma tela, ela terá uma implementação central reutilizável.

## Inventário funcional de referência

O mapeamento autenticado da ADVBOX identificou:

- Meu Painel: produtividade, tarefas, pontos, metas, calendário, compromissos e
  intimações recentes;
- Agenda: visões mensal, semanal e diária, com filtros por pessoa e tipo;
- Atividades: produtividade, calendário, lista, busca, filtros, ordenação,
  exportação e responsáveis;
- CRM: funil por etapas, busca, filtros, exportação e conversão operacional;
- Contatos: indicadores, origens, faixa etária, profissões, cadastro, filtros e
  exportação;
- Processos: indicadores, metas, fases, busca, filtros, exportação e ficha do
  processo;
- Intimações: intervalo, responsável, processo, tribunal, situação, filtros,
  ordenação e impressão;
- Parceiros: rede, processos compartilhados e demandas entre escritórios;
- Modelos: documentos em branco, modelos do escritório e biblioteca pública;
- Financeiro: saldo, previsões, atrasos, receitas, despesas, transferências,
  competência e lançamentos;
- Relatórios: agilidade, produtividade, atrasos, pontuação, responsáveis e
  exportação;
- Configurações: usuários, IA, termos monitorados, financeiro, tarefas,
  workflows, tipos, etapas, metas, origens, parceiros, caixa de entrada,
  notificações, integrações e API;
- Conta e assinatura: dados da conta, plano, pagamento e termos de uso.

O ADVeyes já possui capacidades adicionais que devem ser incorporadas à
experiência comum: sincronização OAB, DJEN, DataJud, Escavador, audiências,
documentos com reconhecimento, IA jurídica, jurisprudência, WhatsApp, contratos,
horas, relatórios processuais em PDF, gestão de equipe, portal do cliente e
administração multitenant/white-label.

## Ordem de entrega

### Programa 1 — Núcleo operacional

1. Meu Painel;
2. Agenda;
3. Atividades;
4. Contatos;
5. Processos e ficha única;
6. Intimações.

### Programa 2 — Comercial e conhecimento

7. CRM;
8. Modelos e documentos;
9. Parceiros.

### Programa 3 — Gestão do escritório

10. Financeiro;
11. Relatórios;
12. Configurações;
13. Conta e assinatura.

Cada item recebe especificação e plano próprios quando chegar sua vez. Uma tela
só avança para aceite depois de cumprir os critérios desta especificação.

## Arquitetura do produto

### Navegação global

O shell autenticado terá:

- menu lateral estável, agrupado por operação, relacionamento, conhecimento e
  administração;
- cabeçalho com busca universal, notificações, ação global `Adicionar`, perfil e
  assistente Jarvis;
- breadcrumbs e título contextual;
- criação rápida de tarefa, compromisso, contato, processo, documento e
  lançamento, reutilizando os formulários canônicos;
- preservação da rota e dos filtros ao retornar de uma ficha.

O menu cobrirá os módulos da referência e manterá os diferenciais do ADVeyes:
IA Jurídica, Jurisprudência, Audiências, WhatsApp, Documentos, Contratos, Horas e
Portal do Cliente. A visibilidade dependerá de plano e permissão, sem esconder
módulos do proprietário por erro de configuração.

### Componentes compartilhados

Serão reutilizáveis:

- barra de busca, filtros, ordenação, exportação e ações em lote;
- tabela responsiva e alternativa em cartões;
- Kanban e mudança de etapa acessível sem arrastar;
- indicadores, metas e comparativos por período;
- seletores de escritório, membro, cliente e processo;
- estados de carregamento, vazio, erro e nova tentativa;
- formulários e confirmações de exclusão;
- painel contextual e timeline jurídica;
- criação global e busca universal.

Páginas atualmente monolíticas serão divididas apenas nos trechos tocados pelo
programa. Refatorações sem relação direta ficam fora do escopo.

### Fichas unificadas

#### Processo

A ficha do processo reunirá:

- resumo técnico e resumo por IA;
- dados processuais, partes e responsáveis;
- timeline de andamentos oficiais e manuais;
- intimações e revisão de prazo;
- documentos, despachos e geração de peças;
- audiências, compromissos, tarefas e prazos;
- honorários, despesas, lançamentos e horas;
- comunicação e histórico de auditoria permitido;
- exportação de relatório completo.

#### Cliente ou contato

A ficha do contato reunirá:

- dados pessoais ou empresariais e origem;
- leads e histórico de relacionamento;
- processos, contratos e documentos;
- tarefas, compromissos e comunicações;
- financeiro, portal do cliente e histórico relevante.

Entidades públicas que aparecem como partes processuais não serão tratadas
automaticamente como clientes comerciais. O modelo distinguirá pessoa, empresa,
órgão, parte, cliente, lead e parceiro.

## Dados e segurança

### Fonte única

Supabase permanece como fonte de verdade. Cliente, parte, processo, atividade,
evento, documento, publicação, prazo e lançamento financeiro não terão cópias
independentes por tela. Visões e agregações podem materializar leitura, mas não
substituem o registro canônico.

Todas as entidades pertencentes a um escritório terão `tenant_id` compatível.
Relacionamentos entre entidades de escritórios diferentes serão rejeitados no
banco. RLS e grants continuam sendo a autoridade de acesso; filtros no frontend
não contam como segurança.

### Permissões e auditoria

- proprietário e administrador acessam a visão do escritório conforme o plano;
- colaboradores acessam os módulos e registros permitidos pela função;
- clientes acessam somente o recorte liberado no portal;
- mudanças críticas de responsável, status, prazo, valor, documento e permissão
  geram auditoria;
- suspensão de usuário preserva histórico;
- funções privilegiadas terão `search_path`, grants e escopo mínimos.

### Migrações

Alterações de esquema serão versionadas em migrações Supabase. Cada migração
deverá incluir índices, constraints, RLS, grants, testes SQL e atualização dos
tipos TypeScript quando aplicável. Mudanças destrutivas exigirão migração de
dados e estratégia explícita de reversão ou recuperação.

## Integrações jurídicas

DataJud, DJEN, Escavador e fontes complementares alimentarão um pipeline comum:

1. captura com identificação da fonte e horário;
2. validação e normalização;
3. deduplicação por identificadores jurídicos e assinatura do conteúdo;
4. vínculo ao escritório, OAB, processo e partes quando houver confiança;
5. registro de divergências e itens sem vínculo;
6. confirmação humana para efeitos jurídicos sensíveis;
7. notificação e atualização das telas relacionadas.

Cada integração exibirá estado, última execução, próxima tentativa, consumo,
limite e erro compreensível. Falhas transitórias serão reprocessáveis e não
apagarão o último dado válido.

## Inteligência e automação

A IA atuará somente sobre dados que o usuário possa acessar. As primeiras
capacidades transversais serão:

- resumo e explicação de processos e movimentações;
- detecção assistida de riscos, urgências e possíveis prazos;
- sugestão de tarefas, responsáveis e próximos passos;
- elaboração de minutas e peças com referências ao contexto usado;
- preparação de atendimento e comunicação;
- busca semântica no acervo autorizado.

Sugestões que criem prazo, tarefa, documento ou comunicação exigirão confirmação
humana. A interface distinguirá fato da fonte, inferência da IA e decisão humana.
Prompts, modelo, fonte, horário e decisão serão rastreáveis na medida necessária,
sem gravar conteúdo sensível além do indispensável.

Automações usarão eventos de domínio, como publicação recebida, prazo confirmado,
tarefa atrasada, lead convertido, pagamento vencido e documento inserido. Uma
automação deverá ser idempotente, observável e desativável por escritório.

## Comportamento das telas

Todas as listagens terão, quando pertinente:

- pesquisa rápida e filtros combináveis;
- ordenação e paginação reais;
- seleção e ações em lote;
- exportação com os filtros aplicados;
- visualização em tabela, cartões ou Kanban conforme o domínio;
- URLs ou estado persistido para filtros relevantes;
- painel contextual sem perda da posição da lista.

No celular, tabelas extensas viram cartões priorizados. Painéis laterais ocupam
a largura total. Toda ação por drag and drop terá alternativa por menu ou
teclado. Status nunca será comunicado apenas por cor.

## Fluxo de dados

1. A rota obtém usuário, escritório ativo, plano e permissões.
2. A camada de serviço consulta registros canônicos do escritório.
3. O banco aplica RLS, integridade e auditoria.
4. Hooks normalizam carregamento, erro, cache e invalidação.
5. A tela aplica filtros e apresenta o contexto permitido.
6. Mutações atualizam apenas os domínios afetados.
7. Eventos alimentam notificações, métricas e automações.
8. Atualizações em tempo real reconciliam a interface sem substituir a
   autoridade do banco.

## Tratamento de erros

- mensagens ao usuário serão compreensíveis e preservarão uma causa técnica útil;
- formulários permanecerão preenchidos após falha;
- mutações otimistas terão snapshot e rollback;
- exclusões só desaparecerão depois da confirmação do banco;
- operações em lote separarão sucessos e falhas;
- referências removidas aparecerão como indisponíveis, sem quebrar a ficha;
- integrações permitirão nova tentativa segura;
- telas preservarão o último dado válido durante indisponibilidades temporárias;
- erros inesperados serão correlacionáveis por identificador de diagnóstico.

## Qualidade e aceite

### Critério de conclusão por tela

Uma tela só está concluída quando:

- usa dados reais do domínio e do escritório ativo;
- cobre os comportamentos mapeados da tela correspondente da referência;
- explicita e implementa ao menos um ganho próprio do ADVeyes quando aplicável;
- respeita plano, função, permissão, RLS e vínculos entre tenants;
- funciona em desktop e celular;
- possui estados de carregamento, vazio, erro e nova tentativa;
- não duplica formulários ou registros canônicos;
- passa pelos testes proporcionais ao risco;
- é comparada visual e funcionalmente com a referência;
- não introduz regressão conhecida nas telas anteriores.

### Critério de paridade

Cada capacidade observada na referência deverá estar:

1. implementada no ADVeyes;
2. substituída por um fluxo comprovadamente equivalente ou melhor; ou
3. registrada como exclusão deliberada, com motivo aprovado.

Ausência silenciosa não será aceita como paridade.

### Critério de superioridade

O ADVeyes será considerado superior quando o mesmo trabalho exigir menos troca
de telas, preservar melhor o contexto jurídico, oferecer automações rastreáveis,
integrar fontes oficiais, permitir confirmação humana e manter segurança
multitenant verificável.

## Estratégia de testes

- testes unitários para regras de domínio, datas, filtros, métricas e
  normalização;
- testes de componentes para formulários, filtros, tabelas, Kanban, painéis e
  estados de erro;
- testes de serviços e hooks para consultas, invalidação, rollback e falhas;
- testes SQL para constraints, triggers, RLS, grants e isolamento entre tenants;
- testes de integração para pipelines jurídicos e automações idempotentes;
- fluxos autenticados de navegador em desktop e celular;
- comparação visual da tela entregue com a referência e com o design aprovado;
- `npm run test`, `npx tsc --noEmit`, `npm run build` e lint focado nos arquivos
  alterados.

Problemas preexistentes serão registrados separadamente. Nenhuma regressão nova
será classificada como preexistente.

## Implantação

A implantação será incremental. Rotas existentes e dados válidos serão
preservados. Mudanças de grande impacto usarão ativação controlada por escritório
quando necessário. Cada tela seguirá o ciclo:

1. inventário detalhado da referência e da implementação atual;
2. especificação da tela e critérios de aceite;
3. plano de implementação;
4. banco e serviços;
5. interface e responsividade;
6. testes e validação comparativa;
7. implantação controlada;
8. monitoramento e correções;
9. aceite antes da próxima tela.

## Fora do programa

- cópia de código, ativos, textos proprietários ou identidade visual da ADVBOX;
- acesso não autorizado a dados ou integrações de terceiros;
- decisões jurídicas autônomas sem confirmação humana;
- reescrita integral do ADVeyes;
- refatorações gerais que não contribuam diretamente para a tela em andamento;
- migração automática de dados de concorrentes sem projeto, autorização e
  validação específicos.

## Primeira especificação derivada

O primeiro ciclo derivado desta visão será `Meu Painel`. Ele consolidará
produtividade, tarefas pendentes e concluídas, prazos críticos, agenda,
intimações, indicadores processuais e financeiros, desempenho por responsável e
ações recomendadas. O planejamento do painel só começará depois da aprovação
final desta especificação de programa.
