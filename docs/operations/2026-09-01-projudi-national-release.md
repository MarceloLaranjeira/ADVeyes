# Release Projudi nacional e audiências — 2026-09-01

## Produção

- Frontend: `https://adveyes.automatikus.com.br/audiencias`
- Supabase: projeto `mrgxxwllthlwxqhehjwp`
- Vercel deployment: `dpl_E7Cneyf6WUyMvv3fkuqPifgnYjo2`
- Edge Function `legal-reconcile`: publicada após as migrações.

## Resultado verificado

- 27 TJs estaduais com cobertura pública DataJud registrada.
- TJAM como único adaptador autenticado em estado `pilot`.
- Albertino: 9 indícios DataJud recuperados, 0 com data/hora comprovada.
- Os 9 itens permanecem em revisão; nenhum compromisso foi fabricado usando a
  data da movimentação.
- RLS: duas políticas na fila de sinais e uma no registro público de tribunais.

## Gate executado

- 75 arquivos de teste aprovados; 438 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`: aprovado.
- Tela real validada no Chrome autenticado, sem erro ou warning no console.
- Migrações aplicadas e backfill idempotente por chave
  `(tenant_id, source_provider, external_id)`.

## Limite conhecido e deliberado

DataJud fornece capa e movimentações públicas, mas nem sempre fornece a agenda
futura completa. Por isso, a cobertura pública está ativa nacionalmente e o
acesso autenticado ao portal será homologado tribunal por tribunal, iniciando
pelo Projudi/TJAM. A interface informa essa diferença em vez de prometer
cobertura inexistente.
