# Plano de implementação — cadastro, onboarding e ativação OAB/DJEN

Data: 8 de agosto de 2026

Especificação de referência:
`docs/superpowers/specs/2026-08-08-cadastro-onboarding-oab-djen-design.md`

## Estratégia

Implementar em cinco entregas verticais. Cada entrega deve terminar com banco,
tipos, interface e testes coerentes. O cadastro autônomo só será exposto na landing
quando provisionamento, retomada e isolamento multitenant estiverem validados em
preview.

Não criar uma segunda integração jurídica. O onboarding deve reutilizar
`lawyer_registrations`, `legal-discover-lawyer-processes`, `legal_sync_sources`,
`legal-reconcile`, `publicacoes`, `notificacoes` e `tarefas` já existentes.

## Preparação

### Tarefa 0 — Confirmar linha de base e documentação atual

Arquivos e comandos:

- `package.json`
- `supabase/config.toml`
- `.env.example`
- migrations e tipos atuais

Passos:

1. Ler o changelog recente do Supabase e pesquisar na documentação oficial os fluxos
   atuais de `signUp`, OAuth, redirect URLs, confirmação de e-mail, Edge Functions e
   funções RPC.
2. Rodar `npx supabase --version` e descobrir a sintaxe necessária com `--help`.
3. Confirmar alinhamento de migrations locais/remotas com
   `npx supabase migration list --linked`.
4. Registrar a linha de base do Advisor de segurança e performance.
5. Rodar `npm run test`, `npx tsc --noEmit` e `npm run build`.
6. Verificar as URLs permitidas de redirect no Supabase para produção e preview.
7. Confirmar que o catálogo possui a versão ativa mais recente do plano `solo`,
   usada como base do piloto; falhar explicitamente se ela não existir.

Verificação:

- migrations alinhadas;
- nenhuma alteração local não relacionada incluída;
- linha de base de testes e Advisor documentada;
- URLs de callback compatíveis com Google e confirmação de e-mail.

## Entrega 1 — Provisionamento autônomo seguro

### Tarefa 1 — Criar domínio de onboarding e idempotência

Criar uma migration com:

`npx supabase migration new self_service_signup_onboarding`

Adicionar `public.tenant_onboarding`:

- `tenant_id uuid primary key` com FK para `public.tenants`;
- `flow_version integer not null default 1`;
- `current_step text not null`;
- `office_completed_at timestamptz`;
- `oab_completed_at timestamptz`;
- `team_completed_at timestamptz`;
- `skipped_at timestamptz`;
- `completed_at timestamptz`;
- `created_at` e `updated_at`;
- checks que limitem estados e preservem ordem coerente;
- RLS para membros ativos do tenant;
- atualização somente para owner/admin neste ciclo;
- grants explícitos para `authenticated` e `service_role`.

Adicionar `private.tenant_signup_provisioning`:

- `user_id uuid primary key`;
- `request_id uuid not null unique`;
- `tenant_id uuid not null unique`;
- `created_at timestamptz not null default now()`;
- sem exposição à Data API e sem grants a `anon`/`authenticated`.

Essa tabela torna a criação repetida ou concorrente idempotente e limita o fluxo
self-service a um escritório por usuário. Criação de escritórios adicionais fica fora
deste ciclo.

### Tarefa 2 — Criar função transacional de provisionamento

Na mesma migration, criar
`public.provision_self_service_tenant(p_user_id uuid, p_request_id uuid, p_display_name text)`.

Requisitos:

- `SECURITY DEFINER` somente porque a operação insere em tabelas administrativas;
- `search_path` fixo e nomes totalmente qualificados;
- `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`;
- `EXECUTE` concedido somente a `service_role`;
- `p_user_id` deve existir em `auth.users` e possuir e-mail confirmado ou identidade
  OAuth válida;
- bloquear a transação por usuário para impedir corrida;
- rejeitar usuário com membership ativa ou convite pendente incompatível;
- normalizar `display_name` e gerar slug estável com sufixo em colisão;
- criar tenant `trialing` com janela de 14 dias;
- criar membership `owner`, `active`, escopo `tenant`;
- criar marca padrão ADVeyes;
- localizar a versão ativa mais recente do plano `solo` e criar
  `tenant_subscriptions` `trialing`;
