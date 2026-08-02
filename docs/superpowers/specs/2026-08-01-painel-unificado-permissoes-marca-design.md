# Painel unificado, permissões e identidade dos escritórios

## Objetivo

Transformar a Conta Geral do ADVeyes em um painel executivo unificado, capaz
de acompanhar todos os escritórios e abrir a operação de cada cliente sem
trocar de produto. Ao mesmo tempo, corrigir definitivamente as permissões de
marca e perfil e permitir que cada escritório controle o acesso de sua equipe.

## Problemas confirmados

1. A política de leitura de `tenant_brand_settings` chama
   `private.is_active_tenant_member` com `tenant_id` e `auth.uid()` invertidos.
   Isso impede que membros válidos carreguem a identidade visual e faz a tela
   parecer indisponível até para proprietário e administrador.
2. O upload da marca depende de RLS no `storage.objects`; o fluxo precisa
   validar separadamente upload e gravação da configuração para exibir erros
   precisos.
3. A Conta Geral possui indicadores executivos, mas usa uma navegação separada
   e só abre escritórios nos quais o administrador da plataforma também possui
   vínculo de membro.
4. As permissões individuais existentes aceitam apenas liberações extras. Elas
   não representam a decisão completa de herdar, permitir ou bloquear.
5. A edição de perfil não possui uma regra única e clara para o próprio usuário
   e para a administração do escritório.

## Decisões aprovadas

- A Conta Geral e os menus operacionais dos escritórios usarão o mesmo shell.
- O dashboard executivo será a página inicial do administrador da plataforma.
- Um seletor define o escritório observado, sem criar vínculo artificial de
  membro.
- O administrador da plataforma terá leitura por padrão.
- Escritas exigirão “Modo suporte” temporário, motivo obrigatório e auditoria.
- Proprietário e administradores do escritório gerenciarão permissões.
- Cada usuário poderá editar o próprio perfil; proprietário e administradores
  também poderão corrigir perfis dos demais integrantes.
- Permissões individuais terão três estados: `inherit`, `allow` e `deny`.
- O proprietário preserva acesso total e não pode ser alterado por um
  administrador.

## Arquitetura de navegação

O shell unificado terá dois grupos de navegação.

### Conta Geral

- Dashboard executivo
- Escritórios
- Assinaturas
- Integrações
- Auditoria e suporte

### Escritório selecionado

- Visão do escritório
- Processos e casos
- Contatos
- CRM
- Agenda, tarefas, audiências e publicações
- Pesquisa e integrações jurídicas
- Financeiro, contratos e horas
- Gestão de equipe e permissões
- Identidade visual e configurações

O seletor de escritório atualiza o contexto operacional. Para usuários comuns,
ele lista apenas seus vínculos ativos. Para administradores da plataforma, ele
lista os escritórios retornados pela visão executiva e indica se o acesso está
em modo leitura ou suporte.

## Dashboard executivo

O painel exibirá cartões 3D e clicáveis para:

- escritórios totais e ativos;
- usuários ativos;
- processos cadastrados e monitorados;
- assinaturas por status e plano;
- integrações saudáveis, pendentes e com falha;
- sessões de suporte abertas;
- alertas operacionais.

A tabela de escritórios permitirá filtrar, selecionar e abrir cada cliente. Ao
selecionar um escritório, os menus operacionais aparecerão no mesmo shell e o
cabeçalho identificará claramente o ambiente atual.

## Modo suporte

Será criada uma tabela de sessões de suporte com:

- administrador da plataforma;
- escritório alvo;
- motivo obrigatório;
- início, expiração e encerramento;
- status;
- metadados de contexto.

A duração padrão será de 30 minutos, com encerramento manual ou automático. A
leitura do escritório não exige sessão. Qualquer criação, alteração ou remoção
feita por administrador da plataforma exige sessão ativa para aquele
escritório. Cada operação gera evento de auditoria com ator, escritório,
recurso, ação e sessão de suporte.

O modo suporte não concede transferência de propriedade e não permite agir
como outro usuário.

## Modelo de permissões

A matriz base por perfil continua sendo a referência:

- `owner`: acesso total e regras exclusivas de propriedade;
- `admin`: administração operacional, marca, equipe e permissões não exclusivas;
- `lawyer`: operação jurídica;
- `assistant`: operação jurídica limitada;
- `finance`: financeiro, contratos e relatórios pertinentes.

`tenant_memberships.permission_overrides` passa a armazenar valores explícitos:

```json
{
  "legal": { "read": "inherit", "update": "allow", "delete": "deny" },
  "finance": { "read": "allow" }
}
```

A avaliação seguirá esta ordem:

1. restrições absolutas de propriedade e plataforma;
2. bloqueio individual (`deny`);
3. liberação individual (`allow`);
4. regra herdada do perfil (`inherit` ou ausência da chave).

Administradores podem alterar permissões de membros não proprietários. Não
podem alterar o proprietário, transferir propriedade nem conceder ações
exclusivas de titularidade e cobrança. O proprietário pode configurar todos os
demais membros.

