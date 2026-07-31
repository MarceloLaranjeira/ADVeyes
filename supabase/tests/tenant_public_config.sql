begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.tenants (
  id, legal_name, display_name, slug, status
) values
  ('a1000000-0000-0000-0000-000000000001','Marca Ativa Ltda.','Marca Ativa','marca-ativa','active'),
  ('a2000000-0000-0000-0000-000000000002','Marca Suspensa Ltda.','Marca Suspensa','marca-suspensa','suspended');

insert into public.tenant_brand_settings (
  tenant_id, public_name, short_name, color_tokens, privacy_url,
  terms_url, published_at
) values (
  'a1000000-0000-0000-0000-000000000001',
  'Oliveira Advocacia',
  'Oliveira',
  '{"primary":"#123456"}'::jsonb,
  'https://marca-ativa.test/privacidade',
  'https://marca-ativa.test/termos',
  now()
);

select is(
  public.resolve_tenant_public_config(
    'adveyes.automatikus.com.br'
  ) ->> 'mode',
  'central',
  'host central resolve modo central'
);
select is(
  public.resolve_tenant_public_config('LOCALHOST:5173')
    ->> 'available',
  'false',
  'RPC rejeita host com porta; normalização pertence à borda'
);
select is(
  public.resolve_tenant_public_config(
    'marca-ativa.adveyes.automatikus.com.br'
  ) ->> 'available',
  'true',
  'tenant ativo está disponível'
);
select is(
  public.resolve_tenant_public_config(
    'marca-ativa.adveyes.automatikus.com.br'
  ) #>> '{branding,publicName}',
  'Oliveira Advocacia',
  'retorna nome público publicado'
);
select is(
  public.resolve_tenant_public_config(
    'marca-ativa.adveyes.automatikus.com.br'
  ) #>> '{branding,colorTokens,primary}',
  '#123456',
  'retorna somente tokens públicos de marca'
);
select is(
  public.resolve_tenant_public_config(
    'marca-suspensa.adveyes.automatikus.com.br'
  ) ->> 'available',
  'false',
  'tenant suspenso fica indisponível'
);
select is(
  public.resolve_tenant_public_config(
    'nao-existe.adveyes.automatikus.com.br'
  ) ->> 'available',
  'false',
  'slug inexistente fica indisponível'
);
select is(
  public.resolve_tenant_public_config('evil.example.com')
    ->> 'mode',
  'invalid',
  'host fora da allowlist é inválido'
);

select * from finish();
rollback;
