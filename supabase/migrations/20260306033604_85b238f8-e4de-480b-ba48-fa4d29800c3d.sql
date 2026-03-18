-- Fix RLS: Replace overly permissive USING(true) with user-scoped policies

-- clientes
DROP POLICY IF EXISTS "Auth users can CRUD clientes" ON public.clientes;
CREATE POLICY "owner_crud_clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- processos
DROP POLICY IF EXISTS "Auth users can CRUD processos" ON public.processos;
CREATE POLICY "owner_crud_processos" ON public.processos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- financeiro
DROP POLICY IF EXISTS "Auth users can CRUD financeiro" ON public.financeiro;
CREATE POLICY "owner_crud_financeiro" ON public.financeiro
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- eventos
DROP POLICY IF EXISTS "Auth users can CRUD eventos" ON public.eventos;
CREATE POLICY "owner_crud_eventos" ON public.eventos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- documentos
DROP POLICY IF EXISTS "Auth users can CRUD documentos" ON public.documentos;
CREATE POLICY "owner_crud_documentos" ON public.documentos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- audiencias
DROP POLICY IF EXISTS "Auth users can CRUD audiencias" ON public.audiencias;
CREATE POLICY "owner_crud_audiencias" ON public.audiencias
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tarefas
DROP POLICY IF EXISTS "Auth users can CRUD tarefas" ON public.tarefas;
CREATE POLICY "owner_crud_tarefas" ON public.tarefas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- honorario_parcelas
DROP POLICY IF EXISTS "Auth users can CRUD honorario_parcelas" ON public.honorario_parcelas;
CREATE POLICY "owner_crud_honorario_parcelas" ON public.honorario_parcelas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- portal_acessos: scope to clientes owned by the user
DROP POLICY IF EXISTS "Auth users can CRUD portal_acessos" ON public.portal_acessos;
CREATE POLICY "owner_crud_portal_acessos" ON public.portal_acessos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = portal_acessos.cliente_id
    AND clientes.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = portal_acessos.cliente_id
    AND clientes.user_id = auth.uid()
  ));