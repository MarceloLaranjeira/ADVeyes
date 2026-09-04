# Conta Geral com visão do escritório, plano Parceiro e azul profundo

**Data:** 4 de setembro de 2026  
**Status:** aprovado para planejamento

## Objetivo

Entregar três ajustes coordenados no ADVeyes:

1. aumentar o contraste da identidade azul, mantendo fundo cinza-claro e
   superfícies brancas;
2. fazer a Conta Geral abrir exatamente a mesma experiência do escritório
   selecionado, com sua marca, menus, dados e permissões de leitura;
3. conceder, uma única vez, o plano máximo `parceiro`, sem teste e sem cobrança,
   somente aos escritórios que já existem na produção no momento desta
   aprovação.

Cadastros futuros continuam seguindo normalmente o fluxo comercial, o período
de teste e os planos públicos. Esta entrega não cria concessão automática para
novos escritórios.

## Decisão de arquitetura

A solução usará o contexto compartilhado de tenant que já existe no produto.
Ao selecionar um escritório no painel da plataforma, a Conta Geral entra no
tenant real e navega pelas mesmas rotas e componentes que os usuários daquele
escritório. Não serão mantidas cópias administrativas das telas operacionais e
não haverá autenticação simulada como se o operador fosse um membro do
escritório.

A faixa de Conta Geral permanece visível e identifica um dos dois estados:

- **visualização:** leitura dos mesmos dados que o escritório vê, sem mutações;
- **suporte temporário:** escrita liberada somente após ativação explícita por
  30 minutos, mantendo as proteções e a auditoria existentes.

Encerrar o suporte ou expirar o período restaura imediatamente a visualização.
Trocar de escritório também troca todo o contexto, sem misturar cache, marca ou
dados do tenant anterior.

## Contexto real e identidade do escritório

O resumo administrativo usado na seleção deve transportar ou resolver a
identidade publicada do tenant. Depois da seleção, o `TenantContext` terá os
mesmos valores usados no acesso normal do escritório:

- nome público e nome curto;
- logo clara, logo escura, ícone e favicon publicados;
- tokens de cor publicados;
- tenant selecionado e assinatura vigente.

Se um escritório não possuir identidade publicada, o fallback será o nome do
tenant e a marca padrão do ADVeyes. A Conta Geral não fabricará um objeto de
branding com logo vazia. As páginas continuarão consultando os serviços atuais,
sempre filtradas pelo tenant selecionado e protegidas pelas regras já existentes.

## Direção visual aprovada

A opção escolhida foi **A — azul profundo com contraste reforçado**.

| Papel | Cor | Uso |
|---|---|---|
| Fundo | `#F2F5F8` | Canvas geral das páginas |
| Superfície | `#FFFFFF` | Cartões, cabeçalhos, diálogos e formulários |
| Sidebar | `#163A5F` | Navegação principal e área da marca |
| Sidebar ativa | `#255D8C` | Item ativo e estados interativos |
| Ação principal | `#255D8C` | Botões primários e elementos de destaque |
| Ação principal hover | `#1D4B73` | Hover e pressionamento |
| Borda | `#DCE3EA` | Divisores, inputs e cartões |
| Texto principal | `#1F2937` | Títulos e conteúdo em superfícies claras |

Na sidebar, texto e ícones principais serão brancos com opacidade de 100%. O
conteúdo secundário nunca terá opacidade inferior a 82%; rótulos de seção,
rodapé e itens inativos deverão permanecer legíveis. Foco de teclado, item ativo
e estados hover continuarão distinguíveis sem depender apenas da cor.

As cores semânticas de erro, alerta, sucesso e informação não serão convertidas
para azul. Personalizações válidas de cada escritório continuam sendo aplicadas
quando o tenant estiver aberto, mas o fallback global seguirá a paleta acima.

## Plano Parceiro para a base atual

O plano `parceiro` já existe no catálogo como o nível mais alto. O frontend deve
reconhecê-lo explicitamente como um plano válido e habilitar todas as
funcionalidades disponíveis no produto, inclusive API, webhooks, BI, marca
branca e os limites definidos no catálogo.

A fotografia da produção verificada antes desta especificação contém sete
escritórios:

- dois já estão ativos no plano `parceiro`;
- cinco estão em teste no plano `solo`;
- nenhuma das sete assinaturas possui `asaas_subscription_id`.

A concessão será executada em uma única transação e terá as seguintes regras:

1. congelar os IDs dos sete tenants existentes no início da operação;
2. abortar se a quantidade não for exatamente sete;
3. abortar se qualquer assinatura-alvo tiver `asaas_subscription_id` ou outro
   vínculo de assinatura recorrente que exija cancelamento externo;
