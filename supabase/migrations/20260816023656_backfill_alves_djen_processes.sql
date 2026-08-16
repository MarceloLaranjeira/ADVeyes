begin;

-- O executor de migrações recebe a permissão apenas durante esta transação.
-- A função continua inacessível às sessões normais ao final do backfill.
grant execute on function public.confirm_discovered_process(
  uuid, uuid, uuid, text, boolean
) to supabase_admin;

do $$
declare
  candidate record;
  actor_user_id uuid;
begin
  for candidate in
    select discovery.id, discovery.tenant_id, discovery.lawyer_registration_id
    from public.process_discoveries discovery
    join public.tenants tenant on tenant.id = discovery.tenant_id
    where tenant.slug = 'alves-e-quirino-advogados-associados'
      and discovery.provider = 'djen'
      and discovery.state = 'candidate'
    order by discovery.created_at, discovery.id
  loop
    select coalesce(
      professional.user_id,
      registration.created_by,
      (
        select membership.user_id
        from public.tenant_memberships membership
        where membership.tenant_id = candidate.tenant_id
          and membership.status = 'active'
          and membership.role in ('owner', 'admin')
        order by membership.created_at
        limit 1
      )
    )
    into actor_user_id
    from public.lawyer_registrations registration
    left join public.equipe professional
      on professional.tenant_id = registration.tenant_id
     and professional.id = registration.professional_id
    where registration.tenant_id = candidate.tenant_id
      and registration.id = candidate.lawyer_registration_id;

    if actor_user_id is not null then
      perform *
      from public.confirm_discovered_process(
        candidate.tenant_id,
        candidate.id,
        actor_user_id,
        'DIARIA',
        true
      );
    end if;
  end loop;
end;
$$;

revoke execute on function public.confirm_discovered_process(
  uuid, uuid, uuid, text, boolean
) from supabase_admin;

commit;
