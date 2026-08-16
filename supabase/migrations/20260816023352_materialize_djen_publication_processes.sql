begin;

-- O DJEN é fonte oficial suficiente para comprovar a existência do processo.
alter table public.process_discoveries
  drop constraint if exists process_discoveries_provider_check;
alter table public.process_discoveries
  add constraint process_discoveries_provider_check
  check (provider in ('escavador', 'datajud', 'djen'));

-- Ao criar o processo, liga também as intimações que chegaram antes dele.
-- Isso corrige o histórico e mantém as próximas ingestões idempotentes.
create index if not exists publicacoes_tenant_process_number_unlinked_idx
  on public.publicacoes (tenant_id, numero_processo)
  where process_id is null and numero_processo is not null;

create or replace function private.link_publications_to_process()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.publicacoes publication
  set
    process_id = new.id,
    user_id = coalesce(publication.user_id, new.user_id),
    cliente_nome = coalesce(publication.cliente_nome, new.cliente_nome)
  where publication.tenant_id = new.tenant_id
    and publication.numero_processo = new.numero
    and publication.process_id is null;
  return new;
end;
$$;

revoke all on function private.link_publications_to_process()
from public, anon, authenticated;

drop trigger if exists processos_link_existing_publications on public.processos;
create trigger processos_link_existing_publications
after insert or update of numero on public.processos
for each row execute function private.link_publications_to_process();

-- Recupera publicações oficiais antigas. O vínculo com a inscrição é feito
-- pela OAB declarada pelo próprio DJEN, sem inferir escritórios ou clientes.
insert into public.process_discoveries (
  tenant_id,
  lawyer_registration_id,
  numero_cnj,
  provider,
  state,
  title_active_party,
  title_passive_party,
  tribunal,
  court_unit,
  last_movement_at,
  provider_fetched_at,
  provider_payload
)
select distinct on (
  publication.tenant_id,
  registration.id,
  publication.numero_processo
)
  publication.tenant_id,
  registration.id,
  publication.numero_processo,
  'djen',
  'candidate',
  (
    select recipient ->> 'nome'
    from jsonb_array_elements(coalesce(publication.recipients, '[]'::jsonb)) recipient
    where recipient ->> 'polo' = 'A'
    limit 1
  ),
  (
    select recipient ->> 'nome'
    from jsonb_array_elements(coalesce(publication.recipients, '[]'::jsonb)) recipient
    where recipient ->> 'polo' = 'P'
    limit 1
  ),
  publication.tribunal,
  publication.court_body,
  publication.data_publicacao,
  now(),
  publication.provider_payload
from public.publicacoes publication
join public.lawyer_registrations registration
  on registration.tenant_id = publication.tenant_id
 and registration.status not in ('disabled', 'invalid')
 and exists (
   select 1
   from jsonb_array_elements(coalesce(publication.recipient_lawyers, '[]'::jsonb)) recipient_lawyer
   where regexp_replace(
       coalesce(recipient_lawyer #>> '{advogado,numero_oab}', ''),
       '[^0-9]', '', 'g'
     ) = registration.oab_number
     and upper(coalesce(recipient_lawyer #>> '{advogado,uf_oab}', '')) = registration.oab_state
 )
where publication.provider = 'djen'
  and publication.process_id is null
  and publication.numero_processo ~ '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$'
order by
  publication.tenant_id,
  registration.id,
  publication.numero_processo,
  publication.data_publicacao desc,
  publication.id desc
on conflict (tenant_id, lawyer_registration_id, numero_cnj, provider)
do nothing;

comment on function private.link_publications_to_process() is
  'Vincula retroativamente intimações oficiais ao processo materializado no mesmo escritório.';

commit;
