-- Credenciais pessoais de tribunal, certificados e PINs não pertencem ao
-- ADVeyes. A integração jurídica usa somente fontes públicas e segredos
-- globais protegidos nas funções de servidor.

do $$
declare
  policy_record record;
begin
  if to_regclass('public.tribunal_credenciais') is null then
    return;
  end if;

  -- Revoga primeiro a superfície da Data API para impedir novas leituras
  -- durante e depois da neutralização dos valores legados.
  revoke all privileges on table public.tribunal_credenciais
    from anon, authenticated;

  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tribunal_credenciais'
  loop
    execute format(
      'drop policy if exists %I on public.tribunal_credenciais',
      policy_record.policyname
    );
  end loop;

  alter table public.tribunal_credenciais enable row level security;
  alter table public.tribunal_credenciais force row level security;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribunal_credenciais'
      and column_name = 'token_acesso'
  ) then
    update public.tribunal_credenciais set token_acesso = null;
    alter table public.tribunal_credenciais
      drop constraint if exists tribunal_credenciais_token_acesso_proibido;
    alter table public.tribunal_credenciais
      add constraint tribunal_credenciais_token_acesso_proibido
      check (token_acesso is null);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribunal_credenciais'
      and column_name = 'token_refresh'
  ) then
    update public.tribunal_credenciais set token_refresh = null;
    alter table public.tribunal_credenciais
      drop constraint if exists tribunal_credenciais_token_refresh_proibido;
    alter table public.tribunal_credenciais
      add constraint tribunal_credenciais_token_refresh_proibido
      check (token_refresh is null);
  end if;

  update public.tribunal_credenciais
  set ativo = false,
      tipo_autenticacao = 'desativado',
      updated_at = now();

  comment on table public.tribunal_credenciais is
    'Estrutura legada desativada. É proibido armazenar tokens, certificados, PINs ou credenciais pessoais de tribunais.';
end
$$;
