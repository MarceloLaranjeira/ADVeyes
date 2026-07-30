# Conta geral e integração jurídica híbrida

## Objetivo

Criar a superfície administrativa geral da ADVeyes e substituir os dados
jurídicos fictícios por processos, movimentações e publicações reais,
preservando o isolamento entre escritórios. A descoberta inicial será feita por
OAB, o monitoramento pago só será ativado após confirmação do escritório e a
integração com caixas privadas do PJe será uma fase posterior.

## Decisões aprovadas

- Administradores da plataforma entram primeiro no painel geral da ADVeyes.
- A plataforma poderá ter outros administradores além do proprietário atual.
- Cada escritório permanece como tenant isolado e pode ser acessado pelo painel
  geral em modo explicitamente identificado.
- A arquitetura jurídica será híbrida:
  - Escavador para descoberta por OAB, monitoramento e callbacks;
  - DataJud para validação, enriquecimento e fallback de consultas públicas;
  - conectores autenticados do PJe em uma segunda fase.
- Ao cadastrar uma OAB, os processos reais são buscados automaticamente.
- Os resultados da busca entram como candidatos e não ativam cobrança de
  monitoramento.
- Proprietário ou administrador do escritório confirma quais processos deseja
  acompanhar.
- A documentação oficial vigente do Escavador é a fonte de verdade para rotas,
  parâmetros, autenticação, paginação e callbacks.

## Fontes oficiais

- Visão geral da API:
  <https://api.escavador.com/v2/docs/>
- Consulta de processos:
  <https://api.escavador.com/v2/docs/consulta-de-processos>
- Monitoramento de processos:
  <https://api.escavador.com/v2/docs/monitoramento-de-processos>
- Monitoramento de novos processos:
  <https://api.escavador.com/v2/docs/monitoramento-de-novos-processos>
- Callbacks:
  <https://api.escavador.com/v2/docs/callback>
- Respostas e estrutura de movimentações:
  <https://api.escavador.com/v2/docs/respostas>
- DataJud:
  <https://datajud-wiki.cnj.jus.br/api-publica/>

Antes de publicar qualquer integração, as rotas e os contratos serão novamente
conferidos nessas páginas. Exemplos antigos da API V1 não serão misturados com
endpoints V2.

## Diagnóstico atual

### Conta geral

A base já possui `platform_admins` e a função
`private.is_platform_admin(uuid)`. O usuário
`marcelolaranjeira33@gmail.com` já foi semeado como administrador da plataforma
e também como proprietário do tenant Albertino. O frontend, porém, não possui
rota ou layout de administração da plataforma e resolve o login diretamente
para o escritório.

### Escavador e DataJud

- O projeto novo não possui `ESCAVADOR_API_TOKEN` configurado nos segredos do
  Supabase.
- A função atual de busca por OAB contém uma rota V2 válida, mas ainda não
  implementa o fluxo completo de candidatos, confirmação e monitoramento.
- A função atual de publicações usa uma rota de diários que não aparece na
  documentação V2 vigente.
- A função atual do DataJud possui uma chave de fallback embutida no código.
  Chaves devem existir somente como segredos do ambiente.
- Movimentações do DataJud estão sendo convertidas em publicações. Uma
  movimentação pode representar publicação ou andamento, portanto os conceitos
  devem permanecer separados.
- Os conectores de tribunal existentes são consultas públicas e não acessam a
  caixa privada de intimações do PJe.

## Escopo

### Incluído

- Painel geral para administradores da plataforma.
- Lista, busca e acesso administrativo aos escritórios.
- Indicadores de escritórios, usuários, assinaturas, processos candidatos,
  processos monitorados, falhas de integração e consumo.
- Auditoria do acesso administrativo a tenants.
- Cadastro e normalização da OAB por advogado.
- Busca paginada de processos por OAB no Escavador.
- Validação e enriquecimento público via DataJud.
- Caixa de processos candidatos por advogado e escritório.
- Confirmação individual ou em lote antes de ativar monitoramento.
- Monitoramento diário ou semanal de processos confirmados.
- Recebimento idempotente de callbacks do Escavador.
- Separação entre movimentações, publicações e documentos públicos.
- Alertas e notificações vinculados ao tenant, processo e advogado.
- Controle de consumo por escritório e por integração.
- Ferramentas administrativas para reprocessar falhas sem duplicar registros.

