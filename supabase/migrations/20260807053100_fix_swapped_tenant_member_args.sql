-- Corrige a ordem dos argumentos em cinco policies de RLS.
--
-- A função é declarada como:
--
--   private.is_active_tenant_member(p_user_id uuid, p_tenant_id uuid)
--
-- Cinco policies chamavam `is_active_tenant_member(tenant_id, auth.uid())`,
-- com os argumentos trocados. Como os dois parâmetros são uuid, o Postgres
-- aceita sem reclamar: a chamada procura uma associação em que o usuário
-- seja o escritório e o escritório seja o usuário. Isso nunca é verdade.
--
-- O efeito é falhar fechado, não vazar dado — mas fecha demais:
--
--   notification_preferences — a tela de Configurações lê e grava direto na
--     tabela. Com a policy sempre falsa, ninguém consegue ler nem salvar as
--     próprias preferências de notificação. A funcionalidade está no ar e
--     não funciona.
--
--   tenant_brand_settings — hoje o frontend passa pela Edge Function
--     `tenant-brand-settings`, que usa service role e não é barrada pela
--     RLS. O defeito está latente: qualquer acesso direto futuro falharia
--     sem explicação.
--
-- Esta migração só recria as policies afetadas. Nenhuma tabela, coluna,
-- função ou dado é alterado, e a semântica pretendida é preservada.

begin;

/* ---------------------------------------------------------------- */
/* notification_preferences                                          */
/* ---------------------------------------------------------------- */

drop policy if exists notification_preferences_self_read
  on public.notification_preferences;
drop policy if exists notification_preferences_self_write
  on public.notification_preferences;
drop policy if exists notification_preferences_self_update
  on public.notification_preferences;

create policy notification_preferences_self_read
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

create policy notification_preferences_self_write
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

create policy notification_preferences_self_update
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
)
with check (
  user_id = auth.uid()
  and private.is_active_tenant_member(auth.uid(), tenant_id)
);

/* ---------------------------------------------------------------- */
/* tenant_brand_settings                                             */
/* ---------------------------------------------------------------- */

drop policy if exists tenant_brand_settings_tenant_read
  on public.tenant_brand_settings;

create policy tenant_brand_settings_tenant_read
on public.tenant_brand_settings
for select
to authenticated
using (private.is_active_tenant_member(auth.uid(), tenant_id));

commit;
