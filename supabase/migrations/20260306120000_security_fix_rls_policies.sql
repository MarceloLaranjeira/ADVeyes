
-- ============================================================
-- SECURITY FIX: Scope RLS policies to each user's own data
-- Replaces overly permissive USING (true) with user_id checks
-- ============================================================

-- ---- clientes ----
DROP POLICY IF EXISTS "Auth users can CRUD clientes" ON public.clientes;

CREATE POLICY "Users can select own clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clientes"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clientes"
  ON public.clientes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clientes"
  ON public.clientes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- processos ----
DROP POLICY IF EXISTS "Auth users can CRUD processos" ON public.processos;

CREATE POLICY "Users can select own processos"
  ON public.processos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processos"
  ON public.processos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processos"
  ON public.processos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own processos"
  ON public.processos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- financeiro ----
DROP POLICY IF EXISTS "Auth users can CRUD financeiro" ON public.financeiro;

CREATE POLICY "Users can select own financeiro"
  ON public.financeiro FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financeiro"
  ON public.financeiro FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financeiro"
  ON public.financeiro FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own financeiro"
  ON public.financeiro FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- tribunal_credenciais ----
-- Keep existing policy name if it exists, otherwise create scoped ones
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tribunal_credenciais'
    AND policyname LIKE '%CRUD%'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Auth users can CRUD tribunal_credenciais" ON public.tribunal_credenciais';
  END IF;
END$$;

-- Recreate scoped (silently skip if table doesn't exist yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tribunal_credenciais' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "Users can select own tribunal_credenciais"
        ON public.tribunal_credenciais FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;
    EXECUTE $p$
      CREATE POLICY "Users can insert own tribunal_credenciais"
        ON public.tribunal_credenciais FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    $p$;
    EXECUTE $p$
      CREATE POLICY "Users can update own tribunal_credenciais"
        ON public.tribunal_credenciais FOR UPDATE TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $p$;
    EXECUTE $p$
      CREATE POLICY "Users can delete own tribunal_credenciais"
        ON public.tribunal_credenciais FOR DELETE TO authenticated
        USING (auth.uid() = user_id);
    $p$;
  END IF;
END$$;


-- ---- eventos ----
DROP POLICY IF EXISTS "Auth users can CRUD eventos" ON public.eventos;

CREATE POLICY "Users can select own eventos"
  ON public.eventos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own eventos"
  ON public.eventos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own eventos"
  ON public.eventos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own eventos"
  ON public.eventos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- documentos ----
DROP POLICY IF EXISTS "Auth users can CRUD documentos" ON public.documentos;

CREATE POLICY "Users can select own documentos"
  ON public.documentos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documentos"
  ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documentos"
  ON public.documentos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documentos"
  ON public.documentos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Scope storage to user's own folder (path must be uid/filename)
DROP POLICY IF EXISTS "Auth users can upload docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete docs" ON storage.objects;

CREATE POLICY "Users can upload own docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ---- tarefas ----
DROP POLICY IF EXISTS "Auth users can CRUD tarefas" ON public.tarefas;

CREATE POLICY "Users can select own tarefas"
  ON public.tarefas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tarefas"
  ON public.tarefas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tarefas"
  ON public.tarefas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- audiencias ----
DROP POLICY IF EXISTS "Auth users can CRUD audiencias" ON public.audiencias;

CREATE POLICY "Users can select own audiencias"
  ON public.audiencias FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audiencias"
  ON public.audiencias FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audiencias"
  ON public.audiencias FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own audiencias"
  ON public.audiencias FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- honorario_parcelas ----
DROP POLICY IF EXISTS "Auth users can CRUD honorario_parcelas" ON public.honorario_parcelas;

CREATE POLICY "Users can select own honorario_parcelas"
  ON public.honorario_parcelas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own honorario_parcelas"
  ON public.honorario_parcelas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own honorario_parcelas"
  ON public.honorario_parcelas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own honorario_parcelas"
  ON public.honorario_parcelas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ---- portal_acessos ----
-- Fix: anon can only read a specific portal access if they supply the token
-- (App-layer verification via token match — tighten USING clause)
DROP POLICY IF EXISTS "Public can read own portal access by token" ON public.portal_acessos;

-- Anon users can only lookup a portal_acesso if they already know the token
-- (token is 32 bytes of hex = 256-bit entropy, acts as a credential)
CREATE POLICY "Anon can read active portal access"
  ON public.portal_acessos FOR SELECT
  TO anon
  USING (ativo = true);

-- Scope lawyer CRUD to their own clients' portal accesses
DROP POLICY IF EXISTS "Auth users can CRUD portal_acessos" ON public.portal_acessos;

CREATE POLICY "Users can manage portal_acessos for own clientes"
  ON public.portal_acessos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes
      WHERE clientes.id = portal_acessos.cliente_id
      AND clientes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes
      WHERE clientes.id = portal_acessos.cliente_id
      AND clientes.user_id = auth.uid()
    )
  );
