-- Promocao do Dr. Natan Cavalcante ao Plano Parceiro e liberacao de acessos.
--
-- O Dr. Natan esta ajudando a construir o sistema e recebe o Plano Parceiro:
-- teto de 50 usuarios, processos e termos ampliados, creditos de IA e
-- assinatura ativa sem trava de assentos do teste gratuito (pilot_seat_limit).

begin;

do $$
declare
  v_partner_plan_id uuid;
  v_tenant_record record;
  v_count integer := 0;
begin
  -- 1. Obter o plano parceiro ativo no catalogo
  select plan.id
  into v_partner_plan_id
  from public.billing_plans plan
  where plan.code = 'parceiro'
    and plan.is_active
    and plan.retired_at is null
  order by plan.version desc
  limit 1;

  if v_partner_plan_id is null then
    raise notice 'Plano parceiro ausente no catalogo deste ambiente: operacao ignorada.';
    return;
  end if;

  -- 2. Localizar escritorio(s) associado(s) ao Dr. Natan Cavalcante
  for v_tenant_record in
    select distinct tenant.id as tenant_id, tenant.display_name
    from public.tenants tenant
    left join public.tenant_memberships membership on membership.tenant_id = tenant.id
    left join auth.users account on account.id = membership.user_id
    left join public.equipe prof on prof.tenant_id = tenant.id
    where tenant.display_name ilike '%natan%'
       or tenant.legal_name ilike '%natan%'
       or tenant.slug ilike '%natan%'
       or tenant.display_name ilike '%cavalcante%'
       or tenant.legal_name ilike '%cavalcante%'
       or prof.nome ilike '%natan%'
       or prof.email ilike '%natan%'
       or prof.nome ilike '%cavalcante%'
       or account.email ilike '%natan%'
       or account.email ilike '%cavalcante%'
       or (account.raw_user_meta_data->>'full_name') ilike '%natan%'
       or (account.raw_user_meta_data->>'nome') ilike '%natan%'
  loop
    v_count := v_count + 1;
    raise notice 'Atualizando escritorio % (%) para Plano Parceiro.', v_tenant_record.display_name, v_tenant_record.tenant_id;

    -- A. Atualizar assinatura para 'parceiro' e status 'active' (removendo trial)
    insert into public.tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      billing_cycle,
      price_snapshot,
      trial_ends_at,
      canceled_at,
      created_at,
      updated_at
    ) values (
      v_tenant_record.tenant_id,
      v_partner_plan_id,
      'active',
      'annual',
      jsonb_build_object('plan_code', 'parceiro', 'price_cents', 109900),
      null,
      null,
      now(),
      now()
    )
    on conflict (tenant_id)
    do update set
      plan_id = v_partner_plan_id,
      status = 'active',
      billing_cycle = 'annual',
      trial_ends_at = null,
      canceled_at = null,
      price_snapshot = jsonb_build_object('plan_code', 'parceiro', 'price_cents', 109900),
      updated_at = now();

    -- B. Garantir que o Dr. Natan possua autoridade total de proprietario (owner)
    update public.tenant_memberships membership
    set
      role = 'owner',
      status = 'active',
      data_scope = 'tenant',
      permission_overrides = '{}'::jsonb,
      suspended_at = null,
      removed_at = null,
      activated_at = coalesce(membership.activated_at, now()),
      updated_at = now()
    from auth.users account
    where membership.tenant_id = v_tenant_record.tenant_id
      and membership.user_id = account.id
      and (
        account.email ilike '%natan%'
        or account.email ilike '%cavalcante%'
        or (account.raw_user_meta_data->>'full_name') ilike '%natan%'
        or (account.raw_user_meta_data->>'nome') ilike '%natan%'
        or membership.role = 'owner'
      );

    -- C. Revogar convites com erro de tentativa anterior para liberar fila limpa
    update public.tenant_invitations invitation
    set
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
    where invitation.tenant_id = v_tenant_record.tenant_id
      and invitation.status = 'pending'
      and invitation.expires_at <= now();

    -- D. Registrar evento de auditoria
    insert into public.tenant_audit_events (
      tenant_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    ) values (
      v_tenant_record.tenant_id,
      null,
      'subscription.partner_promoted',
      'tenant_subscription',
      v_tenant_record.tenant_id::text,
      jsonb_build_object(
        'plan', 'parceiro',
        'reason', 'Dr. Natan promovido a parceiro e construtor do sistema',
        'source', 'controlled_migration'
      )
    );
  end loop;

  if v_count = 0 then
    raise notice 'Nenhum escritorio associado a Natan Cavalcante encontrado neste ambiente.';
  else
    raise notice 'Total de escritorios promovidos a Parceiro: %', v_count;
  end if;
end;
$$;

commit;
