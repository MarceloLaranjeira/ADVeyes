create or replace function private.create_self_service_owner_professional()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  owner_email text;
  owner_name text;
  owner_membership_id uuid;
begin
  select
    lower(account.email),
    coalesce(
      nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
      split_part(account.email, '@', 1)
    )
  into owner_email, owner_name
  from auth.users account
  where account.id = new.user_id;

  select membership.id
  into owner_membership_id
  from public.tenant_memberships membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = new.user_id
    and membership.status = 'active';

  if owner_email is null or owner_membership_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'signup_owner_profile_unavailable';
  end if;

  insert into public.equipe (
    tenant_id,
    user_id,
    membership_id,
    nome,
    email,
    cargo,
    ativo
  ) values (
    new.tenant_id,
    new.user_id,
    owner_membership_id,
    owner_name,
    owner_email,
    'administrador',
    true
  )
  on conflict (tenant_id, lower(email))
    where email is not null and btrim(email) <> ''
  do update set
    user_id = excluded.user_id,
    membership_id = excluded.membership_id,
    nome = excluded.nome,
    cargo = excluded.cargo,
    ativo = true,
    updated_at = now();

  return new;
end;
$$;

revoke execute on function private.create_self_service_owner_professional()
  from public, anon, authenticated;

create trigger tenant_signup_create_owner_professional
after insert on private.tenant_signup_provisioning
for each row execute function private.create_self_service_owner_professional();

insert into public.equipe (
  tenant_id,
  user_id,
  membership_id,
  nome,
  email,
  cargo,
  ativo
)
select
  mapping.tenant_id,
  mapping.user_id,
  membership.id,
  coalesce(
    nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'name'), ''),
    split_part(account.email, '@', 1)
  ),
  lower(account.email),
  'administrador',
  true
from private.tenant_signup_provisioning mapping
join auth.users account on account.id = mapping.user_id
join public.tenant_memberships membership
  on membership.tenant_id = mapping.tenant_id
  and membership.user_id = mapping.user_id
  and membership.status = 'active'
where account.email is not null
on conflict (tenant_id, lower(email))
  where email is not null and btrim(email) <> ''
do update set
  user_id = excluded.user_id,
  membership_id = excluded.membership_id,
  nome = excluded.nome,
  cargo = excluded.cargo,
  ativo = true,
  updated_at = now();
