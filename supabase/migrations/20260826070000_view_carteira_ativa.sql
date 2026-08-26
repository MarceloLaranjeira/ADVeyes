-- A carteira ativa como definição única, do lado do banco.
--
-- Até aqui a regra vivia em dois lugares e só um deles enxergava tudo. O
-- filtro TypeScript (`carteiraAtiva`) alcança o que está em `processos` — a
-- decisão do escritório e o status legado — mas o arquivamento deduzido das
-- movimentações mora em `process_intelligence_current`, outra tabela. Numa
-- consulta `count: "exact", head: true` não vem linha nenhuma para cruzar em
-- memória, então o contador do painel somava processo que o tribunal já
-- encerrou, enquanto a listagem, que faz o join, não o mostrava. Mesmo
-- escritório, dois números diferentes na mesma tela.
--
-- A view resolve isso onde o problema existe: no SQL. Quem precisa contar
-- carteira ativa lê daqui e recebe a regra inteira, as três fontes já
-- combinadas.
--
-- A hierarquia é a mesma de `situacaoNaCarteira` no cliente, e precisa
-- continuar sendo — divergência entre as duas é justamente o defeito que
-- esta migration existe para fechar:
--
--   arquivado_manual = false  → ativo, mesmo que o tribunal discorde.
--   arquivado_manual = true   → fora, mesmo que o tribunal discorde.
--   arquivado_manual is null  → decide o status legado, depois o tribunal.

begin;

create or replace view public.processos_carteira_ativa
with (security_invoker = true)
as
select p.*
from public.processos p
left join public.process_intelligence_current pi
  on pi.tenant_id = p.tenant_id
 and pi.process_id = p.id
where
  -- Desarquivamento explícito vence tudo, inclusive o tribunal.
  p.arquivado_manual is false
  or (
    p.arquivado_manual is null
    -- `lower(regexp_replace(...))` e não `btrim`: é a mesma normalização de
    -- `normalizar()` no cliente, que corta qualquer espaço em branco, não só
    -- o caractere espaço. Um status com tabulação divergiria de novo.
    and lower(regexp_replace(coalesce(p.status, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'))
        is distinct from 'arquivado'
    and coalesce(pi.phase, '') is distinct from 'arquivado_encerrado'
  );

comment on view public.processos_carteira_ativa is
  'Processos da carteira ativa, com as três fontes de arquivamento já '
  'combinadas: sobreposição manual do escritório, status legado e fase '
  'deduzida pelo tribunal. Espelha `situacaoNaCarteira` no cliente. '
  '`security_invoker` para que a RLS de `processos` continue valendo.';

grant select on public.processos_carteira_ativa to authenticated;

commit;