4. resolver a versão ativa mais recente do plano `parceiro` no catálogo;
5. alterar os sete tenants para estado ativo;
6. deixar as sete assinaturas com plano `parceiro` e status `active`;
7. limpar `trial_ends_at`, `billing_cycle`, `next_due_date` e `canceled_at`;
8. preservar o histórico anterior no `price_snapshot`, junto de origem
   `platform_partner_grant`, data da concessão e indicação de gratuidade;
9. registrar um evento por tenant em `platform_audit_events`;
10. confirmar que sete tenants foram alterados antes de concluir a transação.

Os IDs congelados, e não uma condição aberta como “todos os tenants”, serão os
alvos do `UPDATE`. Assim, um cadastro criado depois da fotografia não receberá o
benefício por acidente. Como não há assinatura recorrente no Asaas, a operação
não realizará chamada externa nem apagará identificadores de cliente.

## Fluxo de dados e segurança

```text
Conta Geral -> seleciona tenant -> TenantContext real
                               -> branding publicado
                               -> assinatura/entitlements do tenant
                               -> mesmas rotas e serviços do escritório
                               -> leitura por padrão
                               -> escrita somente com suporte temporário
```

Não haverá relaxamento de RLS, exposição de `service_role` no navegador nem
consulta sem `tenant_id`. A seleção administrativa continuará validada no
backend para usuário de plataforma. O suporte temporário continuará sendo a
única forma de habilitar mutações da Conta Geral.

A migração de dados será executada pelo canal administrativo do Supabase, em
transação, usando o plano já cadastrado. Ela não modifica triggers de cadastro,
checkout, webhooks do Asaas ou regras para futuros clientes.

## Tratamento de falhas

- Se a marca publicada não puder ser carregada, a navegação usa o fallback do
  tenant sem bloquear a tela.
- Se a seleção do tenant falhar, o contexto anterior não será parcialmente
  substituído e o usuário receberá erro acionável.
- Se a concessão encontrar quantidade diferente de sete, plano Parceiro ausente
  ou vínculo de cobrança externa, toda a transação será revertida.
- Se qualquer tenant deixar de ser atualizado ou auditado, a transação inteira
  será revertida.
- Falhas de frontend não concedem permissão adicional; a autorização permanece
  no backend e na camada de acesso existente.

## Componentes afetados

- tokens de tema e estados da sidebar em `src/index.css` e `AppSidebar`;
- tipos e matriz de recursos do plano em `subscription-access` e contexto de
  assinatura;
- seleção de tenant e resolução de branding em `PlatformAdmin`, serviço
  administrativo e `TenantContext`;
- testes de layout, assinatura e seleção administrativa;
- dados das assinaturas e tenants atuais na produção.

Não faz parte desta entrega refatorar telas operacionais, alterar limites do
catálogo, criar um novo checkout ou modificar integrações jurídicas.

## Validação

A entrega somente será considerada concluída após:

1. teste unitário garantindo que `parceiro` habilita todas as funcionalidades;
2. teste da seleção administrativa com branding real e fallback;
3. teste de que a Conta Geral permanece somente leitura sem suporte;
4. verificação visual da sidebar e dos botões em desktop e celular;
5. verificação de contraste dos textos principal e secundário;
6. TypeScript, lint, suíte automatizada e build de produção;
7. publicação do frontend e verificação das rotas principais em produção;
8. consulta pós-operação confirmando sete tenants ativos, sete assinaturas
   `parceiro` ativas, zero testes e zero vínculos recorrentes no Asaas;
9. abertura de pelo menos dois escritórios pela Conta Geral para confirmar que
   marca, menu e dados coincidem com a visão normal de cada tenant.

## Reversão

O `price_snapshot` e os eventos de auditoria guardarão o estado anterior de cada
assinatura. Se a concessão precisar ser revertida, uma transação administrativa
restaurará plano, status, ciclo e datas a partir desse snapshot somente para os
sete IDs congelados. O frontend pode ser revertido pelo deployment anterior sem
afetar os dados. A reversão visual não altera assinaturas.

## Critérios de aceite

- sidebar e botões usam o azul profundo aprovado e mantêm texto branco legível;
- a Conta Geral vê a mesma marca, menu, componentes e dados do escritório;
- sem suporte temporário, a Conta Geral não consegue alterar dados;
- os sete escritórios existentes ficam ativos no plano máximo `parceiro`, sem
  teste e sem próxima cobrança;
- escritórios futuros não recebem o plano Parceiro automaticamente;
- nenhuma assinatura externa é cancelada ou desvinculada silenciosamente;
- a alteração é rastreável e reversível;
- não há regressão nas rotas e funções existentes do ADVeyes.
