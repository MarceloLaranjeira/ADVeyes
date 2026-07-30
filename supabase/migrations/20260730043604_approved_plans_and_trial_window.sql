-- O piloto aprovado para novos escritórios dura 14 dias. A tabela legada ainda
-- é criada por usuário enquanto a migração integral da cobrança por tenant é
-- concluída, portanto mantemos o trigger compatível sem alterar cobranças.

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.asaas_subscriptions (
    user_id,
    plan,
    status,
    trial_ends_at
  )
  values (
    new.id,
    'trial',
    'trial',
    now() + interval '14 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user_subscription() is
  'Cria a compatibilidade de assinatura legada com piloto aprovado de 14 dias.';
