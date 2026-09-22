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

-- A consulta do painel é sempre a mesma: as notificações não arquivadas de um
-- usuário, mais recentes primeiro. Sem este índice ela vira varredura completa
-- assim que a tabela crescer.
create index if not exists notificacoes_user_recentes_idx
  on public.notificacoes (user_id, created_at desc)
  where arquivada_em is null;

-- A política original isolava por usuário (auth.uid() = user_id), o que já
-- impede um advogado de ler a caixa de outro. Falta o recorte de tenant: sem
-- ele, um usuário que atua em dois escritórios vê as duas caixas misturadas na
-- mesma tela, e uma notificação de um cliente aparece no contexto do outro.
--
-- `private.is_active_tenant_member` é o mesmo helper que as demais políticas
-- do projeto usam para esse recorte — reaproveitá-lo mantém uma definição só
-- de "membro ativo". Linha sem tenant_id continua visível: é o histórico
-- anterior ao multi-tenant, que pertence ao usuário e não a um escritório.
drop policy if exists "Users can CRUD own notificacoes" on public.notificacoes;

create policy "notificacoes_scoped_to_user_and_tenant"
  on public.notificacoes
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and (
      tenant_id is null
      or (select private.is_active_tenant_member(auth.uid(), tenant_id))
    )
  )
  with check (
    auth.uid() = user_id
    and (
      tenant_id is null
      or (select private.is_active_tenant_member(auth.uid(), tenant_id))
    )
  );
