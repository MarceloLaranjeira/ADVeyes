-- Remove políticas equivalentes criadas em etapas diferentes do histórico.
-- Mantém apenas as políticas granulares mais recentes.

drop policy if exists "owner_crud_clientes" on public.clientes;
drop policy if exists "owner_crud_processos" on public.processos;
drop policy if exists "owner_crud_financeiro" on public.financeiro;
drop policy if exists "owner_crud_eventos" on public.eventos;
drop policy if exists "owner_crud_documentos" on public.documentos;
drop policy if exists "owner_crud_audiencias" on public.audiencias;
drop policy if exists "owner_crud_tarefas" on public.tarefas;
drop policy if exists "owner_crud_honorario_parcelas" on public.honorario_parcelas;
drop policy if exists "owner_crud_portal_acessos" on public.portal_acessos;

drop policy if exists "Users can CRUD own credentials" on public.tribunal_credenciais;
drop policy if exists "Users can CRUD own monitoramento" on public.processo_monitoramento;

-- service_role ignora RLS; políticas baseadas em auth.role() são redundantes.
drop policy if exists "Service role can read send log" on public.email_send_log;
drop policy if exists "Service role can insert send log" on public.email_send_log;
drop policy if exists "Service role can update send log" on public.email_send_log;
drop policy if exists "Service role can manage send state" on public.email_send_state;
drop policy if exists "Service role can read suppressed emails" on public.suppressed_emails;
drop policy if exists "Service role can insert suppressed emails" on public.suppressed_emails;
drop policy if exists "Service role can read tokens" on public.email_unsubscribe_tokens;
drop policy if exists "Service role can insert tokens" on public.email_unsubscribe_tokens;
drop policy if exists "Service role can mark tokens as used" on public.email_unsubscribe_tokens;

-- Evita reavaliar auth.uid() para cada linha sem mudar a autorização.
do $$
declare
  policy_row record;
  clauses text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        position('auth.uid()' in coalesce(qual, '')) > 0
        or position('auth.uid()' in coalesce(with_check, '')) > 0
      )
  loop
    clauses := '';

    if policy_row.qual is not null then
      clauses := clauses || ' using (' ||
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())') || ')';
    end if;

    if policy_row.with_check is not null then
      clauses := clauses || ' with check (' ||
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())') || ')';
    end if;

    execute format(
      'alter policy %I on %I.%I%s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      clauses
    );
  end loop;
end;
$$;
