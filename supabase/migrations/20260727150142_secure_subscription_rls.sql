-- Dados de cobrança e plano só podem ser alterados por funções administrativas.
-- O usuário autenticado pode apenas consultar a própria assinatura.

alter table public.asaas_subscriptions enable row level security;

drop policy if exists "users_own_asaas_subs" on public.asaas_subscriptions;
drop policy if exists "Users view own subscription" on public.asaas_subscriptions;
drop policy if exists "Users insert own subscription" on public.asaas_subscriptions;
drop policy if exists "Users update own subscription" on public.asaas_subscriptions;
drop policy if exists "Service role manages subscriptions" on public.asaas_subscriptions;

revoke insert, update, delete on public.asaas_subscriptions from authenticated;
grant select on public.asaas_subscriptions to authenticated;

create policy "Users view own subscription"
  on public.asaas_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