### Não incluído nesta fase

- Caixa privada de intimações do PJe.
- Automação por certificado digital A1 ou A3.
- Peticionamento, assinatura ou protocolo no PJe.
- Consulta de processos em segredo de justiça sem autorização própria.
- Monitoramento automático pago de todos os processos encontrados.
- Mistura de dados entre escritórios quando o mesmo advogado participa de mais
  de um tenant.

## Experiência da conta geral

Após o login:

1. O sistema verifica `private.is_platform_admin(auth.uid())`.
2. Administradores da plataforma são direcionados para `/admin`.
3. Usuários comuns seguem para o tenant ativo.
4. O painel geral exibe os escritórios sem carregar dados jurídicos sensíveis
   até que um tenant seja selecionado.
5. Ao acessar um escritório, o cabeçalho mostra permanentemente
   `Administrando: <nome do escritório>` e oferece retorno ao painel geral.
6. Toda entrada, alteração ou reprocessamento administrativo gera auditoria com
   ator, tenant, ação e metadados.

O painel geral terá:

- visão geral;
- escritórios;
- assinaturas e consumo;
- integrações jurídicas;
- falhas e reprocessamentos;
- administradores da plataforma;
- auditoria.

Administradores da plataforma não se tornam automaticamente membros dos
escritórios. O acesso administrativo é uma capacidade separada e auditável.

## Fluxo jurídico

### 1. Cadastro do advogado

O perfil profissional continuará em `equipe`, vinculado à membership do tenant.
A OAB será normalizada em:

- número sem pontuação;
- UF em maiúsculas;
- tipo: `ADVOGADO`, `SUPLEMENTAR`, `ESTAGIARIO` ou
  `CONSULTOR_ESTRANGEIRO`;
- nome profissional para conferência.

O mesmo usuário poderá possuir inscrições diferentes, inclusive suplementares.
O modelo não usará apenas uma string livre de OAB como identificador.

### 2. Descoberta por OAB

A Edge Function de descoberta chama exclusivamente pelo servidor:

```http
GET https://api.escavador.com/api/v2/advogado/processos
Authorization: Bearer <ESCAVADOR_API_TOKEN>
Accept: application/json

oab_estado=<UF>
oab_numero=<NUMERO>
oab_tipo=<TIPO>
limit=100
```

Filtros opcionais como `tribunais`, `status`, `data_minima` e `data_maxima`
serão expostos somente quando necessários. A paginação seguirá os links ou
cursores retornados pela API, sem construir URLs não documentadas.

Cada item retornado será normalizado pelo número CNJ e salvo como candidato. A
resposta `advogado_encontrado` será usada para conferir nome, tipo e sociedade,
mas CPF não será exibido nem persistido sem necessidade jurídica definida.

### 3. Validação híbrida

Para cada candidato:

- o Escavador é a fonte de descoberta e dados normalizados;
- o DataJud consulta o tribunal compatível quando houver endpoint público;
- divergências não descartam automaticamente o processo;
- cada campo relevante mantém `source`, `fetched_at` e confiança operacional;
- ausência no DataJud não significa que o processo do Escavador é inválido;
- falhas temporárias entram em fila de nova tentativa.

O DataJud nunca será tratado como caixa de intimações e não substituirá
callbacks do monitoramento.

### 4. Confirmação

O escritório verá, por advogado:

- número CNJ;
- partes;
- tribunal e unidade;
- status;
- última movimentação conhecida;
- fonte e data da consulta;
- indicação de possível duplicidade;
- estimativa de impacto no limite do plano.

Somente `owner` ou `admin` pode confirmar em lote. Advogados podem confirmar
processos associados a si quando a política do plano permitir. A confirmação:

1. cria ou vincula o processo canônico no tenant;
2. relaciona o processo ao advogado;
3. cria uma solicitação idempotente de monitoramento;
4. registra auditoria e consumo estimado.

### 5. Monitoramento

Após a confirmação, o backend chama:

```http
POST https://api.escavador.com/api/v2/monitoramentos/processos
Authorization: Bearer <ESCAVADOR_API_TOKEN>
Accept: application/json
Content-Type: application/json

{
  "numero": "<NUMERO_CNJ>",
  "frequencia": "DIARIA",
  "documentos_publicos": true
}
```