- criar `tenant_onboarding` na etapa OAB;
- registrar auditoria sem dados sensíveis;
- criar/reutilizar `private.tenant_signup_provisioning` e retornar o mesmo tenant em
  chamadas repetidas.

Não atualizar o modelo legado `asaas_subscriptions` no novo fluxo. O tenant e
`tenant_subscriptions` são a fonte aprovada para contas novas.

### Tarefa 3 — Testes SQL do provisionamento

Criar `supabase/tests/self_service_signup_onboarding.sql` cobrindo:

- provisionamento cria exatamente um tenant, owner, marca, piloto e onboarding;
- piloto termina 14 dias após o início;
- repetição com o mesmo ou outro `request_id` retorna o mesmo tenant;
- tentativas concorrentes não duplicam;
- usuário inexistente, não confirmado ou já vinculado é rejeitado;
- falha de plano provoca rollback integral;
- `anon` e `authenticated` não executam a função;
- tenant A não lê nem altera onboarding do tenant B;
- membro comum não altera estado administrativo;
- owner pode atualizar somente seu tenant.

### Tarefa 4 — Edge Function de provisionamento

Criar:

- `supabase/functions/tenant-self-signup/index.ts`
- `supabase/functions/tenant-self-signup/index.test.ts`
- atualizar `supabase/config.toml`

Fluxo:

1. aceitar somente `POST` e contrato validado;
2. validar JWT chamando `auth.getUser()` no servidor;
3. aplicar limite de corpo e rate limit compatível com a infraestrutura disponível;
4. gerar ou validar `requestId` UUID;
5. chamar a RPC privilegiada com cliente `service_role` e o ID validado;
6. devolver apenas tenant, slug, trial e próximo passo;
7. mapear erros internos para códigos estáveis sem revelar existência de outros
   tenants, usuários ou slugs.

Testar CORS, método, JWT ausente/inválido, payload, sucesso, repetição e falha segura.

### Tarefa 5 — Aplicar e verificar a entrega 1

1. Rodar Advisor antes da aplicação.
2. Executar `db push --dry-run`.
3. Aplicar a migration e publicar a função no projeto vinculado.
4. Rodar pgTAP e testes da Edge Function.
5. Regenerar `src/integrations/supabase/types.ts`.
6. Consultar tabela, índices, constraints, policies, grants e função.
7. Rodar Advisor novamente e impedir alertas novos.

Critério de saída:

- provisionamento atômico e idempotente comprovado;
- nenhum acesso cruzado entre tenants;
- tipos locais/remotos alinhados;
- rollback completo sob falha.

## Entrega 2 — Identidade e criação do escritório

### Tarefa 6 — Serviço e tipos de cadastro

Criar:

- `src/types/signup.ts`
- `src/services/signup.ts`
- `src/hooks/useSignup.ts`
- `src/lib/signup-redirect.ts`
- `src/test/signup-service.test.ts`
- `src/test/signup-redirect.test.ts`

O serviço oferece:

- cadastro por senha com `emailRedirectTo` seguro;
- cadastro/entrada por Google com intenção de signup preservada;
- reenvio de confirmação;
- provisionamento do escritório via Edge Function;
- mensagens de erro estáveis;
- timeout e possibilidade de repetição.

`signup-redirect.ts` deve aceitar apenas rotas internas conhecidas. O fluxo não usa
`user_metadata` para decidir papel, tenant, plano ou autorização.

### Tarefa 7 — Criar layout público e cadastro aprovado

Criar:

- `src/components/auth/PublicEntryLayout.tsx`
- `src/components/auth/GoogleAuthButton.tsx`
- `src/components/auth/PasswordField.tsx`
- `src/components/signup/SignupIdentityStep.tsx`
- `src/components/signup/OfficeProvisioningStep.tsx`
- `src/pages/Signup.tsx`
- `src/pages/SignupConfirm.tsx`

Alterar:

- `src/App.tsx`
- `src/pages/Login.tsx`

Requisitos visuais:

- desktop em duas colunas conforme Tela 1 aprovada;
- azul-marinho `#081B48`, azul profundo `#153B86` e ação `#2563EB`;
- proposta de valor, 14 dias sem cartão e DJEN/CNJ na coluna esquerda;
- Google e e-mail/senha na coluna direita;
- rótulos persistentes, mostrar senha, autofill e validação inline;
- termos e privacidade acessíveis;
- no celular, apresentação compacta acima do formulário;
- login atual recebe link `Criar conta grátis`;
- login por token permanece somente no login e não entra no cadastro.

