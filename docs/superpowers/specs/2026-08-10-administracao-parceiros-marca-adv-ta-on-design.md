# Administração da plataforma, cadastro de parceiros e marca ADV Tá On Club

## Objetivo

Dar à Conta Geral controle seguro sobre escritórios e usuários, permitir o cadastro de advogados parceiros por um link genérico controlado e substituir a identidade visual global pela marca ADV Tá On Club.

O ambiente de produção foi previamente limpo. A conta `marcelolaranjeira33@gmail.com` permanece como única conta e único administrador geral; não há escritórios, vínculos ou arquivos de marca antigos. A credencial global do Escavador permanece no Supabase Vault e não faz parte do ciclo de vida de escritórios.

## Decisões aprovadas

- O sidebar terá um único item **Administração** na seção **Conta Geral**.
- A administração usará uma página com abas **Escritórios**, **Usuários** e **Parceiros**.
- Somente administradores gerais ativos poderão acessar ou executar ações nessa página.
- Escritórios e usuários serão arquivados antes da exclusão definitiva.
- O período de recuperação será de 30 dias.
- A conta em uso e o último administrador geral nunca poderão ser arquivados ou excluídos.
- Parceiros usarão um link genérico, ativo até ser pausado ou regenerado.
- Cada e-mail poderá consumir o link de parceiro uma única vez.
- O cadastro público normal continuará criando um escritório em período de teste.
- O cadastro originado pelo link controlado receberá automaticamente o plano `Parceiro`.
- ADV Tá On Club substituirá a identidade visual global. `ADVeyes` será mantido apenas em identificadores técnicos internos nesta etapa.

## Navegação e interface

### Sidebar

Administradores gerais verão, em **Conta Geral**:

1. **Painel executivo** - métricas e situação geral.
2. **Administração** - gestão operacional da plataforma.

O item Administração apontará para `/admin/administracao`. Não haverá links separados para usuários e escritórios no sidebar, evitando redundância e movimento adicional na navegação.

### Aba Escritórios

A lista exibirá nome, slug, plano, status, quantidade de usuários, criação e elegibilidade para exclusão. Os filtros serão **Ativos**, **Arquivados** e **Todos**.

Ações:

- abrir o escritório em modo de suporte;
- arquivar;
- restaurar durante o período de retenção;
- excluir definitivamente quando o prazo de 30 dias tiver terminado.

Arquivar exige uma confirmação simples. Excluir definitivamente exige digitar o nome exato do escritório e exibe o impacto estimado sobre usuários, processos, documentos e arquivos.

### Aba Usuários

A lista exibirá nome, e-mail, estado da conta, escritórios vinculados, papéis e último acesso. Os filtros serão **Ativos**, **Arquivados**, **Sem escritório** e **Todos**.

Ações:

- ver vínculos;
- arquivar;
- restaurar;
- excluir definitivamente após 30 dias.

Excluir exige digitar o e-mail exato. A interface nunca oferecerá arquivamento ou exclusão para a conta em uso nem para o último administrador geral.

### Aba Parceiros

A aba exibirá o estado do link genérico, data de criação, administrador responsável e total de utilizações. Ações:

- gerar link;
- copiar link;
- pausar ou reativar;
- regenerar, invalidando imediatamente o anterior;
- consultar o histórico de cadastros originados pelo link.

O valor completo do link será mostrado somente na criação/regeneração e durante a cópia naquela sessão. Depois disso, a interface mostrará apenas uma identificação mascarada.

## Arquitetura de backend

### Orquestração administrativa

A Edge Function `platform-admin` continuará sendo a fronteira administrativa. Ela receberá novas ações para listar, arquivar, restaurar e excluir usuários/escritórios e para controlar o link de parceiros.

Cada requisição deverá:

1. validar a sessão;
2. confirmar um registro ativo em `platform_admins`;
3. validar o payload e as regras de autoproteção;
4. executar a operação idempotente;
5. registrar um evento em `platform_audit_events` sem segredos ou dados sensíveis desnecessários.

O frontend não terá acesso direto a `auth.users`, ao Vault, a hashes de convite ou a rotinas de exclusão.

### Ciclo de vida de escritórios

Serão usados os campos já existentes em `tenants`, incluindo `status`, `retention_until`, `suspended_at` e `canceled_at`. O arquivamento definirá `status = 'archived'`, a data de suspensão e `retention_until = now() + interval '30 days'`.

As rotinas de autorização deverão negar acesso a qualquer tenant arquivado. Restaurar antes do prazo retornará o tenant ao estado anterior, que será registrado em metadados de ciclo de vida/auditoria.

### Ciclo de vida de usuários

Uma tabela privada de ciclo de vida registrará estado, data de arquivamento, elegibilidade para exclusão, administrador responsável e os vínculos que estavam ativos antes do arquivamento.

Ao arquivar:

- vínculos ativos passam para `suspended`;
- o usuário é banido no Supabase Auth para bloquear novos logins e renovações;
- sessões renováveis são revogadas quando suportado;
- o acesso a dados fica imediatamente bloqueado pelas regras de vínculo, mesmo que um JWT curto ainda não tenha expirado.

Ao restaurar, somente os vínculos suspensos por aquela operação retornam ao estado anterior e o banimento é removido.

### Exclusão definitiva

Banco, Storage e Supabase Auth não compartilham uma transação única. Portanto, a exclusão será uma operação idempotente em etapas, com estado `deletion_in_progress` e possibilidade de retomada segura:

