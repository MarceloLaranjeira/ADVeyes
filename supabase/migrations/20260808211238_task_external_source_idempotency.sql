alter table public.tarefas
  add column source_type text,
  add column source_id uuid,
  add constraint tarefas_source_pair_valid check (
    (source_type is null and source_id is null)
    or
    (source_type is not null and source_id is not null
      and length(btrim(source_type)) between 2 and 40)
  );

create unique index tarefas_external_source_uidx
  on public.tarefas (tenant_id, source_type, source_id)
  where source_type is not null and source_id is not null;

comment on column public.tarefas.source_type is
  'Tipo da origem automática; usado com source_id para impedir tarefas duplicadas.';