### Tarefa 8 — Confirmação e criação do escritório

Implementar rotas:

- `/cadastro`;
- `/cadastro/confirmar`;
- `/cadastro/escritorio`.

Regras:

- senha sem sessão mostra confirmação, reenvio, spam e correção de e-mail;
- callback confirmado retorna a `/cadastro/escritorio`;
- Google retorna à mesma rota já autenticado;
- etapa do escritório coleta apenas o nome de exibição;
- clique duplo reutiliza `requestId` armazenado na sessão;
- sucesso atualiza `TenantContext`, seleciona o novo tenant e segue para
  `/boas-vindas`;
- usuário com tenant que visita `/cadastro` volta ao painel;
- falha mantém o nome preenchido e oferece nova tentativa.

### Tarefa 9 — Guardas para conta sem escritório

Alterar:

- `src/components/auth/ProtectedRoute.tsx`
- `src/contexts/TenantContext.tsx`
- `src/pages/HomeEntry.tsx`

Substituir o estado atual `Conta sem escritório — peça ao administrador` por:

- convite pendente: fluxo de aceite existente;
- usuário de signup sem tenant: `/cadastro/escritorio`;
- erro real de carregamento: manter recuperação existente.

Evitar loop entre `/`, `/cadastro/escritorio` e carregamento do contexto.
Preservar `AuthenticatedRoute.tsx`: ele continua responsável apenas por exigir sessão,
enquanto a decisão sobre tenant fica em `ProtectedRoute` e nas rotas de cadastro.

### Tarefa 10 — Testes da entrega 2

Criar/alterar:

- `src/test/Signup.test.tsx`
- `src/test/SignupConfirm.test.tsx`
- `src/test/OfficeProvisioning.test.tsx`
- `src/test/ProtectedRoute.test.tsx`
- `src/test/TenantContext.test.tsx`
- `src/test/AuthContext.test.tsx`

Cobrir métodos Google/senha, confirmação, reenvio, retorno, erro já cadastrado,
request idempotente, criação do escritório, mobile e redirecionamentos sem loop.

Critério de saída:

- conta nova chega a `/boas-vindas` por ambos os métodos;
- conta existente continua entrando normalmente;
- convite existente não é convertido em novo escritório;
- TypeScript, testes e build aprovados.

## Entrega 3 — Onboarding retomável

### Tarefa 11 — Serviço e hook do onboarding

Criar:

- `src/types/onboarding.ts`
- `src/services/onboarding.ts`
- `src/hooks/useOnboarding.ts`
- `src/lib/onboarding-progress.ts`
- `src/test/onboarding-progress.test.ts`
- `src/test/onboarding-service.test.ts`

O serviço lê e atualiza somente o tenant selecionado. O progresso é calculado a partir
dos timestamps de conclusão e nunca aceito como percentual livre do navegador.

Operações:

- carregar estado;
- concluir etapa;
- pular etapa atual;
- retomar primeira etapa incompleta;
- concluir fluxo;
- invalidar consultas do tenant após mudança.

### Tarefa 12 — Construir a experiência aprovada

Criar:

- `src/components/onboarding/OnboardingShell.tsx`
- `src/components/onboarding/WelcomeStep.tsx`
- `src/components/onboarding/OabSetupStep.tsx`
- `src/components/onboarding/TeamInviteStep.tsx`
- `src/components/onboarding/OnboardingChecklist.tsx`
- `src/components/onboarding/OnboardingBanner.tsx`
- `src/pages/Onboarding.tsx`

Alterar:

- `src/App.tsx`
- `src/pages/Index.tsx`

Aplicar as Telas 2 e 3 aprovadas:

- lateral azul da Tela 1, sem lilás;
- progresso persistido;
- `Fazer isso depois` em OAB e equipe;
- painel sempre liberado;
- banner retomável, checklist e estados vazios explicativos;
- banner dispensável na sessão, checklist permanente até conclusão;
- foco e navegação por teclado;
- conteúdo em coluna única no celular.

### Tarefa 13 — Integrar convite da equipe existente

Reutilizar `team-management.ts` e o fluxo atual de convites. O passo deve:

