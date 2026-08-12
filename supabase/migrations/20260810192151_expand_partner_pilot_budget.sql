-- Durante o piloto, os escritórios parceiros podem consumir todo o orçamento
-- mensal reservado à integração complementar. O teto global continua sendo a
-- última barreira de segurança e pode ser reduzido pela Conta Geral.
update public.billing_plans
set entitlements = entitlements || jsonb_build_object(
  'provider_budget_cents', 20000,
  'partner', true
)
where code = 'parceiro'
  and is_active
  and retired_at is null;
