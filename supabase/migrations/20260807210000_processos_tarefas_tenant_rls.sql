-- Processos e tarefas passam a pertencer ao escritório, não ao usuário que
-- digitou.
--
-- As duas tabelas ficaram para trás quando o sistema virou multi-tenant: a
-- coluna `tenant_id` foi adicionada e o gatilho passou a preenchê-la, mas as
-- políticas continuaram em `auth.uid() = user_id`. O efeito prático é que num
-- escritório com quatro advogados cada um enxerga apenas o que ele mesmo
-- criou — e um processo confirmado por um sócio some para os demais.
--
-- Isso também é o que impede qualquer tela de equipe: quadro de tarefas do
-- escritório, atribuição a um responsável e produtividade por pessoa só fazem
-- sentido quando a leitura é por escritório.
--
-- Escolha deliberada: a política usa apenas `has_tenant_permission(..., 'legal',
-- ...)`, sem `can_access_tenant_record`. Essa segunda função nega acesso a
-- quem tem `data_scope` diferente de 'tenant' — e 'assigned' é justamente o
-- padrão de `tenant_memberships`. Somá-la aqui esconderia todos os processos
-- de todo advogado recém-convidado, que é o oposto do objetivo. Enquanto não
-- houver mapa de atribuição por registro, a visibilidade é do escritório.

begin;

-- ─── Processos ──────────────────────────────────────────────────────────────

-- Linhas antigas sem escritório: herdam o do vínculo ativo de quem as criou.
-- Sem isso elas ficariam invisíveis para todo mundo depois da troca.
update public.processos as process
set tenant_id = membership.tenant_id
from public.tenant_memberships as membership
where process.tenant_id is null
  and membership.user_id = process.user_id
  and membership.status = 'active';

drop policy if exists "Users can select own processos" on public.processos;
drop policy if exists "Users can insert own processos" on public.processos;
drop policy if exists "Users can update own processos" on public.processos;
drop policy if exists "Users can delete own processos" on public.processos;
drop policy if exists "Auth users can CRUD processos" on public.processos;
drop policy if exists owner_crud_processos on public.processos;

create policy processos_tenant_read
on public.processos
for select
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy processos_tenant_insert
on public.processos
for insert
to authenticated
with check (
  private.has_tenant_permission(tenant_id, 'legal', 'create')
  and user_id = auth.uid()
);

create policy processos_tenant_update
on public.processos
for update
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

-- Apagar processo é irreversível e leva junto andamentos e documentos; fica
-- com quem tem a permissão de exclusão jurídica, hoje só o dono.
create policy processos_tenant_delete
on public.processos
for delete
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'delete'));

-- ─── Tarefas ────────────────────────────────────────────────────────────────

update public.tarefas as task
set tenant_id = membership.tenant_id
from public.tenant_memberships as membership
where task.tenant_id is null
  and membership.user_id = task.user_id
  and membership.status = 'active';

-- Quem executa deixa de ser inferido de quem criou. Sem isso não há avatar no
-- cartão, fila por pessoa nem produtividade por advogado.
alter table public.tarefas
  add column if not exists responsavel_id uuid references auth.users(id);

-- Tarefa ligada ao processo: é o que põe o número CNJ no cartão e permite ver
-- a fila de um processo específico.
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
-- existente e evita que o histórico apareça como se tivesse terminado hoje.
update public.tarefas
set concluida_em = created_at
where concluida_em is null
  and status = 'concluída';

drop policy if exists "Users can select own tarefas" on public.tarefas;
drop policy if exists "Users can insert own tarefas" on public.tarefas;
drop policy if exists "Users can update own tarefas" on public.tarefas;
drop policy if exists "Users can delete own tarefas" on public.tarefas;
drop policy if exists "Auth users can CRUD tarefas" on public.tarefas;
drop policy if exists owner_crud_tarefas on public.tarefas;

create policy tarefas_tenant_read
on public.tarefas
for select
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy tarefas_tenant_insert
on public.tarefas
for insert
to authenticated
with check (
  private.has_tenant_permission(tenant_id, 'legal', 'create')
  and user_id = auth.uid()
);

-- Atualizar inclui arrastar o cartão e reatribuir o responsável, que é
-- trabalho corriqueiro de equipe.
create policy tarefas_tenant_update
on public.tarefas
for update
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

-- Cada um apaga a própria tarefa; apagar a de outro exige exclusão jurídica.
create policy tarefas_tenant_delete
on public.tarefas
for delete
to authenticated
using (
  user_id = auth.uid()
  or private.has_tenant_permission(tenant_id, 'legal', 'delete')
);

-- ─── Conclusão registrada pelo banco ────────────────────────────────────────
-- A data de conclusão não pode depender de cada tela lembrar de gravá-la: a
-- tarefa muda de status pelo arrastar do cartão, pelo formulário e por
-- integração. O banco é o único ponto por onde todos passam.

create or replace function private.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'concluída' and coalesce(old.status, '') is distinct from 'concluída' then
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

comment on table public.processos is
  'Processos do escritório. Leitura por escritório, não por usuário.';
comment on column public.tarefas.responsavel_id is
  'Quem executa a tarefa. Distinto de user_id, que é quem a criou.';
comment on column public.tarefas.concluida_em is
  'Preenchido pelo gatilho quando o status vira concluída; limpo se reabrir.';

commit;