- permitir um convite adicional durante o piloto, totalizando proprietário e um
  membro convidado/ativo;
- mostrar sucesso parcial por e-mail;
- permitir pular sem criar registros vazios;
- marcar a etapa concluída depois de um convite válido ou de uma decisão explícita de
  pular.

Alterar `supabase/functions/tenant-invite-member/index.ts` para aplicar esse limite no
servidor quando a assinatura estiver `trialing`; o frontend apenas reflete o resultado.
Depois da contratação, continuam valendo os limites do plano e adicionais. Não
duplicar formulários nem criar nova tabela de convites.

### Tarefa 14 — Testes da entrega 3

Criar:

- `src/test/Onboarding.test.tsx`
- `src/test/OabSetupStep.test.tsx`
- `src/test/OnboardingChecklist.test.tsx`
- atualizar `src/test/Index.test.tsx` ou teste equivalente do painel

Cobrir carregar, pular, retomar, concluir, tenant alterado, banner dispensado,
checklist persistente, convites e responsividade.

Critério de saída:

- onboarding pode ser interrompido e retomado em outro navegador;
- painel não fica bloqueado;
- estado de um tenant nunca aparece em outro;
- telas correspondem aos mockups aprovados.

## Entrega 4 — OAB, DJEN e tarefa automática

### Tarefa 15 — Conectar OAB ao serviço jurídico existente

Alterar:

- `src/services/legal-integration.ts`
- `src/components/onboarding/OabSetupStep.tsx`
- `src/pages/IntegracoesJuridicas.tsx`

Criar:

- `src/components/legal/OabActivationForm.tsx`
- `src/hooks/useOabActivation.ts`
- `src/test/oab-activation.test.ts`

`OabSetupStep` e `IntegracoesJuridicas` devem reutilizar `OabActivationForm` e o mesmo
hook, sem repetir normalização, chamadas ou mensagens de erro.

Fluxo:

1. normalizar número, tipo e UF;
2. chamar `legal-discover-lawyer-processes` com o tenant selecionado;
3. persistir OAB mesmo quando a descoberta externa falhar de forma recuperável;
4. confirmar que fontes DJEN foram criadas pelo domínio existente;
5. iniciar reconciliação manual sem bloquear a navegação;
6. atualizar onboarding quando a OAB estiver válida e a sincronização agendada;
7. mostrar `preparando`, `sincronizando`, `concluído`, `atenção` ou `falha`.

Não prometer publicação imediata; comunicar que a primeira sincronização continua em
segundo plano.

### Tarefa 16 — Criar ligação publicação–tarefa

Criar migration com:

`npx supabase migration new publication_review_tasks`

Adicionar `public.publication_task_links`:

- `tenant_id uuid not null`;
- `publication_id uuid not null`;
- `task_id uuid not null`;
- timestamps;
- chave primária ou unique em `(tenant_id, publication_id)`;
- FKs compostas que garantam publicação e tarefa do mesmo tenant;
- RLS de leitura para membros com acesso às publicações/tarefas;
- escrita reservada à automação de ingestão;
- grants explícitos.

Adicionar índices necessários para abrir tarefa a partir da publicação e publicação a
partir da tarefa.

### Tarefa 17 — Automatizar tarefa de revisão idempotente

Alterar:

- `supabase/functions/_shared/legal-ingestion.ts`
- `supabase/functions/legal-reconcile/index.ts`
- testes compartilhados da ingestão/reconciliação

Criar a função compartilhada
`createPublicationReviewTasks(admin, tenantId, publicationIds)`, que:

- opera somente sobre `createdIds` da ingestão;
- identifica profissional/membership da OAB de origem;
- cria tarefa `Revisar intimação` com categoria `Publicação`;
- vincula `processo_id` quando houver;
- atribui ao advogado ativo quando houver correspondência inequívoca;
- deixa sem responsável quando não houver correspondência segura;
- inclui referência curta à publicação, sem duplicar todo o texto jurídico;
- não grava prazo definitivo;
- cria `publication_task_links` no mesmo fluxo idempotente;
- não cria segunda tarefa após overlap, retry ou reconciliação repetida.

A sequência de ingestão fica:

1. persistir publicações;
2. criar tarefas idempotentes;
3. criar notificações;
4. registrar falhas secundárias como execução parcial sem descartar publicações.