`tribunal` será enviado apenas quando houver uma razão explícita para acompanhar
uma instância diferente da origem. O ID retornado pelo Escavador será persistido
com status `PENDENTE`, `ENCONTRADO` ou `NAO_ENCONTRADO`.

O monitoramento de novos processos por nome ou CPF não será ativado
automaticamente na primeira entrega. Ele pode gerar falsos positivos. A rota
`POST /api/v2/monitoramentos/novos-processos` ficará disponível futuramente
como recurso opt-in com termos auxiliares, tribunais e limite mensal.

### 6. Callbacks

Uma Edge Function pública e dedicada, `escavador-webhook`, receberá:

- `nova_movimentacao`;
- `novo_documento`;
- `processo_verificado`;
- `processo_encontrado`;
- `processo_nao_encontrado`;
- futuramente `novo_processo`.

O callback:

1. valida o token configurado no painel do Escavador;
2. rejeita payload ausente, inválido ou excessivo;
3. identifica o monitoramento e o tenant sem confiar em tenant informado pelo
   remetente;
4. calcula uma chave de idempotência com evento, item e identificador externo;
5. persiste o payload bruto em área restrita;
6. normaliza processo, movimentação, publicação ou documento;
7. cria notificação somente depois da transação;
8. responde rapidamente e delega enriquecimento pesado para fila;
9. registra tentativas e permite reprocessamento seguro.

Uma movimentação com tipo `PUBLICAÇÃO` será persistida também como publicação.
Outros tipos permanecem somente como movimentação. O texto original será
preservado; versões simplificadas por IA serão derivadas e claramente
identificadas.

## Modelo de dados

### Estruturas existentes preservadas

- `platform_admins`: administradores da ADVeyes.
- `tenants`: escritórios.
- `tenant_memberships`: autorização no escritório.
- `equipe`: perfil profissional.
- `processos`: processo canônico do tenant.
- `processo_monitoramento`: base de monitoramento.
- `publicacoes`: publicações judiciais.
- `notificacoes`: alertas aos usuários.
- `tenant_audit_events`: auditoria.

### Estruturas a adicionar ou endurecer

- `lawyer_registrations`
  - tenant, perfil profissional, número, UF, tipo, status e data de validação;
- `process_discoveries`
  - tenant, inscrição, número CNJ, fonte, snapshot normalizado e estado
    `candidate`, `confirmed`, `ignored` ou `conflict`;
- `process_lawyers`
  - relação muitos-para-muitos entre processo e profissionais;
- `legal_provider_monitors`
  - tenant, processo, provedor, ID externo, frequência, status e datas;
- `process_movements`
  - movimentações normalizadas e deduplicadas;
- `legal_provider_events`
  - payload bruto restrito, chave idempotente, estado e erro;
- `legal_usage_events`
  - consumo por tenant, operação, provedor e competência.

As tabelas legadas serão migradas sem apagar dados. `tenant_id` passará a ser
obrigatório nas novas escritas. O número CNJ terá normalização e unicidade por
tenant, não global, porque o mesmo processo pode pertencer a escritórios
diferentes.

## Edge Functions

- `platform-admin`: consultas e ações do painel geral.
- `legal-discover-lawyer-processes`: busca paginada por OAB.
- `legal-confirm-processes`: confirma candidatos e agenda monitoramentos.
- `legal-monitor-process`: cria ou atualiza monitoramento idempotente.
- `escavador-webhook`: recebe e valida callbacks.
- `legal-reconcile-process`: reconcilia Escavador, DataJud e banco.
- `legal-reprocess-event`: reprocessa evento com falha.

As funções atuais `busca-oab` e `capturar-publicacoes` serão substituídas
gradualmente ou transformadas em wrappers compatíveis. Nenhuma rota antiga será
mantida apenas para esconder uma falha.

## Segredos

Os seguintes segredos serão obrigatórios no Supabase:

- `ESCAVADOR_API_TOKEN`;
- `ESCAVADOR_CALLBACK_TOKEN`;
- `DATAJUD_API_KEY`, caso o CNJ exija chave distinta da pública vigente;
- `APP_URL`.

Regras:

- nenhum token no frontend;
- nenhuma chave de fallback no repositório;
- rotação sem recompilar o frontend;
- logs nunca imprimem tokens, CPF completo ou credenciais;
- ambiente de teste usa token e callback próprios quando disponibilizados.

## Segurança e isolamento

