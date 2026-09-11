# ADVeyes — release operacional, API pública e integrações jurídicas

Data: 31 de agosto de 2026  
Status: aprovado

## Objetivo

Colocar o ADVeyes em produção com um núcleo operacional confiável e uma API
versionada para integrações server-to-server. A release consolida o sistema
existente em vez de reescrevê-lo e usa o blueprint funcional da ADVBOX como
referência de comportamento, sem copiar código, marca ou identidade visual de
terceiros.

O aceite desta release exige:

- login, isolamento por escritório e navegação autenticada operacionais;
- Painel, Contatos, Processos, Tarefas, Agenda e Intimações utilizáveis de ponta
  a ponta;
- API `/api/v1` de leitura e escrita para contatos, processos e tarefas;
- tokens por escritório, idempotência, auditoria e webhooks assinados;
- documentação OpenAPI com exemplos executáveis;
- implantação no Vercel e no Supabase de produção já configurados;
- smoke test autenticado e webhook de teste entregue em produção.

## Contexto e restrições

O repositório já possui React, Vite, Supabase, multitenancy, RLS, integrações
jurídicas, DataJud, DJEN, Escavador, Google Calendar, Asaas e uma suíte ampla de
testes. As alterações locais existentes são consideradas trabalho válido e
farão parte da release; não devem ser descartadas nem sobrescritas.

A entrega de hoje não busca implementar integralmente todos os módulos do
blueprint. CRM, Financeiro, Relatórios, Documentos, Parceiros, Biblioteca,
Workflow e Conta continuam existentes quando já disponíveis, mas não são
critério de conclusão deste ciclo. Não haverá migração destrutiva, banco
paralelo ou exposição direta do PostgREST para parceiros.

## Decisão arquitetural

A aplicação continuará dividida em três fronteiras:

1. a interface React/Vercel para usuários autenticados;
2. Edge Functions Supabase para a API pública, integrações e trabalhos
   assíncronos;
3. o PostgreSQL do Supabase como fonte canônica de dados, autorização e
   auditoria.

Sistemas parceiros chamarão um gateway `/api/v1`. O gateway resolverá o
`tenant_id` exclusivamente pelo token, validará escopos e entrada, executará a
operação no domínio canônico e registrará a auditoria. O consumidor não poderá
escolher ou sobrescrever o escritório por parâmetro.

Eventos persistidos na mesma transação lógica da mudança alimentarão uma outbox.
Um worker enviará webhooks assinados aos parceiros sem bloquear a gravação
principal.

## Núcleo operacional da interface

### Shell global

O shell autenticado terá menu lateral estável, cabeçalho com busca global,
notificações, criação rápida e perfil. A criação rápida reutilizará os
formulários canônicos de contato, processo e tarefa. O retorno de uma ficha
preservará rota, filtros e posição relevante da listagem.

### Módulos de aceite

- **Painel:** indicadores operacionais, tarefas pendentes e atrasadas,
  compromissos, prazos críticos, processos recentes e ações recomendadas.
- **Contatos:** criação rápida, edição, pesquisa, vínculos e isolamento por
  escritório.
- **Processos:** listagem, filtros, cadastro, ficha única, partes, movimentos,
  publicações e tarefas relacionadas.
- **Tarefas:** lista, Kanban, calendário, responsáveis, prioridade, prazo
  interno, prazo fatal e conclusão.
- **Agenda:** visões temporalmente coerentes e escolha explícita entre data do
  compromisso e prazo fatal.
- **Intimações:** publicações capturadas, vínculo ao processo, situação de
  tratamento e criação de tarefa com confirmação humana.

Toda tela do núcleo terá carregamento, vazio, erro, nova tentativa e comportamento
responsivo. Status não dependerá somente de cor. Exclusão de registros expostos
pela API será lógica quando o domínio suportar exclusão.

## Contrato da API pública

### Convenções

- URL base: `/api/v1`.
- Autenticação: `Authorization: Bearer adv_live_<prefixo>_<segredo>`.
- Conteúdo: JSON UTF-8.
- Nomes externos: inglês e `snake_case`, desacoplados dos nomes legados do
  banco.
