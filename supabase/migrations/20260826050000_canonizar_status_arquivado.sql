-- Canoniza o status de arquivamento em `processos`.
--
-- `situacaoNaCarteira` normaliza caixa e espaço antes de comparar, mas o
-- filtro que vai ao banco compara texto. Sem canonizar, uma linha gravada
-- como "arquivado" ou " Arquivado " é tratada de um jeito pelo código e de
-- outro pela consulta — as duas metades da mesma regra discordando.
--
-- O filtro em `carteiraAtiva` usa `ilike`, que resolve a caixa. O espaço em
-- volta é o que sobra, e é isto que esta migration limpa. Depois dela, as
-- duas pontas concordam sobre a mesma linha.
--
-- Só toca em linhas que já significam "arquivado": nenhum processo muda de
-- situação por causa desta migration, apenas de grafia.

begin;

update public.processos
set status = 'Arquivado'
where status is not null
  and lower(btrim(status)) = 'arquivado'
  and status <> 'Arquivado';

commit;
