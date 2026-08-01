-- Identidade visual editável por escritório: logo própria e cores.
-- A leitura é pública porque a marca aparece antes do login; a escrita exige
-- vínculo ativo com papel de proprietário ou administrador do escritório.

begin;

insert into storage.buckets (id, name, public)
values ('marca-escritorio', 'marca-escritorio', true)
on conflict (id) do nothing;

-- O primeiro segmento do caminho é sempre o tenant_id, o que mantém o
-- isolamento entre escritórios dentro do mesmo bucket.
create policy "marca_escritorio_leitura_publica"
on storage.objects
for select
to public
using (bucket_id = 'marca-escritorio');

create policy "marca_escritorio_insercao_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marca-escritorio'
  and private.has_tenant_permission(
    ((storage.foldername(name))[1])::uuid,
    'brand',
    'manage'
  )
);

create policy "marca_escritorio_atualizacao_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'marca-escritorio'
  and private.has_tenant_permission(
    ((storage.foldername(name))[1])::uuid,
    'brand',
    'manage'
  )
)
with check (
  bucket_id = 'marca-escritorio'
  and private.has_tenant_permission(
    ((storage.foldername(name))[1])::uuid,
    'brand',
    'manage'
  )
);

create policy "marca_escritorio_remocao_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marca-escritorio'
  and private.has_tenant_permission(
    ((storage.foldername(name))[1])::uuid,
    'brand',
    'manage'
  )
);

alter table public.tenant_brand_settings enable row level security;

create policy tenant_brand_settings_tenant_read
on public.tenant_brand_settings
for select
to authenticated
using (private.is_active_tenant_member(tenant_id, auth.uid()));

create policy tenant_brand_settings_admin_write
on public.tenant_brand_settings
for update
to authenticated
using (private.has_tenant_permission(tenant_id, 'brand', 'manage'))
with check (private.has_tenant_permission(tenant_id, 'brand', 'manage'));

create policy tenant_brand_settings_admin_create
on public.tenant_brand_settings
for insert
to authenticated
with check (private.has_tenant_permission(tenant_id, 'brand', 'manage'));

revoke all privileges on table public.tenant_brand_settings
from anon, authenticated;

grant select, insert, update on table public.tenant_brand_settings
to authenticated;

grant all privileges on table public.tenant_brand_settings to service_role;

comment on column public.tenant_brand_settings.color_tokens is
  'Cores da identidade do escritório. Sem valor definido, vale a paleta ADVeyes.';

commit;
