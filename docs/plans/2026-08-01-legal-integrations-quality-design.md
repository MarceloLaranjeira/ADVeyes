# Qualidade dos andamentos e gestão das integrações jurídicas

## Objetivo

Melhorar a legibilidade e o vínculo dos andamentos oficiais, apresentar com clareza as três fontes jurídicas da plataforma e permitir que a Conta geral configure uma única credencial do Escavador sem expô-la aos escritórios ou ao navegador.

## Decisões aprovadas

- DJEN/CNJ permanece como fonte oficial de publicações.
- DataJud/CNJ permanece como fonte oficial de processos e andamentos.
- Escavador é complementar e não bloqueia as fontes oficiais.
- O token do Escavador é global para toda a plataforma.
- Somente administradores ativos da Conta geral podem criar, substituir ou validar o token.
- Donos e administradores de escritórios visualizam o estado da integração, mas nunca o token.

## Alternativas consideradas

1. **Segredo de Edge Function configurado manualmente:** seguro, mas não permite administrar o token dentro do ADVeyes.
2. **Token por escritório:** facilita cobrança isolada, porém duplica credenciais, expõe gestão técnica aos clientes e diverge da conta única aprovada.
3. **Supabase Vault com operação mediada pelo backend:** permite a gestão na Conta geral, mantém criptografia autenticada em repouso e não devolve o valor ao cliente. Esta é a opção escolhida.

## Arquitetura de credenciais

- O token será armazenado no Supabase Vault com nome estável de integração.
- Funções SQL `SECURITY DEFINER` terão execução revogada de `anon` e `authenticated` e concedida somente a `service_role`.
- A Edge Function `platform-admin` continuará validando a sessão e a existência de um administrador ativo em `platform_admins` antes de aceitar configuração ou teste.
- A interface enviará o token somente para `platform-admin` por HTTPS autenticado.
- A resposta conterá apenas estado, data de atualização e resultado da validação; nunca o segredo ou seus fragmentos.
- As funções jurídicas buscarão primeiro o segredo de ambiente para compatibilidade e, na ausência dele, o segredo do Vault.
- Toda troca de credencial produzirá evento de auditoria sem o valor secreto.

## Tela de integrações

A página passa a separar claramente:

- **DJEN/CNJ:** publicações oficiais, estado operacional e última sincronização.
- **DataJud/CNJ:** processos e andamentos oficiais, estado operacional e última sincronização.
- **Escavador:** descoberta/monitoramento complementar e estado da credencial.

Quando o usuário estiver em acesso da Conta geral, o cartão do Escavador exibirá `Validar e salvar`. No acesso normal de um escritório, exibirá somente o estado. O cadastro de OAB e a confirmação de processos continuam separados das credenciais dos provedores.

## Qualidade dos andamentos

- Traduzir chaves técnicas do DataJud (`tipo_de_documento`, `resultado` e similares) para rótulos em português.
- Usar o complemento mais informativo como título quando o título oficial for genérico, por exemplo `Documento` passa a `Certidão`.
- Remover repetição entre título e descrição.
- Preservar integralmente o payload original para auditoria.
- Persistir também número CNJ e nome do cliente no andamento como referência resiliente, mantendo `process_id` como vínculo principal.
- Fazer backfill dos registros atuais usando `process_id` e a tabela `processos`.
- Na interface, usar os campos persistidos como fallback quando o processo relacionado não puder ser carregado.

## Publicações

- Ampliar a decodificação de entidades HTML numéricas e nomeadas para eliminar textos como `JUDICI&Aacute;RIO`.
- Preservar a mensagem de conteúdo indisponível apenas quando a origem realmente não trouxer texto.

## Segurança e validação

- RLS continua isolando registros por escritório.
- Nenhuma chave será salva em tabela pública ou `localStorage`.
- Testes cobrirão normalização, títulos genéricos, HTML, vínculo redundante, autorização de administrador da plataforma e ausência de vazamento do token.
- Depois da migração serão executados testes, TypeScript, build, advisors de segurança/desempenho e uma sincronização controlada.