### Tarefa 18 — Navegação e confirmação humana

Alterar:

- `src/pages/Publicacoes.tsx`
- `src/pages/Tarefas.tsx`
- `src/pages/ProcessoDetalhe.tsx`, se a timeline já expuser publicação/tarefa

Requisitos:

- publicação abre a tarefa de revisão relacionada;
- tarefa abre publicação e processo relacionados;
- sugestão de prazo aparece como proposta;
- confirmação reutiliza o fluxo existente de revisão de prazo;
- nenhum CTA chama prazo sugerido de confirmado antes da ação humana.

### Tarefa 19 — Testes da entrega 4

Adicionar pgTAP e testes unitários cobrindo:

- OAB válida e inválida;
- falha externa preserva registro e agenda nova tentativa;
- fontes OAB/DJEN idempotentes;
- publicação inédita cria uma notificação e uma tarefa;
- repetição cria zero novas tarefas;
- advogado correto recebe tarefa;
- ambiguidade gera tarefa não atribuída;
- publicação, processo, responsável e tarefa sempre pertencem ao mesmo tenant;
- prazo permanece não confirmado.

Critério de saída:

- OAB cadastrada pelo onboarding alimenta o domínio jurídico real;
- publicação nova vira trabalho operacional sem duplicação;
- falhas de alerta ou atribuição não descartam a publicação.

## Entrega 5 — Landing, métricas e validação completa

### Tarefa 20 — Conectar a apresentação pública

Alterar:

- `src/pages/Landing.tsx`
- `src/pages/Login.tsx`

Requisitos:

- CTAs de teste apontam para `/cadastro`;
- `Entrar` permanece em `/login`;
- `Ver demonstração` aponta para conteúdo funcional ou é removido até existir;
- textos usam 14 dias de forma consistente;
- benefícios de OAB/DJEN não prometem resultados instantâneos;
- links e comportamento mobile são testados.

### Tarefa 21 — Instrumentar o funil

Criar:

- `src/lib/product-analytics.ts`
- `src/test/product-analytics.test.ts`

Usar `@vercel/analytics` já instalado para os eventos definidos na especificação.
Enviar somente estágio, método e resultado; nunca enviar e-mail, OAB, nome, número CNJ,
texto de publicação ou identificadores jurídicos.

Instrumentar landing, cadastro, provisionamento, onboarding, OAB, primeira
sincronização e primeira tarefa de publicação. Falha de analytics nunca bloqueia o
fluxo principal.

### Tarefa 22 — Verificação completa em preview

Executar:

- pgTAP das novas migrations;
- testes das Edge Functions;
- `npm run test`;
- `npx tsc --noEmit`;
- lint focado em todos os arquivos alterados;
- `npm run build`;
- Advisor de segurança e performance;
- inspeção de grants e funções `SECURITY DEFINER`;
- fluxo por senha e por Google;
- desktop e celular;
- retomada após refresh e nova sessão;
- publicação de fixture ingerida duas vezes;
- isolamento entre dois tenants.

No preview Vercel, confirmar URLs de callback e ausência de erros no console e logs.
Não promover sem sucesso dos fluxos críticos.

### Tarefa 23 — Publicação gradual

1. Publicar banco e funções mantendo os CTAs ainda ocultos.
2. Implantar front em preview e executar o roteiro completo.
3. Promover o front com sinalização de cadastro inicialmente restrita à conta geral.
4. Fazer uma criação real controlada e validar tenant, piloto, onboarding e OAB.
5. Liberar CTAs públicos.
6. Monitorar erros e funil nas primeiras 24 horas.
7. Em caso de incidente, ocultar CTAs e recusar novos provisionamentos sem afetar
   tenants já criados.

## Ordem recomendada de commits

1. Banco, pgTAP e função transacional de provisionamento.
2. Edge Function `tenant-self-signup` e testes.
3. Serviços, tipos e guardas de cadastro.
4. Tela de cadastro e confirmação.
5. Criação do escritório e retomada.
6. Banco, serviço e interface do onboarding.
7. OAB/DJEN no onboarding.
8. Ligação e automação publicação–tarefa.
9. Landing e métricas do funil.
10. Acessibilidade, testes completos e validação de preview.

Cada commit deve ser funcional, limitado ao seu objetivo e não deve incluir arquivos
do usuário sem relação com esta entrega.
