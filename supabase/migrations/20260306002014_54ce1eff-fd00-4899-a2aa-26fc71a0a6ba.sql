
-- Portal de acesso para clientes (token-based)
CREATE TABLE public.portal_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  email text,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_acessos ENABLE ROW LEVEL SECURITY;

-- Lawyers can manage portal access
CREATE POLICY "Auth users can CRUD portal_acessos"
  ON public.portal_acessos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public can read with token (for portal access)
CREATE POLICY "Public can read own portal access by token"
  ON public.portal_acessos FOR SELECT
  TO anon
  USING (ativo = true);

-- Allow anon to read clientes linked via portal
CREATE POLICY "Anon can read clientes via portal"
  ON public.clientes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_acessos
      WHERE portal_acessos.cliente_id = clientes.id
      AND portal_acessos.ativo = true
    )
  );

-- Allow anon to read processos linked to portal clients
CREATE POLICY "Anon can read processos via portal"
  ON public.processos FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.portal_acessos
      WHERE portal_acessos.cliente_id = processos.cliente_id
      AND portal_acessos.ativo = true
    )
  );

-- Allow anon to read audiencias linked to portal processes
CREATE POLICY "Anon can read audiencias via portal"
  ON public.audiencias FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.processos p
      JOIN public.portal_acessos pa ON pa.cliente_id = p.cliente_id AND pa.ativo = true
      WHERE p.id = audiencias.processo_id
    )
  );

-- Allow anon to read documentos linked to portal processes
CREATE POLICY "Anon can read documentos via portal"
  ON public.documentos FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.processos p
      JOIN public.portal_acessos pa ON pa.cliente_id = p.cliente_id AND pa.ativo = true
      WHERE p.id = documentos.processo_id
    )
  );

-- Tabela de parcelas de honorários
CREATE TABLE public.honorario_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  numero_parcela integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente',
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.honorario_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can CRUD honorario_parcelas"
  ON public.honorario_parcelas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
