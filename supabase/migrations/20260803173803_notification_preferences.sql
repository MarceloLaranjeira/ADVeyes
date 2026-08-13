-- Preferências de notificação por pessoa.
--
-- Os interruptores da tela de Configurações eram decorativos: não gravavam
-- em lugar nenhum e voltavam ao padrão ao sair da tela. Agora existem de
-- verdade, por usuário e por escritório.
--
-- Regra de destinatário aprovada: o alerta vai para o profissional dono da
-- OAB que trouxe o processo. Autônomo recebe o próprio; escritório entrega a
-- quem tem a OAB cadastrada naquele processo.

begin;

create table public.notification_preferences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'publication_new',
      'movement_new',
      'deadline_near',
      'hearing_near'
    )
  ),
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id, event_type)
);

create index notification_preferences_user_idx
  on public.notification_preferences (user_id, tenant_id);

create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function private.touch_tenant_updated_at();

alter table public.notification_preferences enable row level security;

-- Cada pessoa controla as próprias preferências, dentro do escritório ativo.
create policy notification_preferences_self_read
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and private.is_active_tenant_member(tenant_id, auth.uid())
);

create policy notification_preferences_self_write
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.is_active_tenant_member(tenant_id, auth.uid())
);

create policy notification_preferences_self_update
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and private.is_active_tenant_member(tenant_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and private.is_active_tenant_member(tenant_id, auth.uid())
);

revoke all privileges on table public.notification_preferences
from anon, authenticated;

grant select, insert, update on table public.notification_preferences
to authenticated;

grant all privileges on table public.notification_preferences to service_role;

/**
 * Resolve quem deve ser avisado sobre um processo.
 *
 * Ordem: profissional dono da OAB vinculada ao processo; se não houver,
 * o responsável pelo processo; em último caso, o proprietário do escritório.
 * Assim o autônomo recebe o próprio alerta e o escritório entrega a quem
 * tem a OAB cadastrada, sem espalhar para a equipe inteira.
 */
create or replace function public.notification_recipients_server(
  p_tenant_id uuid,
  p_process_id uuid
)
returns table(user_id uuid, email text, source text)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  return query
  select distinct
    membership.user_id,
    professional.email,
    'oab'::text
  from public.process_lawyers link
  join public.lawyer_registrations registration
    on registration.tenant_id = link.tenant_id
   and registration.id = link.lawyer_registration_id
  join public.equipe professional
    on professional.tenant_id = registration.tenant_id
   and professional.id = registration.professional_id
  join public.tenant_memberships membership
    on membership.tenant_id = professional.tenant_id
   and membership.id = professional.membership_id
   and membership.status = 'active'
  where link.tenant_id = p_tenant_id
    and link.process_id = p_process_id;

  if found then
    return;
  end if;

  return query
  select
    membership.user_id,
    professional.email,
    'assigned'::text
  from public.processos process
  join public.tenant_memberships membership
    on membership.tenant_id = process.tenant_id
   and membership.user_id = process.user_id
   and membership.status = 'active'
  left join public.equipe professional
    on professional.tenant_id = membership.tenant_id
   and professional.membership_id = membership.id
  where process.tenant_id = p_tenant_id
    and process.id = p_process_id;

  if found then
    return;
  end if;

  return query
  select
    membership.user_id,
    professional.email,
    'owner'::text
  from public.tenant_memberships membership
  left join public.equipe professional
    on professional.tenant_id = membership.tenant_id
   and professional.membership_id = membership.id
  where membership.tenant_id = p_tenant_id
    and membership.role = 'owner'
    and membership.status = 'active';
end;
$$;

revoke all on function public.notification_recipients_server(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notification_recipients_server(uuid, uuid)
  to service_role;

comment on table public.notification_preferences is
  'Preferências reais de notificação; substitui os interruptores decorativos.';

commit;
