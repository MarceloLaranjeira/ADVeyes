
DROP POLICY IF EXISTS "Auth users can view docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete docs" ON storage.objects;

CREATE POLICY "owner_view_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner_delete_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);