- Datas e horários: ISO 8601 em UTC.
- Valores monetários: inteiros na menor unidade monetária quando surgirem em
  versões futuras.
- Paginação: cursor opaco com `limit` padrão 50 e máximo 100.
- Ordenação e filtros: lista fechada documentada por recurso.
- Resposta de sucesso: `data` e, em listas, `meta.next_cursor`.
- Toda resposta inclui `X-Request-Id`.
- Erros seguem `application/problem+json`, compatível com RFC 9457.

### Recursos da versão 1

| Método | Rota | Escopo | Comportamento |
|---|---|---|---|
| GET | `/contacts` | `contacts:read` | Lista contatos do escritório do token |
| POST | `/contacts` | `contacts:write` | Cria contato |
| GET | `/contacts/{id}` | `contacts:read` | Obtém contato |
| PATCH | `/contacts/{id}` | `contacts:write` | Atualiza campos permitidos |
| DELETE | `/contacts/{id}` | `contacts:write` | Exclusão lógica |
| GET | `/processes` | `processes:read` | Lista processos |
| POST | `/processes` | `processes:write` | Cria processo |
| GET | `/processes/{id}` | `processes:read` | Obtém processo e vínculos básicos |
| PATCH | `/processes/{id}` | `processes:write` | Atualiza campos permitidos |
| DELETE | `/processes/{id}` | `processes:write` | Exclusão lógica |
| GET | `/tasks` | `tasks:read` | Lista tarefas |
| POST | `/tasks` | `tasks:write` | Cria tarefa |
| GET | `/tasks/{id}` | `tasks:read` | Obtém tarefa |
| PATCH | `/tasks/{id}` | `tasks:write` | Atualiza tarefa ou conclusão |
| DELETE | `/tasks/{id}` | `tasks:write` | Exclusão lógica |
| GET | `/webhook-endpoints` | `webhooks:manage` | Lista destinos do token |
| POST | `/webhook-endpoints` | `webhooks:manage` | Cria destino e segredo |
| PATCH | `/webhook-endpoints/{id}` | `webhooks:manage` | Altera eventos ou situação |
| DELETE | `/webhook-endpoints/{id}` | `webhooks:manage` | Desativa o destino |

`POST`, `PATCH` e `DELETE` exigirão `Idempotency-Key`. A chave será única por
token, método e rota por 24 horas. Repetir a mesma chave com o mesmo corpo
reproduzirá a resposta original; repetir com corpo diferente retornará `409`.

Campos imutáveis, relacionamentos entre tenants e referências inexistentes
retornarão erros distintos. A API não aceitará `tenant_id`, `user_id` arbitrário
ou campos internos de auditoria no corpo.

### Tokens e escopos

Somente proprietário ou administrador autorizado poderá criar tokens. O segredo
será exibido uma única vez; o banco armazenará hash forte, prefixo, nome,
`tenant_id`, escopos, criação, expiração, último uso e revogação. Logs nunca
conterão o segredo completo.

Os escopos iniciais serão:

- `contacts:read` e `contacts:write`;
- `processes:read` e `processes:write`;
- `tasks:read` e `tasks:write`;
- `webhooks:manage`.

Tokens terão expiração obrigatória, com máximo inicial de 365 dias. Revogação
terá efeito imediato. Limites serão aplicados por token e escritório; uma
resposta `429` informará `Retry-After`.

## Eventos e webhooks

Eventos iniciais:

- `contact.created`, `contact.updated`, `contact.deleted`;
- `process.created`, `process.updated`, `process.deleted`;
- `task.created`, `task.updated`, `task.completed`, `task.deleted`.

Cada entrega conterá `id`, `type`, `occurred_at`, `tenant_reference`, `data` e
`api_version`. A referência externa do tenant será opaca e não dará acesso a
outro escritório.

O corpo bruto será assinado com HMAC-SHA256. Os headers incluirão identificador,
horário e assinatura. O consumidor deverá rejeitar timestamps antigos e manter
deduplicação pelo identificador do evento.

