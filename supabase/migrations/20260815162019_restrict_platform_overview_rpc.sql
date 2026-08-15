-- A Edge Function platform-admin chama esta RPC com service_role depois de
-- autenticar o usuário. Clientes autenticados não precisam executá-la direto.
revoke all on function public.platform_legal_overview_counts(uuid)
from public, anon, authenticated;
grant execute on function public.platform_legal_overview_counts(uuid)
to service_role;
