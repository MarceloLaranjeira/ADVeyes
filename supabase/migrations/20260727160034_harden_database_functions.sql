-- Corrige os triggers de criação de usuário e restringe funções privilegiadas.
-- A migration 20260410000000 reutilizou o nome on_auth_user_created e removeu
-- sem intenção o trigger responsável por criar public.profiles.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_profile_created on auth.users;
drop trigger if exists on_auth_user_created_subscription on auth.users;

drop function if exists public.criar_trial_subscription();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.asaas_subscriptions (user_id, plan, status, trial_ends_at)
  values (new.id, 'trial', 'trial', now() + interval '7 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_profile_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter function public.enqueue_email(text, jsonb) set search_path = '';
alter function public.read_email_batch(text, integer, integer) set search_path = '';
alter function public.delete_email(text, bigint) set search_path = '';
alter function public.move_to_dlq(text, text, bigint, jsonb) set search_path = '';

revoke execute on function public.enqueue_email(text, jsonb) from public, anon, authenticated;
revoke execute on function public.read_email_batch(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.delete_email(text, bigint) from public, anon, authenticated;
revoke execute on function public.move_to_dlq(text, text, bigint, jsonb) from public, anon, authenticated;

grant execute on function public.enqueue_email(text, jsonb) to service_role;
grant execute on function public.read_email_batch(text, integer, integer) to service_role;
grant execute on function public.delete_email(text, bigint) to service_role;
grant execute on function public.move_to_dlq(text, text, bigint, jsonb) to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_subscription() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
