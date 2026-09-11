# Release Projudi nacional e audiências — 2026-09-01

## Produção

- Frontend: `https://adveyes.automatikus.com.br/audiencias`
- Supabase: projeto `mrgxxwllthlwxqhehjwp`
- Vercel deployment: `dpl_3tSK9xtf6LQSJrtP9SNJVmeRKKmE`
- Edge Functions `legal-reconcile`, `legal-portal-admin` e
  `legal-portal-worker`: publicadas após as migrações.

## Resultado verificado

- 27 TJs estaduais com cobertura pública DataJud registrada.
- TJAM como único adaptador autenticado em estado `pilot`.
- Seletor nacional com 27 TJs publicado; credenciais ficam habilitadas somente
  para adaptadores autenticados homologados.
- O leitor do TJAM percorre todos os `frame`/`iframe` autenticados do Projudi,
  evitando depender do primeiro frame do portal para localizar a agenda.
- Albertino: 9 indícios DataJud recuperados, 0 com data/hora comprovada.
- Os 9 itens permanecem em revisão; nenhum compromisso foi fabricado usando a
  data da movimentação.
- RLS: duas políticas na fila de sinais e uma no registro público de tribunais.

## Gate executado

- 76 arquivos de teste aprovados; 442 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: aprovado.
- Domínio oficial verificado servindo o bundle `index-dlULmxE0.js`, contendo o
  cartão nacional e o campo **Tribunal / estado**.
- Migrações aplicadas e backfill idempotente por chave
  `(tenant_id, source_provider, external_id)`.

## Limite conhecido e deliberado

DataJud fornece capa e movimentações públicas, mas nem sempre fornece a agenda
futura completa. Por isso, a cobertura pública está ativa nacionalmente e o
acesso autenticado ao portal será homologado tribunal por tribunal, iniciando
pelo Projudi/TJAM. A interface informa essa diferença em vez de prometer
cobertura inexistente.

Uma tentativa encerrada com `layout_changed` antes desta publicação não
preservou a senha. O administrador deve abrir **Conectar Projudi**, selecionar
TJAM e informar novamente o acesso autorizado para validar o novo leitor.
