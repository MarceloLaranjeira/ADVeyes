# Plano de implementação: navegação JavaScript do Projudi/TJAM

Especificação: `docs/superpowers/specs/2026-09-05-projudi-tjam-navegacao-javascript-design.md`

## Meta

Corrigir a descoberta da Mesa do Advogado do TJAM, importar suas categorias de
audiências e sessões e substituir o erro genérico por diagnósticos seguros por
etapa. A estrutura continuará preparada para adaptadores estaduais separados.

## Etapa 1 — Baseline e fixtures

1. Preservar as alterações preexistentes do worktree.
2. Rodar os testes atuais do adaptador.
3. Criar fixtures sanitizadas para links diretos, `onclick`,
   `href="javascript:..."`, categorias numéricas, paginação e sessão.
4. Confirmar que fixtures não contêm login, senha, cookie, token, `jsessionid`
   ou parâmetros transitórios.

## Etapa 2 — Resolvedor seguro de navegação

1. Extrair rotas literais de `href` e `onclick` sem avaliar JavaScript.
2. Aceitar apenas HTTPS e a origem `https://projudi.tjam.jus.br`.
3. Rejeitar logout, esquemas perigosos e origens externas.
4. Sanitizar URLs antes de persistir evidência ou gerar logs.
5. Manter limites de páginas, redirects e timeout.

## Etapa 3 — Descoberta e extração

1. Percorrer frames e rotas internas pós-login.
2. Reconhecer a Mesa do Advogado e links cujo texto seja somente a quantidade.
3. Importar conciliação, interrogatório, una, instrução e julgamento e sessões.
4. Tratar agenda reconhecida e vazia como sucesso.
5. Preservar data/hora, fuso de Manaus, tipo, status e chave idempotente.

## Etapa 4 — Diagnóstico

1. Introduzir códigos distintos para login, navegação pós-login, navegação da
   agenda e estrutura da lista.
2. Registrar em `console` somente etapa, status, caminho sanitizado e contagens.
3. Traduzir os novos códigos para a interface.
4. Manter credenciais, cookies e conteúdo jurídico fora dos logs.

## Etapa 5 — Verificação e publicação

1. Rodar testes dirigidos, TypeScript, lint e build.
2. Revisar o diff de segurança.
3. Publicar `legal-portal-admin` e `legal-portal-worker` quando compartilharem o
   adaptador alterado.
4. Confirmar versões ativas e logs da implantação.
5. Solicitar nova revalidação pelo escritório; o servidor não reutilizará a
   senha da tentativa que falhou.
6. Confirmar no banco o resultado da sincronização sem expor dados pessoais.

## Rollback

Republicar a versão anterior das Edge Functions. Audiências já importadas não
serão apagadas, pois a persistência é idempotente e falhas não executam limpeza.

