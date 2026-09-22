-- Notificação precisa sobreviver ao navegador.
--
-- O painel lia de `localStorage`: o realtime entregava o INSERT, o componente
-- guardava no navegador e nunca consultava a tabela. Três consequências, todas
-- silenciosas:
--
--   * notificação criada com a aba fechada nunca era vista — o realtime só
--     entrega a quem está conectado no instante do INSERT, e um prazo avisado
--     de madrugada simplesmente sumia;
--   * trocar de navegador ou de máquina zerava a caixa;
--   * "marcar como lida" não saía do dispositivo, então o contador de não
--     lidas divergia entre telas do mesmo usuário.
--
-- Esta migração dá à tabela o que falta para ela ser a fonte da verdade.

-- Quando foi lida, não só se foi. Sem o instante não dá para ordenar, auditar
-- nem responder "o advogado viu isso antes do prazo vencer?".
alter table public.notificacoes
  add column if not exists lida_em timestamptz,
  add column if not exists arquivada_em timestamptz;

-- Preenche o histórico: o que já estava marcado como lido ganha um instante
-- aproximado em vez de ficar nulo e parecer não lido na nova consulta.
update public.notificacoes
set lida_em = coalesce(lida_em, created_at)
where lida is true and lida_em is null;

-- O browser inicia a mutação, mas o instante auditável vem do banco. Relógio
-- do dispositivo pode estar adiantado, atrasado ou ser alterado pelo usuário;
-- um prazo precisa registrar quando o servidor recebeu a leitura.
create or replace function public.set_notificacao_audit_timestamps()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- Depois do primeiro registro, timestamps de auditoria são imutáveis. Uma
  -- aba stale não pode substituir o instante original pelo relógio local.
  if old.lida_em is not null then
    new.lida_em := old.lida_em;
  elsif new.lida is true and old.lida is distinct from true then
    new.lida_em := statement_timestamp();
  end if;

  if old.arquivada_em is not null then
    new.arquivada_em := old.arquivada_em;
  elsif new.arquivada_em is not null then
    new.arquivada_em := statement_timestamp();
  end if;

  return new;
end;
$$;

drop trigger if exists notificacoes_audit_timestamps
  on public.notificacoes;

create trigger notificacoes_audit_timestamps
before update of lida, lida_em, arquivada_em
on public.notificacoes
for each row
execute function public.set_notificacao_audit_timestamps();

-- A consulta do painel é sempre a mesma: as notificações não arquivadas de um
-- usuário, mais recentes primeiro. Sem este índice ela vira varredura completa
-- assim que a tabela crescer.
create index if not exists notificacoes_user_recentes_idx
  on public.notificacoes (user_id, created_at desc)
  where arquivada_em is null;

-- As policies `tenant_v2_*` já protegem as linhas modernas com tenant:
--   * SELECT/UPDATE/DELETE exigem usuário dono + membership ativa;
--   * INSERT exige também a permissão legal.create.
--
-- Não criamos uma policy FOR ALL: policies permissivas são combinadas com OR,
-- e isso ampliaria INSERT para qualquer membro ativo, contornando legal.create.
-- O que falta é somente compatibilidade com o histórico anterior ao
-- multi-tenant (`tenant_id is null`), restrita a leitura e atualização pelo
-- próprio dono. INSERT e DELETE legados continuam sem permissão de browser.
drop policy if exists "Users can CRUD own notificacoes" on public.notificacoes;
drop policy if exists "notificacoes_scoped_to_user_and_tenant" on public.notificacoes;
drop policy if exists "notificacoes_legacy_select" on public.notificacoes;
drop policy if exists "notificacoes_legacy_update" on public.notificacoes;

create policy "notificacoes_legacy_select"
  on public.notificacoes
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and tenant_id is null
  );

create policy "notificacoes_legacy_update"
  on public.notificacoes
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and tenant_id is null
  )
  with check (
    auth.uid() = user_id
    and tenant_id is null
  );
