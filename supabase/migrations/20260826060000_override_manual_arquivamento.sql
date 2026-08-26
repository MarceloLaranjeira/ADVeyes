-- Sobreposição manual do arquivamento vindo do tribunal.
--
-- A decisão de produto foi "o tribunal decide, o advogado pode sobrepor".
-- A primeira metade já funciona: a fase deduzida das movimentações e o flag
-- do provedor tiram o processo da carteira ativa. A segunda metade não
-- existia — não havia onde gravar a decisão do advogado.
--
-- Sem ela, um processo que o tribunal marque como arquivado por engano some
-- da listagem principal sem caminho de volta. Mudar `status` para "Em
-- andamento" não resolve: esse é o valor padrão do cadastro, e tratá-lo como
-- decisão faria o tribunal nunca vencer, matando o arquivamento automático.
--
-- Por isso a coluna é `boolean` NULO por padrão, com três estados que dizem
-- coisas diferentes:
--
--   null   — o advogado não se pronunciou; vale o tribunal.
--   true   — o advogado arquivou; vale mesmo que o tribunal discorde.
--   false  — o advogado desarquivou; vale mesmo que o tribunal discorde.
--
-- É a diferença entre "não decidi" e "decidi que está ativo", que um campo
-- de texto livre não consegue expressar.

begin;

alter table public.processos
  add column if not exists arquivado_manual boolean;

comment on column public.processos.arquivado_manual is
  'Sobreposição explícita do advogado sobre o arquivamento vindo do '
  'tribunal. Nulo significa "sem decisão manual" e deixa o tribunal decidir; '
  'true arquiva e false desarquiva, ambos vencendo a fonte automática.';

alter table public.processos
  add column if not exists arquivado_manual_em timestamptz;

alter table public.processos
  add column if not exists arquivado_manual_por uuid
    references auth.users (id) on delete set null;

comment on column public.processos.arquivado_manual_em is
  'Quando a sobreposição foi registrada. Em perda de prazo por processo '
  'fora da carteira, é isto que diz desde quando e por decisão de quem.';

-- A listagem filtra por este campo junto do status, então ele entra no
-- índice. Parcial porque a esmagadora maioria dos processos nunca recebe
-- sobreposição — indexar os nulos seria carregar peso morto.
create index if not exists processos_arquivado_manual_idx
  on public.processos (tenant_id, arquivado_manual)
  where arquivado_manual is not null;

-- Quem decidiu e quando são preenchidos pelo banco, não pelo cliente.
--
-- Deixar isso a cargo de quem chama significaria confiar que todo caminho de
-- escrita se lembre — e a trilha de auditoria de uma decisão que tira
-- processo da carteira não pode depender de disciplina.
create or replace function private.registrar_override_arquivamento()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.arquivado_manual is distinct from old.arquivado_manual then
    if new.arquivado_manual is null then
      new.arquivado_manual_em := null;
      new.arquivado_manual_por := null;
    else
      new.arquivado_manual_em := now();
      new.arquivado_manual_por := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists processos_registrar_override_arquivamento
  on public.processos;
create trigger processos_registrar_override_arquivamento
  before update of arquivado_manual on public.processos
  for each row
  execute function private.registrar_override_arquivamento();

-- Alterar a sobreposição usa a mesma permissão de editar o processo.
--
-- Não é decisão administrativa como a antecedência da controladoria: é o
-- advogado dizendo que aquele processo dele continua ativo. Quem pode editar
-- o processo pode dizer isso.
grant update (arquivado_manual) on table public.processos to authenticated;

commit;
