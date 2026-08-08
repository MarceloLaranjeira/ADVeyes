begin;

-- A publicacao e a tarefa permanecem entidades independentes, mas este
-- vinculo explicito permite navegar entre elas e impede relacionamentos que
-- atravessem escritorios.
create table public.publication_task_links (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  publication_id uuid not null,
  task_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, publication_id),
  unique (tenant_id, task_id),
  foreign key (tenant_id, publication_id)
    references public.publicacoes(tenant_id, id) on delete cascade,
  foreign key (tenant_id, task_id)
    references public.tarefas(tenant_id, id) on delete cascade
);

create index publication_task_links_task_idx
  on public.publication_task_links (tenant_id, task_id);

create trigger publication_task_links_touch_updated_at
before update on public.publication_task_links
for each row execute function private.touch_tenant_updated_at();

alter table public.publication_task_links enable row level security;

revoke all on table public.publication_task_links from anon, authenticated;
grant select on table public.publication_task_links to authenticated;
grant all on table public.publication_task_links to service_role;

create policy publication_task_links_read
on public.publication_task_links
for select
to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

-- Preserva as tarefas automaticas criadas antes desta tabela existir.
insert into public.publication_task_links (
  tenant_id,
  publication_id,
  task_id
)
select task.tenant_id, task.source_id, task.id
from public.tarefas as task
join public.publicacoes as publication
  on publication.tenant_id = task.tenant_id
 and publication.id = task.source_id
where task.source_type = 'publicacao'
on conflict do nothing;

-- Durante o trial, o escritorio pode ter o proprietario e mais uma pessoa.
-- A trava por tenant torna a contagem segura mesmo com convites simultaneos.
create or replace function private.enforce_trial_seat_limit()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  occupied_seats integer;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.tenant_id::text, 0)
  );

  if exists (
    select 1
    from public.tenant_subscriptions as subscription
    where subscription.tenant_id = new.tenant_id
      and subscription.status = 'trialing'
      and subscription.trial_ends_at > pg_catalog.now()
  ) then
    select
      (select count(*)
       from public.tenant_memberships as membership
       where membership.tenant_id = new.tenant_id
         and membership.status = 'active')
      +
      (select count(*)
       from public.tenant_invitations as invitation
       where invitation.tenant_id = new.tenant_id
         and invitation.status = 'pending'
         and invitation.expires_at > pg_catalog.now())
    into occupied_seats;

    if occupied_seats >= 2 then
      raise exception using
        errcode = 'P0001',
        message = 'pilot_seat_limit';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_trial_seat_limit()
from public, anon, authenticated;

create trigger tenant_invitations_enforce_trial_seat_limit
before insert on public.tenant_invitations
for each row execute function private.enforce_trial_seat_limit();

comment on table public.publication_task_links is
  'Vinculo idempotente e isolado por tenant entre publicacao oficial e tarefa de revisao.';
comment on function private.enforce_trial_seat_limit() is
  'Limita o trial a dois assentos ocupados, incluindo convites pendentes validos.';

commit;
