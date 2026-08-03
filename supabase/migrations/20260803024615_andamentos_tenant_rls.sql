-- Andamentos manuais passam a pertencer ao escritório, não ao usuário que
-- digitou. A política antiga (`auth.uid() = user_id`) escondia de cada membro
-- os registros feitos pelos colegas do mesmo escritório.
--
-- Registros de origem oficial (DataJud, DJEN, Escavador) não podem ser
-- editados nem apagados: eles voltariam na próxima sincronização e a
-- divergência ficaria invisível.

begin;

update public.andamentos as movement
set tenant_id = process.tenant_id
from public.processos as process
where movement.tenant_id is null
  and movement.processo_id = process.id
  and process.tenant_id is not null;

drop policy if exists "users_own_andamentos" on public.andamentos;

create policy andamentos_tenant_read
on public.andamentos
for select
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy andamentos_tenant_insert
on public.andamentos
for insert
to authenticated
with check (
  private.has_tenant_permission(tenant_id, 'legal', 'create')
  and user_id = auth.uid()
  and origem = 'manual'
);

create policy andamentos_tenant_update
on public.andamentos
for update
to authenticated
using (
  origem = 'manual'
  and private.has_tenant_permission(tenant_id, 'legal', 'update')
)
with check (
  origem = 'manual'
  and private.has_tenant_permission(tenant_id, 'legal', 'update')
);

-- Quem escreveu pode apagar a própria anotação; apagar a de outra pessoa
-- exige a permissão de exclusão jurídica.
create policy andamentos_tenant_delete
on public.andamentos
for delete
to authenticated
using (
  origem = 'manual'
  and (
    user_id = auth.uid()
    or private.has_tenant_permission(tenant_id, 'legal', 'delete')
  )
);

revoke all privileges on table public.andamentos from anon, authenticated;

grant select, insert, update, delete on table public.andamentos
to authenticated;

grant all privileges on table public.andamentos to service_role;

create index if not exists andamentos_tenant_processo_idx
  on public.andamentos (tenant_id, processo_id, data_andamento desc);

comment on table public.andamentos is
  'Andamentos do escritório. Manuais são editáveis; oficiais são somente leitura.';

commit;
