begin;

select plan(16);

select has_table('public', 'billing_plans', 'billing_plans existe');
select has_table('public', 'billing_addons', 'billing_addons existe');
select has_table('public', 'tenant_subscriptions', 'tenant_subscriptions existe');
select has_table('public', 'billing_checkout_orders', 'billing_checkout_orders existe');
select has_table('public', 'billing_webhook_events', 'billing_webhook_events existe');

select is(
  (select monthly_price_cents from public.billing_plans where code = 'solo' and version = 1),
  7900,
  'Solo custa 7900 centavos'
);
select is(
  (select monthly_price_cents from public.billing_plans where code = 'profissional' and version = 1),
  27900,
  'Profissional custa 27900 centavos'
);
select is(
  (select monthly_price_cents from public.billing_plans where code = 'escritorio' and version = 1),
  61900,
  'Escritório custa 61900 centavos'
);
select is(
  (select monthly_price_cents from public.billing_plans where code = 'performance' and version = 1),
  109900,
  'Performance custa 109900 centavos'
);
select is(
  (select annual_price_cents from public.billing_plans where code = 'performance' and version = 1),
  1099000,
  'Anual Performance equivale a dez mensalidades'
);

select is(
  (select price_cents from public.billing_addons where code = 'white_label_monthly' and version = 1),
  34900,
  'White-label recorrente custa 34900 centavos'
);
select is(
  (select price_cents from public.billing_addons where code = 'white_label_implementation' and version = 1),
  249000,
  'Implantação white-label custa 249000 centavos'
);
select is(
  (select min_plan_rank from public.billing_addons where code = 'white_label_monthly' and version = 1),
  3,
  'White-label exige Escritório ou Performance'
);
select is(
  (select validity_days from public.billing_addons where code = 'ai_credits_500' and version = 1),
  90,
  'Pacote de IA vence em 90 dias'
);

select col_is_unique(
  'public',
  'tenant_subscriptions',
  'tenant_id',
  'existe uma única assinatura lógica por escritório'
);

select has_column(
  'public',
  'tenant_subscriptions',
  'asaas_customer_id',
  'assinatura do escritório preserva o identificador do cliente Asaas'
);

select * from finish();

rollback;
