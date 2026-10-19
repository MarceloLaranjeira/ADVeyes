begin;

-- Dados demográficos usados nos indicadores de Contatos (faixa etária,
-- profissões, origens e aniversariantes).
alter table public.clientes
  add column if not exists data_nascimento date
    check (data_nascimento is null or data_nascimento between date '1900-01-01' and current_date),
  add column if not exists profissao text
    check (profissao is null or length(pg_catalog.btrim(profissao)) between 1 and 120),
  add column if not exists origem text
    check (origem is null or length(pg_catalog.btrim(origem)) between 1 and 120);

commit;