Tentativas ocorrerão imediatamente e depois de 1 minuto, 5 minutos, 30 minutos,
2 horas e 12 horas. Respostas `2xx` concluem a entrega. `408`, `409`, `425`,
`429` e `5xx` são repetíveis; outros `4xx` encerram a entrega. Após o limite, a
entrega ficará disponível para reprocessamento administrativo.

## Persistência de suporte

O inventário final do schema reutilizará tabelas equivalentes que já existam e
criará por migrations aditivas as estruturas ausentes abaixo:

- `api_tokens` para hashes, escopos e ciclo de vida;
- `api_idempotency_keys` para respostas reproduzíveis;
- `api_request_logs` para auditoria técnica sem conteúdo sensível desnecessário;
- `domain_events` para eventos canônicos;
- `webhook_endpoints` para destinos e eventos selecionados;
- `webhook_deliveries` para outbox, tentativas e diagnóstico;
- campos `deleted_at` ausentes nos três domínios expostos.

Todas as tabelas terão `tenant_id`, constraints, índices, RLS, grants mínimos e
testes SQL. Cada endpoint de webhook receberá um segredo aleatório de 32 bytes,
exibido uma única vez e persistido como ciphertext autenticado com a secret
`WEBHOOK_SECRET_ENCRYPTION_KEY`; a chave e o texto puro nunca serão gravados em
colunas acessíveis ao cliente. Edge Functions usarão service role apenas depois
de autenticar o token e fixar o tenant.

## Integrações jurídicas com controle de custo

### Ordem de provedores

1. **DataJud:** fonte oficial e gratuita para metadados e movimentos públicos.
2. **DJEN:** fonte oficial e gratuita para comunicações e publicações.
3. **JUDIT:** fallback comercial nacional para consulta atualizada,
   monitoramento, webhook ou dados que a fonte oficial não entregue.
4. **TrackJud/Vigilant:** rota econômica para consultas compatíveis com a
   cobertura e os parâmetros efetivamente disponíveis.
5. **Escavador:** último fallback e recursos exclusivos ainda necessários.

A ordem não representa uma cadeia cega. Cada capacidade terá uma matriz de
cobertura. TrackJud não será chamado para uma operação que ainda esteja apenas
em seu roadmap; JUDIT e Escavador não serão chamados juntos sem motivo
registrado.

### Roteamento e normalização

Cada adaptador implementará capacidades declaradas, como `process_by_cnj`,
`processes_by_oab`, `processes_by_document`, `movements`, `publications`,
`documents` e `monitoring`. O roteador escolherá a primeira fonte saudável e
compatível com tribunal, operação, frescor e orçamento.

Toda execução registrará provedor, capacidade, tenant, latência, resultado,
custo estimado, motivo do fallback e correlação. Respostas serão normalizadas
para o modelo jurídico comum e deduplicadas antes da ingestão. Falhas transitórias
usarão backoff e circuit breaker. Limites mensais por tenant impedirão consumo
surpresa.

Credenciais de JUDIT, TrackJud e Escavador ficarão no Supabase Vault ou em
secrets de Edge Functions, nunca no frontend. JUDIT e TrackJud permanecerão
desativados em produção até existirem chave, aceite contratual e teste de
homologação.

### Avaliação de custo em 31 de agosto de 2026

- DataJud e DJEN são as fontes gratuitas prioritárias.
- A JUDIT publica simulação de R$ 0,25 por consulta processual por CNJ e R$ 1,50
  por processo monitorado ao mês; condições mínimas e pré-pago devem ser
  confirmados comercialmente.
- A TrackJud publica R$ 0,10 por tribunal consultado, sem mensalidade, mas com
  cobertura mais limitada e capacidades ainda em evolução.
- A Codilo declara cobertura e callbacks, mas não publica preço; só entrará após
  cotação e teste comparável.
- O Escavador informa preços da API apenas no painel autenticado. Não será
  declarado mais caro ou barato sem comparar a fatura e o mesmo volume.

## Conecta e ferramentas de IA do Judiciário