As mesmas decisões serão aplicadas na interface e nas políticas RLS. Ocultar
um menu não substitui autorização no banco.

## Tela de equipe

A página terá três abas:

### Por pessoa

Seleciona um integrante e permite definir exceções `inherit`, `allow` ou
`deny`, agrupadas por Identidade, Equipe, Jurídico, Financeiro, Contratos,
Relatórios e Integrações.

### Perfis padrão

Exibe a matriz efetiva de cada papel. Nesta primeira entrega, a matriz base é
visualizada, não redefinida por escritório. Isso evita que um perfil receba uma
semântica diferente em cada cliente; as diferenças ficam nas exceções por
pessoa.

### Histórico

Mostra ator, integrante afetado, antes/depois e data de cada mudança de papel,
escopo ou permissão.

## Perfis de usuário

Os campos editáveis serão nome, foto, telefone e OAB. O usuário pode editar o
próprio perfil. Proprietário e administrador podem editar os perfis de membros
do mesmo escritório, exceto dados de autenticação, e-mail e propriedade.

Alterações administrativas serão auditadas. O e-mail continua sendo controlado
pelo Supabase Auth e não será alterado por essa tela.

## Identidade visual

Proprietário e administrador poderão alterar nome público, nome curto, logo e
cores do escritório. A correção inclui:

- ajustar a ordem dos argumentos da política de leitura;
- garantir políticas `INSERT`, `SELECT`, `UPDATE` e `DELETE` para o bucket;
- preservar isolamento pelo primeiro segmento `tenant_id` do caminho;
- validar PNG, JPG, WEBP e SVG até 1,5 MB;
- pré-visualizar antes de salvar;
- remover arquivo órfão quando uma gravação não puder ser concluída;
- atualizar imediatamente o contexto de marca após salvar.

O bucket permanece público somente para leitura dos arquivos de marca. Upload,
substituição e exclusão continuam protegidos por RLS.

## Componentes e limites

- `UnifiedPlatformShell`: navegação da Conta Geral e do escritório selecionado.
- `ExecutiveDashboard`: métricas, filtros e tabela de escritórios.
- `PlatformTenantContext`: escritório observado e estado de suporte.
- `SupportSessionPanel`: abertura, encerramento e expiração da sessão.
- `PermissionsPanel`: matriz efetiva e exceções individuais.
- `MemberProfileEditor`: edição própria ou administrativa.
- `BrandSettings`: upload e configuração da identidade.
- Funções SQL de autorização: única fonte de verdade para RLS.
- Edge Functions administrativas: validam JWT, identidade do ator e sessão de
  suporte antes de chamar operações privilegiadas.

Essas unidades devem permanecer independentes para que navegação, marca,
permissões e suporte possam ser testados separadamente.

## Tratamento de erros

- Mensagens distinguem sessão expirada, permissão insuficiente, formato ou
  tamanho inválido, conflito de versão e falha de infraestrutura.
- A UI não exibe detalhes internos do banco.
- Salvamentos concorrentes usam `updated_at` para detectar conflito e solicitar
  atualização antes de sobrescrever.
- Sessões de suporte expiradas falham de forma segura e desativam os controles
  de escrita.
- Upload e gravação da marca são tratados como fluxo compensável para evitar
  arquivos órfãos.

## Migrações e segurança

As mudanças de banco serão criadas por migrations versionadas. Todas as novas
tabelas públicas terão RLS habilitada e `GRANT` explícito. Funções privilegiadas
terão `search_path` fixo, execução revogada de `PUBLIC` e validação explícita do
ator. Nenhuma autorização usará `user_metadata`.

Depois das mudanças serão executados os advisors de segurança e desempenho do
Supabase. As policies serão verificadas com consultas representando cada papel
e com uma sessão de suporte válida e expirada.

## Testes e critérios de aceite

1. Proprietário e administrador conseguem carregar, enviar e salvar a marca.
2. Advogado, assistente e financeiro não conseguem alterar a marca sem
   permissão explícita aplicável.
3. Cada usuário edita o próprio perfil; administração edita membros do mesmo
   escritório, nunca de outro tenant.
4. `deny` prevalece sobre o perfil e `allow` concede somente ações liberáveis.
5. Administrador não altera proprietário nem ações exclusivas.
6. Administrador da plataforma lê qualquer escritório sem vínculo de membro.
7. Escritas da plataforma falham sem modo suporte e funcionam com sessão ativa.
8. Sessão expirada deixa de autorizar imediatamente.
9. Todas as alterações relevantes geram auditoria.
10. Dashboard executivo e menus operacionais coexistem no mesmo shell.
11. TypeScript, testes automatizados e build passam antes do deploy.
12. A versão publicada é validada no domínio oficial com contas de proprietário,
    administrador de escritório e administrador da plataforma.

## Fora de escopo desta entrega

- impersonação de usuário;
- redefinição completa da matriz base por escritório;
- alteração de e-mail pela administração;
- transferência de propriedade;
- permissões definidas por JWT ou `user_metadata`;
- sessões de suporte permanentes.
