-- Plano Parceiro — advogados que financiam o projeto.
--
-- Eles não são conta de teste e não devem parecer uma. Recebem o teto mais
-- alto de tudo que a plataforma controla — usuários, processos monitorados,
-- termos de busca, créditos de IA — com assinatura `active`, sem cobrança e
-- sem prazo de expiração.
--
-- Sobre "ilimitado": o que é nosso, é ilimitado na prática. O que sai da
-- conta do Escavador é dinheiro real e continua com teto, porque o limite
-- verdadeiro não está aqui — está em `platform_provider_limits`, hoje em
-- R$ 60/mês, calibrado para o saldo durar. Dar orçamento infinito ao
-- escritório não fura esse teto; só troca a mensagem de erro.
--
-- Por isso o orçamento do parceiro é igual ao teto da plataforma: é o máximo
-- que ele conseguiria consumir de qualquer forma. DJEN e DataJud são
-- oficiais e gratuitos, e continuam sem limite para todos.
--
-- O preço de catálogo não é zero por dois motivos: a tabela exige valor
-- positivo, e registrar o valor cheio deixa visível quanto está sendo
-- concedido. A cobrança nunca acontece porque a assinatura não recebe
-- identificadores do Asaas.

begin;

insert into public.billing_plans (
  code,
  version,
  name,
  rank,
  monthly_price_cents,
  annual_price_cents,
  activation_fee_cents,
  entitlements,
  features
)
values (
  'parceiro',
  1,
  'Parceiro',
  5,
  -- Valor equivalente ao topo do catálogo, para o benefício ser mensurável.
  109900,
  1099000,
  0,
  jsonb_build_object(
    'users', 50,
    'monitored_cases', 5000,
    'search_terms', 50,
    'ai_credits', 20000,
    -- Igual ao teto da plataforma: acima disso é inalcançável.
    'provider_budget_cents', 6000,
    'partner', true
  ),
  '[
    "processes_contacts",
    "calendar_google",
    "tasks_deadlines_publications",
    "client_portal",
    "crm_finance_contracts",
    "automations_reports",
    "roles_permissions",
    "advanced_teams_visibility",
    "audit_advanced_reports",
    "white_label_eligible",
    "api_webhooks_bi",
    "assisted_onboarding_sla"
  ]'::jsonb
)
on conflict (code, version) do update set
  entitlements = excluded.entitlements,
  features = excluded.features,
  is_active = true;

commit;
