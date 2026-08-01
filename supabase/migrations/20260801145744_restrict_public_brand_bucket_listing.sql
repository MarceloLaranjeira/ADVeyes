begin;

drop policy if exists "marca_escritorio_leitura_publica"
on storage.objects;

-- Public object URLs continue to work because the bucket itself is public.
-- Data API listing is restricted to people who can manage that tenant brand.
create policy "marca_escritorio_leitura_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'marca-escritorio'
  and private.has_tenant_permission(
    ((storage.foldername(name))[1])::uuid,
    'brand',
    'manage'
  )
);

commit;
