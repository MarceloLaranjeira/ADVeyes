begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select ok(
  not has_table_privilege('anon', 'public.tribunal_credenciais', 'select'),
  'anon não pode consultar credenciais legadas'
);

select ok(
  not has_table_privilege('authenticated', 'public.tribunal_credenciais', 'select'),
  'authenticated não pode consultar credenciais legadas'
);

select ok(
  not has_table_privilege('authenticated', 'public.tribunal_credenciais', 'insert'),
  'authenticated não pode inserir credenciais legadas'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'tribunal_credenciais'),
  0::bigint,
  'nenhuma política expõe a tabela legada'
);

select is(
  (select count(*) from public.tribunal_credenciais
   where token_acesso is not null or token_refresh is not null),
  0::bigint,
  'tokens pessoais existentes foram eliminados'
);

select throws_ok(
  $$insert into public.tribunal_credenciais (
      user_id, tribunal, nome_tribunal, token_acesso
    ) values (
      gen_random_uuid(), 'tjam', 'TJAM', 'segredo-proibido'
    )$$,
  '23514',
  null,
  'o banco rejeita novo token pessoal mesmo em acesso privilegiado'
);

select * from finish();
rollback;
