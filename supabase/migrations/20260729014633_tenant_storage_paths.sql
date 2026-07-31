create or replace function private.storage_path_tenant_id(p_name text)
returns uuid
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when split_part(p_name, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function private.storage_path_record_id(p_name text)
returns uuid
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when split_part(p_name, '/', 3)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 3)::uuid
    else null
  end;
$$;

create or replace function private.can_access_document_object(
  p_user_id uuid,
  p_tenant_id uuid,
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.documentos document
    where document.id = p_document_id
      and document.tenant_id = p_tenant_id
      and (
        private.can_access_tenant_record(
          p_user_id, p_tenant_id, 'documentos', document.id
        )
        or private.can_access_tenant_record(
          p_user_id, p_tenant_id, 'processos', document.processo_id
        )
      )
  );
$$;

revoke all on function private.storage_path_tenant_id(text)
  from public, anon;
revoke all on function private.storage_path_record_id(text)
  from public, anon;
revoke all on function private.can_access_document_object(
  uuid, uuid, uuid
) from public, anon;
grant execute on function private.storage_path_tenant_id(text)
  to authenticated, service_role;
grant execute on function private.storage_path_record_id(text)
  to authenticated, service_role;
grant execute on function private.can_access_document_object(
  uuid, uuid, uuid
) to authenticated, service_role;

drop policy if exists "Users can upload own docs" on storage.objects;
drop policy if exists "Users can view own docs" on storage.objects;
drop policy if exists "Users can delete own docs" on storage.objects;
drop policy if exists owner_view_docs on storage.objects;
drop policy if exists owner_delete_docs on storage.objects;
drop policy if exists tenant_documents_insert on storage.objects;
drop policy if exists tenant_documents_select on storage.objects;
drop policy if exists tenant_documents_update on storage.objects;
drop policy if exists tenant_documents_delete on storage.objects;

create policy tenant_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documentos'
  and split_part(name, '/', 2) = 'documentos'
  and private.storage_path_record_id(name) is not null
  and private.has_tenant_permission(
    private.storage_path_tenant_id(name), 'legal', 'create'
  )
  and private.is_active_tenant_member(
    auth.uid(), private.storage_path_tenant_id(name)
  )
);

create policy tenant_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'documentos'
  and split_part(name, '/', 2) = 'documentos'
  and private.has_tenant_permission(
    private.storage_path_tenant_id(name), 'legal', 'read'
  )
  and private.can_access_document_object(
    auth.uid(),
    private.storage_path_tenant_id(name),
    private.storage_path_record_id(name)
  )
);

create policy tenant_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'documentos'
  and split_part(name, '/', 2) = 'documentos'
  and private.has_tenant_permission(
    private.storage_path_tenant_id(name), 'legal', 'update'
  )
  and private.can_access_document_object(
    auth.uid(),
    private.storage_path_tenant_id(name),
    private.storage_path_record_id(name)
  )
)
with check (
  bucket_id = 'documentos'
  and split_part(name, '/', 2) = 'documentos'
  and private.has_tenant_permission(
    private.storage_path_tenant_id(name), 'legal', 'update'
  )
  and private.can_access_document_object(
    auth.uid(),
    private.storage_path_tenant_id(name),
    private.storage_path_record_id(name)
  )
);

create policy tenant_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'documentos'
  and split_part(name, '/', 2) = 'documentos'
  and private.has_tenant_permission(
    private.storage_path_tenant_id(name), 'legal', 'delete'
  )
  and private.can_access_document_object(
    auth.uid(),
    private.storage_path_tenant_id(name),
    private.storage_path_record_id(name)
  )
);