- RLS por `tenant_id` em todas as tabelas jurídicas.
- Administrador da plataforma acessa funções privilegiadas, não políticas
  abertas para `authenticated`.
- Usuário de um escritório nunca descobre se outro tenant monitora o mesmo
  processo.
- Payload bruto de callback não é legível pelo cliente.
- `service_role` existe apenas no backend.
- CPF e dados restritos são minimizados e mascarados.
- Acesso administrativo a tenant exige motivo e gera auditoria.
- Toda operação paga exige autorização e verificação de limite.
- O callback não aceita `tenant_id` como autoridade.
- Eventos externos são idempotentes e tolerantes a reenvio.

## Limites, planos e custo

- Descoberta e monitoramento serão medidos separadamente.
- O catálogo de planos definirá:
  - OABs ativas;
  - buscas completas por mês;
  - processos monitorados;
  - frequência diária ou semanal;
  - documentos públicos;
  - retenção de histórico.
- A interface mostra uso atual e efeito antes da confirmação em lote.
- Ao atingir o limite, candidatos continuam visíveis, mas novos monitoramentos
  ficam bloqueados até upgrade ou liberação administrativa.
- Remover um processo do monitoramento não apaga seu histórico.
- Erros `402` do Escavador são exibidos como falta de saldo da integração, não
  como “processo não encontrado”.

## Estados e tratamento de erros

- `401`: token inválido ou expirado; bloquear novas chamadas e alertar a conta
  geral.
- `402`: saldo insuficiente; preservar fila e pedir ação administrativa.
- `404`: diferenciar recurso inexistente de processo ainda não encontrado.
- `429`: aplicar retry com backoff e jitter.
- `5xx` ou timeout: retry limitado e fila de falhas.
- callback duplicado: responder sucesso sem duplicar movimentação.
- callback sem monitor conhecido: quarentena para análise.
- processo repetido em duas OABs do mesmo tenant: um processo, dois vínculos.
- processo repetido em tenants diferentes: registros isolados.
- divergência Escavador/DataJud: marcar para revisão, sem sobrescrever
  silenciosamente.
- monitoramento `NAO_ENCONTRADO`: manter candidato e permitir nova tentativa.

## Testes

### Banco e RLS

- administrador da plataforma usa apenas operações autorizadas e auditadas;
- tenant não acessa dados jurídicos de outro tenant;
- número CNJ único por tenant;
- mesmo CNJ permitido em tenants diferentes;
- callback não consegue escolher o tenant;
- vínculo muitos-para-muitos entre processo e advogados.

### Contratos externos

- fixtures sanitizadas das respostas oficiais do Escavador;
- paginação de busca por OAB;
- `401`, `402`, `404`, `429` e `5xx`;
- criação idempotente de monitoramento;
- callbacks repetidos e fora de ordem;
- distinção entre movimentação, publicação e documento;
- resposta divergente ou ausente do DataJud.

### Frontend

- redirecionamento de administrador para `/admin`;
- seleção e saída de escritório;
- aviso permanente de contexto administrativo;
- candidatos por advogado;
- confirmação individual e em lote;
- estimativa de limite;
- estados vazio, carregando, parcial, erro e sucesso;
- consumo e falhas no painel geral.

### Fluxo completo

O critério de conclusão da primeira fase é:

1. cadastrar uma OAB real no tenant de teste;
2. receber processos reais como candidatos;
3. confirmar um processo sem duplicidade;
4. ativar o monitoramento no Escavador;
5. receber um callback autenticado;
6. persistir a movimentação/publicação no tenant correto;
7. notificar somente os membros autorizados;
8. visualizar consumo e auditoria na conta geral.

## Implantação

1. Remover chave DataJud embutida e preparar segredos.
2. Criar migrations e testes RLS.
3. Implementar painel geral sem alterar o fluxo dos usuários comuns.
4. Implementar descoberta por OAB em ambiente de teste.
5. Validar resposta real do Escavador com uma OAB autorizada.
6. Implementar candidatos e confirmação.
7. Criar callback público, token e testes idempotentes.
8. Ativar um único processo piloto do escritório Albertino.
9. Confirmar movimentações, publicações, consumo e auditoria.
10. Liberar gradualmente para outros processos e escritórios.
11. Planejar separadamente a fase PJe privado e certificados.

Nenhuma cobrança ou monitoramento real será criado durante testes sem
confirmação explícita do responsável pelo escritório.