LexIA, Hannah, OMNIA e LIA3R foram disponibilizadas pelo Programa Conecta para
tribunais, magistrados e servidores. Não foi identificada documentação pública
que autorize um SaaS privado a consumir essas quatro ferramentas diretamente.

O ADVeyes terá uma interface de adaptador `judiciary_ai_provider`, mas nenhum
conector será ativado ou simulará integração inexistente. A ativação dependerá
de documentação, endpoint, credenciais, ambiente de homologação e autorização
formal do CNJ ou do tribunal responsável.

Enquanto isso, capacidades equivalentes poderão ser oferecidas com infraestrutura
própria:

- LexIA e LIA3R: resumo, pesquisa, análise documental e minutas;
- Hannah: checklist assistido de admissibilidade recursal;
- OMNIA: produtividade, congestionamento e priorização do acervo.

Resultados de IA distinguirão fonte, inferência e decisão humana. Criação de
prazo, protocolo, peça ou comunicação exigirá confirmação humana. Logs registrarão
modelo, versão, fontes, horário e decisão sem persistir conteúdo sensível além
do necessário.

## Fluxos de dados

### Requisição externa

1. O parceiro envia token, corpo e `Idempotency-Key`.
2. O gateway gera `request_id`, valida token, expiração, escopo e limite.
3. O tenant é fixado a partir do token.
4. O corpo é validado e traduzido para o domínio canônico.
5. O banco aplica constraints e registra auditoria e evento.
6. A API persiste a resposta idempotente e responde ao parceiro.
7. O worker entrega webhooks fora da transação do usuário.

### Atualização jurídica

1. Uma fonte monitorada entra na fila.
2. O roteador identifica capacidade, tribunal, orçamento e saúde.
3. DataJud ou DJEN é consultado quando compatível.
4. Uma lacuna justificável aciona apenas um fallback pago.
5. A resposta é normalizada, deduplicada e vinculada ao tenant.
6. Efeitos jurídicos sensíveis aguardam confirmação humana.
7. Métricas e custo alimentam a observabilidade administrativa.

## Tratamento de erros

- validações retornam ponteiros claros para os campos inválidos;
- formulários preservam o conteúdo após falha;
- `401` diferencia token ausente ou inválido sem revelar sua existência;
- `403` indica escopo insuficiente;
- `404` não revela registros de outro tenant;
- `409` cobre idempotência conflitante e constraints de domínio;
- `422` cobre conteúdo semanticamente inválido;
- `429` informa nova tentativa;
- `5xx` inclui `request_id` e não expõe stack trace;
- falha de webhook nunca desfaz a alteração principal;
- indisponibilidade de provedor preserva o último dado válido;
- fallback pago exige motivo observável e respeita orçamento;
- operações em lote futuras separarão sucessos e falhas.

## Segurança e governança

- RLS e constraints continuam sendo a autoridade de isolamento;
- service role não será aceito como credencial pública;
- payloads e logs serão minimizados conforme LGPD e sigilo profissional;
- endpoints terão CORS restrito às necessidades server-to-server;
- segredos serão rotacionáveis e nunca enviados a ferramentas de analytics;
- auditoria cobrirá token, ator técnico, tenant, ação, alvo, horário e resultado;
- dados de processos sigilosos não serão enviados a provedor sem base jurídica,
  contrato e configuração explícita;
- IA será assistiva, revisável e rastreável.

## Documentação da integração

A release entregará:

- `docs/api/openapi.yaml` como contrato canônico;
- interface navegável em `/api/docs`;
- `docs/api/getting-started.md` com autenticação e primeira chamada;
- `docs/api/webhooks.md` com assinatura, retentativa e deduplicação;
- exemplos em cURL e JavaScript;
- coleção de requisições derivada do OpenAPI;
- changelog e política de versionamento.

Exemplos serão executados contra um tenant de homologação sem dados reais de
clientes. A documentação não conterá secrets ou identificadores privados.

## Estratégia de testes

### Banco e segurança

- token válido, expirado, revogado e com escopo insuficiente;
- impossibilidade de acessar ou relacionar registros de outro tenant;
- constraints, RLS, grants e soft delete;
- unicidade e conflito de idempotência;
- outbox criada uma vez por alteração.

