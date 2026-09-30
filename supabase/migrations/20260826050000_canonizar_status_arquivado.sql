-- Canoniza o status de arquivamento em `processos`.
--
-- `situacaoNaCarteira` normaliza o valor antes de comparar, mas o filtro que
-- vai ao banco compara texto. Sem canonizar, uma linha gravada como
-- "arquivado" ou " Arquivado " é tratada de um jeito pelo código e de outro
-- pela consulta — as duas metades da mesma regra discordando sobre a mesma
-- linha.
--
-- `carteiraAtiva` usa `ilike`, que resolve a caixa. O espaço em volta é o que
-- sobra, e é isto que esta migration fecha — nas linhas já gravadas e nas
-- futuras.

begin;

-- `btrim` sem segundo argumento remove apenas o caractere espaço. O `trim()`
-- do JavaScript remove todo espaço em branco, tabulação e quebra de linha
-- incluídas. Igualar os dois exige a classe completa, senão um status com
-- tabulação continua sendo arquivado para o código e ativo para a consulta.
create or replace function private.canonizar_status_processo(valor text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when valor is null then null
    when lower(regexp_replace(valor, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
         = 'arquivado'
      then 'Arquivado'
    else valor
  end;
$$;

comment on function private.canonizar_status_processo(text) is
  'Devolve a grafia canônica de "Arquivado" quando o valor significa '
  'arquivado, ignorando caixa e espaço em branco em volta. Qualquer outro '
  'valor passa intacto.';

-- Linhas já gravadas.
--
-- Só toca no que já significa "arquivado": nenhum processo muda de situação
-- por causa desta migration, apenas de grafia.
update public.processos
set status = private.canonizar_status_processo(status)
where status is not null
  and status <> private.canonizar_status_processo(status);

-- Escritas futuras.
--
-- Sem isto, a próxima gravação com espaço em volta reabre a divergência, e o
-- backfill acima viraria uma correção com prazo de validade. O gatilho
-- garante a invariante sem exigir que todo chamador se lembre dela.
create or replace function private.canonizar_status_processo_trigger()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.status := private.canonizar_status_processo(new.status);
  return new;
end;
$$;

drop trigger if exists processos_canonizar_status on public.processos;
create trigger processos_canonizar_status
  before insert or update of status on public.processos
  for each row
  execute function private.canonizar_status_processo_trigger();

commit;
