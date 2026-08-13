-- Restaura o acesso do escritório aos próprios dados e prepara tarefas para
-- trabalho em equipe.
--
-- ── O defeito ───────────────────────────────────────────────────────────────
-- As políticas criadas em 20260729011540 (tenant_v1) e 20260729014626
-- (tenant_v2) chamam `private.can_access_tenant_record` passando o NOME DA
-- TABELA no parâmetro que a função lê como MÓDULO:
--
--     can_access_tenant_record(auth.uid(), tenant_id, 'processos', id)
--                                                     ^^^^^^^^^^^
--
-- A função só reconhece os módulos 'legal', 'finance', 'contracts' e
-- 'reports'. Recebendo 'processos', 'clientes', 'documentos' ou
-- 'time_entries', ela cai no `return false` final — para o dono, para o
-- admin, para o advogado, para todos.
--
-- Como a mesma migração derrubou as políticas antigas antes de criar essas,
-- o resultado é que ninguém lê nada: processo, cliente, evento, tarefa,
-- audiência, documento e apontamento de hora ficaram invisíveis para o
-- próprio escritório que os criou. É por isso que o painel mostra zero em
-- todos os cartões enquanto as linhas estão lá no banco.
--
-- ── A correção ──────────────────────────────────────────────────────────────
-- As políticas passam a exigir apenas `has_tenant_permission`, com o mesmo
-- módulo que já usavam. A condição por registro sai de cena porque, além de
-- estar quebrada, ela nega acesso a quem tem `data_scope` diferente de
-- 'tenant' — e 'assigned' é o padrão de `tenant_memberships`. Mantê-la,
-- mesmo corrigida, esconderia tudo de todo advogado recém-convidado.
--
-- Ou seja: a visibilidade é do escritório. Restrição por registro volta
-- quando existir o mapa de atribuição que a própria função diz esperar
-- ("Team and assigned access stays denied until the module has an explicit
-- assignment mapping").

begin;

-- ─── Políticas por escritório ───────────────────────────────────────────────

do $$
declare
  alvo record;
begin
  for alvo in
    select *
    from (values
      -- tabela,               módulo que a política já usava
      ('clientes',             'legal'),
      ('processos',            'legal'),
      ('eventos',              'legal'),
      ('tarefas',              'legal'),
      ('audiencias',           'legal'),
      ('documentos',           'legal'),
      ('documentos_gerados',   'contracts'),
      ('time_entries',         'finance')
    ) as t(tabela, modulo)
  loop
    -- Gerações anteriores, todas substituídas aqui.
    execute format('drop policy if exists tenant_v1_select on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v1_insert on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v1_update on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v1_delete on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v2_select on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v2_insert on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v2_update on public.%I', alvo.tabela);
    execute format('drop policy if exists tenant_v2_delete on public.%I', alvo.tabela);
    execute format('drop policy if exists %I on public.%I',
      'Users can select own ' || alvo.tabela, alvo.tabela);
    execute format('drop policy if exists %I on public.%I',
      'Users can insert own ' || alvo.tabela, alvo.tabela);
    execute format('drop policy if exists %I on public.%I',
      'Users can update own ' || alvo.tabela, alvo.tabela);
    execute format('drop policy if exists %I on public.%I',
      'Users can delete own ' || alvo.tabela, alvo.tabela);
    execute format('drop policy if exists %I on public.%I',
      'owner_crud_' || alvo.tabela, alvo.tabela);

    execute format(
      'create policy tenant_read on public.%I
         for select to authenticated
         using (private.has_tenant_permission(tenant_id, %L, ''read''))',
      alvo.tabela, alvo.modulo
    );

    execute format(
      'create policy tenant_insert on public.%I
         for insert to authenticated
         with check (
           private.has_tenant_permission(tenant_id, %L, ''create'')
           and private.is_active_tenant_member(auth.uid(), tenant_id)
         )',
      alvo.tabela, alvo.modulo
    );

    execute format(
      'create policy tenant_update on public.%I
         for update to authenticated
         using (private.has_tenant_permission(tenant_id, %L, ''update''))
         with check (private.has_tenant_permission(tenant_id, %L, ''update''))',
      alvo.tabela, alvo.modulo, alvo.modulo
    );

    -- Exclusão continua estreita: em 'legal' ela é do dono; em 'finance' e
    -- 'contracts', de quem a função já autorizava.
    execute format(
      'create policy tenant_delete on public.%I
         for delete to authenticated
         using (private.has_tenant_permission(tenant_id, %L, ''delete''))',
      alvo.tabela, alvo.modulo
    );
  end loop;
end;
$$;

-- ─── Linhas órfãs ───────────────────────────────────────────────────────────
-- Sem escritório, a linha não passa por nenhuma política acima e continuaria
-- invisível. Herda o vínculo ativo de quem a criou.

update public.processos as alvo
set tenant_id = vinculo.tenant_id
from public.tenant_memberships as vinculo
where alvo.tenant_id is null
  and vinculo.user_id = alvo.user_id
  and vinculo.status = 'active';

update public.tarefas as alvo
set tenant_id = vinculo.tenant_id
from public.tenant_memberships as vinculo
where alvo.tenant_id is null
  and vinculo.user_id = alvo.user_id
  and vinculo.status = 'active';

-- ─── Tarefas de equipe ──────────────────────────────────────────────────────

-- Quem executa deixa de ser inferido de quem criou. Sem isso não há avatar no
-- cartão, fila por pessoa nem produtividade por advogado.
alter table public.tarefas
  add column if not exists responsavel_id uuid references auth.users(id);

-- Liga a tarefa ao processo: é o que põe o número CNJ no cartão.
alter table public.tarefas
  add column if not exists processo_id uuid
  references public.processos(id) on delete set null;

-- Sem data de conclusão não existe "concluídas hoje", gráfico semanal nem
-- progresso do mês: o status sozinho não diz *quando* terminou.
alter table public.tarefas
  add column if not exists concluida_em timestamptz;

update public.tarefas
set responsavel_id = user_id
where responsavel_id is null;

-- Tarefas já concluídas não têm quando. `created_at` é o melhor registro
-- existente e evita que o histórico apareça como concluído hoje.
update public.tarefas
set concluida_em = created_at
where concluida_em is null
  and status = 'concluída';

-- A data de conclusão não pode depender de cada tela lembrar de gravá-la: a
-- tarefa muda de status pelo arrastar do cartão, pelo formulário e por
-- integração. O banco é o único ponto por onde todos passam.
create or replace function private.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluída'
     and coalesce(old.status, '') is distinct from 'concluída' then
    new.concluida_em := now();
  elsif new.status is distinct from 'concluída' then
    new.concluida_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tarefas_stamp_completion on public.tarefas;

create trigger tarefas_stamp_completion
before insert or update of status on public.tarefas
for each row execute function private.stamp_task_completion();

-- ─── Índices para as telas de equipe ────────────────────────────────────────

create index if not exists processos_tenant_created_idx
  on public.processos (tenant_id, created_at desc);

create index if not exists tarefas_tenant_status_idx
  on public.tarefas (tenant_id, status, data_limite);

create index if not exists tarefas_responsavel_idx
  on public.tarefas (tenant_id, responsavel_id);

create index if not exists tarefas_concluida_em_idx
  on public.tarefas (tenant_id, concluida_em desc)
  where concluida_em is not null;

comment on column public.tarefas.responsavel_id is
  'Quem executa a tarefa. Distinto de user_id, que é quem a criou.';
comment on column public.tarefas.concluida_em is
  'Preenchido pelo gatilho quando o status vira concluída; limpo se reabrir.';

commit;