### API e webhooks

- contrato OpenAPI validado contra rotas reais;
- CRUD, filtros, cursores, limites e erros de cada recurso;
- repetição idempotente com corpo igual e diferente;
- assinatura HMAC e proteção contra replay;
- política de repetição e reprocessamento;
- `request_id` presente em sucesso e erro.

### Integrações jurídicas

- roteamento por capacidade e cobertura;
- fonte oficial prioritária;
- apenas um fallback pago por tentativa;
- circuit breaker, timeout, rate limit e limite de custo;
- normalização e deduplicação entre provedores;
- nenhum conector Conecta ativo sem autorização.

### Produto e release

- testes unitários e de componentes proporcionais aos arquivos alterados;
- testes SQL das migrations;
- smoke test autenticado em desktop e celular;
- criar e editar contato, processo e tarefa;
- visualizar tarefa na Agenda e tratar Intimação;
- `npm run test`, `npx tsc --noEmit`, `npm run build` e lint focado;
- teste externo real de uma chamada da API e um webhook.

## Implantação e reversão

1. Inventariar secrets e migrations aplicadas no Supabase de produção.
2. Criar backup ou ponto de recuperação compatível com as mudanças.
3. Aplicar migrations aditivas e executar testes SQL.
4. Publicar Edge Functions e validar o contrato em homologação técnica.
5. Gerar o build e promover o deployment na Vercel.
6. Executar smoke test autenticado em produção.
7. Ativar a API gradualmente, começando por um token de teste.
8. Ativar provedores pagos somente depois de credenciais e teste controlado.

A API terá feature flag de emergência. Tokens poderão ser revogados
imediatamente. A interface poderá retornar ao deployment Vercel anterior e as
Edge Functions serão versionadas. Como as migrations são aditivas, a reversão
de aplicação não dependerá de apagar dados ou colunas.

## Critérios de aceite

A release estará concluída quando:

- o build publicado carregar e autenticar no tenant correto;
- os seis módulos do núcleo passarem pelo smoke test;
- isolamento e permissões forem comprovados por testes;
- os endpoints documentados responderem conforme o OpenAPI;
- idempotência impedir duplicação em uma repetição real;
- um webhook assinado for entregue e validado;
- documentação estiver acessível sem expor segredos;
- métricas mostrarem erros e correlação por `request_id`;
- nenhuma regressão nova conhecida permanecer no núcleo;
- provedores não autorizados ou sem credencial permanecerem desativados.

## Fora do escopo desta release

- paridade integral de todos os módulos do blueprint;
- OAuth para aplicações frontend ou mobile de terceiros;
- API pública de Financeiro, Documentos, Relatórios ou administração;
- importação de dados privados de concorrentes;
- uso direto de LexIA, Hannah, OMNIA ou LIA3R sem autorização;
- scraper próprio de todos os tribunais;
- migração destrutiva ou reescrita completa do frontend;
- decisões jurídicas autônomas por IA.

## Referências verificadas

- Blueprint funcional fornecido em `C:\Users\marce\Downloads\advbox-blueprint.md`.
- [API Pública do DataJud](https://www.cnj.jus.br/sistemas/datajud/api-publica/).
- [Programa Conecta](https://www.cnj.jus.br/tecnologia-da-informacao-e-comunicacao/justica-4-0/conheca-o-conecta/).
- [Quatro soluções nacionalizadas pelo Conecta](https://www.cnj.jus.br/conecta-lanca-quatro-novas-solucoes-tecnologicas-no-6o-festlabs-nacional/).
- [Resolução CNJ nº 615/2025](https://atos.cnj.jus.br/atos/detalhar/6001).
- [Documentação da JUDIT API](https://docs.judit.io/introduction/introduction).
- [Calculadora de preços da JUDIT API](https://judit.io/calculadora-api/).
- [TrackJud/Vigilant](https://www.trackjud.com.br/).
- [Documentação do Escavador](https://api.escavador.com/docs).