1. bloquear acesso;
2. remover objetos do Storage pela API oficial;
3. remover dados e vínculos do escritório respeitando dependências;
4. remover o tenant;
5. remover usuários elegíveis que não tenham outro vínculo e cuja exclusão tenha sido solicitada;
6. remover a conta do Supabase Auth quando aplicável;
7. concluir o registro de auditoria.

Se uma etapa falhar, o alvo permanece inacessível e marcado como exclusão em andamento. Uma nova execução retoma do ponto seguro; o sistema nunca volta a apresentar um alvo parcialmente excluído como ativo.

## Link genérico de parceiros

Uma tabela privada armazenará campanhas de cadastro de parceiros com identificador, hash do segredo, prefixo mascarado, estado, criador e timestamps. O segredo bruto nunca será persistido.

Outra tabela registrará utilizações por e-mail normalizado, usuário, tenant criado e data. Uma restrição única impedirá que o mesmo e-mail use a campanha mais de uma vez.

### Início do cadastro

O link apontará para `/cadastro/parceiro?token=...`. Antes do signup, o frontend enviará o token e o e-mail para uma Edge Function. Após validar campanha ativa e uso do e-mail, o backend criará uma intenção curta e de uso único, vinculada ao e-mail. O token genérico será removido da URL e não será gravado em `user_metadata`.

### Conclusão do cadastro

Após confirmação do e-mail ou OAuth, a intenção será consumida de forma idempotente. O backend criará:

- tenant próprio;
- vínculo `owner` ativo;
- perfil profissional do proprietário;
- assinatura ativa no plano `Parceiro`, sem cobrança Asaas;
- onboarding inicial;
- registro de utilização e auditoria.

O fluxo normal `/cadastro` continuará usando o plano de teste. Uma intenção inválida, pausada, regenerada, já consumida ou vinculada a outro e-mail será recusada sem criar benefícios de parceiro.

## Marca ADV Tá On Club

O PDF fornecido contém três versões aprovadas: fundo navy, fundo claro e fundo preto. Os elementos vetoriais serão extraídos e exportados em formatos adequados para web, mantendo proporção e nitidez.

A marca substituirá a identidade visual em:

- login e recuperação de senha;
- cadastro normal e cadastro de parceiro;
- onboarding;
- sidebar e cabeçalhos;
- landing page e páginas públicas;
- favicon, ícones instaláveis e metadados visuais;
- e-mails transacionais próprios da aplicação.

Serão criadas variantes horizontal clara, horizontal escura e ícone reduzido. A implementação preservará nomes técnicos como projeto Vercel, domínio, chaves de armazenamento e identificadores de banco para não quebrar integrações. Textos visíveis ao usuário deixarão de apresentar Automatikus ou ADVeyes, salvo aviso legal de transição que venha a ser solicitado separadamente.

## Limpeza de estado no navegador

Ao recarregar vínculos, `TenantContext` descartará qualquer tenant salvo em `sessionStorage` ou `localStorage` que não exista mais ou ao qual o usuário não tenha acesso. Um administrador geral sem tenant ativo será direcionado à Conta Geral; um usuário comum sem tenant será direcionado à conclusão de cadastro.

Estados de integração serão independentes do tenant. A ausência/perda de acesso ao tenant não poderá transformar falha de permissão em “Escavador sem token”. A credencial global continuará consultada somente pela Conta Geral.

## Tratamento de erros

O backend retornará códigos estáveis para:

- conta protegida;
- último administrador geral;
- prazo de retenção não cumprido;
- alvo já arquivado, restaurado ou em exclusão;
- vínculo que impede exclusão;
- link de parceiro inválido, pausado, regenerado ou já utilizado;
- falha em Storage, Auth ou banco.

A interface traduzirá os códigos sem expor tokens, hashes, chaves, SQL ou detalhes internos. Operações demoradas mostrarão andamento e permitirão nova tentativa segura.

## Testes e critérios de aceite

### Administração

- O item Administração aparece somente para administrador geral.
- O sidebar permanece imóvel ao navegar.
- A conta em uso e o último administrador não podem ser arquivados/excluídos pela UI nem pela API.
- Arquivar bloqueia acesso imediatamente e define retenção de 30 dias.
- Restaurar recompõe somente os vínculos afetados pelo arquivamento.
- Exclusão antes do prazo é recusada.
- Exclusão elegível limpa dados, Storage e Auth de forma retomável.
- Todas as ações produzem auditoria sem segredos.

### Parceiros

- Link ativo inicia cadastro para múltiplos e-mails diferentes.
- O mesmo e-mail não utiliza o benefício duas vezes.
- Pausar ou regenerar invalida o link anterior.
- Cadastro normal recebe teste; cadastro validado recebe plano Parceiro.
- Repetir callbacks não cria tenant ou assinatura duplicados.

### Marca e sessão

- As variantes da logo permanecem legíveis em fundo navy, claro e preto.
- Login, cadastro, onboarding, sidebar, páginas públicas e PWA usam a nova marca.
- Tenant removido não permanece selecionado após atualização.
- A credencial global do Escavador continua configurada após arquivar/excluir um escritório.
- Falhas de permissão não são exibidas como ausência de token.

### Verificação final

- testes unitários e de integração das funções;
- testes de RLS e ciclo de vida no banco local;
- build de produção;
- teste visual desktop e mobile;
- fluxo real de cadastro comum e parceiro;
- smoke test após deploy, incluindo Conta Geral, cadastro, onboarding e restauração.
