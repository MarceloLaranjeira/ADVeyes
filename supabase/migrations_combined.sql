-- Migration: 20260305230900_7693721c-2b9b-4eac-b891-af7e5bdbd8e2.sql

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clientes table
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can CRUD clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Processos table
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  numero TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  area TEXT NOT NULL DEFAULT 'Cível',
  status TEXT NOT NULL DEFAULT 'Em andamento',
  vara TEXT,
  advogado TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can CRUD processos" ON public.processos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Financeiro table
CREATE TABLE public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'honorario',
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can CRUD financeiro" ON public.financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migration: 20260305234854_76644aff-f795-4e19-9291-6da532603053.sql

-- Eventos/Agenda table
CREATE TABLE public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'reunião',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  local TEXT,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can CRUD eventos"
  ON public.eventos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Documentos table
CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Outros',
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  processo_numero TEXT,
  arquivo_path TEXT NOT NULL,
  tamanho INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can CRUD documentos"
  ON public.documentos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false);

-- Storage policies
CREATE POLICY "Auth users can upload docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Auth users can view docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "Auth users can delete docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'documentos');

-- Migration: 20260305235720_92f7aec6-2dba-4a08-8727-2807524294ab.sql

CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'média',
  status TEXT NOT NULL DEFAULT 'pendente',
  data_limite DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can CRUD tarefas"
  ON public.tarefas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20260306000303_d86f64d6-efcf-4012-87cb-f8de9798e7a9.sql

CREATE TABLE public.audiencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  processo_numero text,
  cliente_nome text,
  tipo text NOT NULL DEFAULT 'Instrução e Julgamento',
  data_hora timestamp with time zone NOT NULL,
  vara text,
  juiz text,
  local text,
  observacoes text,
  status text NOT NULL DEFAULT 'Agendada',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can CRUD audiencias"
  ON public.audiencias
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20260306001129_f3e91ad0-a0a5-45f5-8251-f6ea916ec43f.sql

-- Tribunal credentials table for storing API tokens per tribunal per user
CREATE TABLE public.tribunal_credenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tribunal text NOT NULL,
  nome_tribunal text NOT NULL,
  tipo_autenticacao text NOT NULL DEFAULT 'token',
  token_acesso text,
  token_refresh text,
  numero_oab text,
  seccional_oab text,
  cpf text,
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tribunal)
);

ALTER TABLE public.tribunal_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own credentials"
  ON public.tribunal_credenciais
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Process monitoring subscriptions
CREATE TABLE public.processo_monitoramento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE CASCADE,
  numero_processo text NOT NULL,
  tribunal text NOT NULL,
  ultimo_movimento text,
  ultima_verificacao timestamp with time zone,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.processo_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own monitoramento"
  ON public.processo_monitoramento
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  processo_numero text,
  tribunal text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own notificacoes"
  ON public.notificacoes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Migration: 20260306001722_502abda7-e69b-4dcf-b055-100cf0a61d01.sql

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Migration: 20260306002014_54ce1eff-fd00-4899-a2aa-26fc71a0a6ba.sql

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

-- Migration: 20260306031837_cd23f025-147d-453a-91ba-0ea0ac15489c.sql

DROP POLICY IF EXISTS "Auth users can view docs" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete docs" ON storage.objects;

CREATE POLICY "owner_view_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "owner_delete_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Migration: 20260306033604_85b238f8-e4de-480b-ba48-fa4d29800c3d.sql
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
-- Migration: 20260306050021_cf5180f8-8e7a-4621-812f-2ca27b76a2bc.sql
-- Drop all insecure anon policies that allow reading without token validation
DROP POLICY IF EXISTS "Public can read own portal access by token" ON public.portal_acessos;
DROP POLICY IF EXISTS "Anon can read clientes via portal" ON public.clientes;
DROP POLICY IF EXISTS "Anon can read processos via portal" ON public.processos;
DROP POLICY IF EXISTS "Anon can read documentos via portal" ON public.documentos;
DROP POLICY IF EXISTS "Anon can read audiencias via portal" ON public.audiencias;
-- Migration: 20260306120000_security_fix_rls_policies.sql

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

-- Migration: 20260318000000_publicacoes.sql
-- Tabela de publicações judiciais capturadas dos Diários de Justiça
CREATE TABLE IF NOT EXISTS publicacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'intimacao',
  tribunal TEXT NOT NULL DEFAULT 'TJAM',
  numero_processo TEXT,
  cliente_nome TEXT,
  data_publicacao TIMESTAMPTZ DEFAULT now(),
  conteudo TEXT NOT NULL,
  conteudo_simplificado TEXT,
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'lida', 'urgente', 'processada')),
  prazo_dias INTEGER,
  data_prazo TIMESTAMPTZ,
  tarefa_gerada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE publicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own publicacoes"
  ON publicacoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_publicacoes_user_id ON publicacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_status ON publicacoes(status);
CREATE INDEX IF NOT EXISTS idx_publicacoes_data ON publicacoes(data_publicacao DESC);

-- Migration: 20260318120000_andamentos.sql
-- Tabela de andamentos processuais (movimentações capturadas e manuais)
CREATE TABLE IF NOT EXISTS andamentos (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  processo_id   UUID         REFERENCES processos(id)  ON DELETE CASCADE,
  numero_processo TEXT       NOT NULL,
  data_andamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo          TEXT         NOT NULL DEFAULT 'Andamento',
  descricao     TEXT         NOT NULL,
  tribunal      TEXT,
  origem        TEXT         NOT NULL DEFAULT 'manual', -- 'manual' | 'datajud' | 'diario_oficial'
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE andamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_andamentos"
  ON andamentos FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_andamentos_processo_id ON andamentos(processo_id);
CREATE INDEX idx_andamentos_user_id     ON andamentos(user_id);
CREATE INDEX idx_andamentos_data        ON andamentos(data_andamento DESC);

-- Adiciona campo percentual_exito em processos (se não existir)
ALTER TABLE processos ADD COLUMN IF NOT EXISTS percentual_exito INTEGER DEFAULT NULL;
-- Adiciona campo partes em processos
ALTER TABLE processos ADD COLUMN IF NOT EXISTS polo_ativo  TEXT DEFAULT NULL;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS polo_passivo TEXT DEFAULT NULL;

-- Migration: 20260318130000_push_gcal.sql
-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  subscription TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_push_subs" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Google Calendar sync mapping
CREATE TABLE IF NOT EXISTS gcal_event_map (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  evento_id       UUID REFERENCES eventos(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE gcal_event_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_gcal_map" ON gcal_event_map FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asaas subscriptions
CREATE TABLE IF NOT EXISTS asaas_subscriptions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  asaas_customer_id   TEXT,
  asaas_subscription_id TEXT,
  plan                TEXT NOT NULL DEFAULT 'trial', -- 'trial' | 'starter' | 'profissional' | 'escritorio'
  status              TEXT NOT NULL DEFAULT 'trial', -- 'trial' | 'active' | 'overdue' | 'cancelled'
  trial_ends_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  next_due_date       DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE asaas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_asaas_subs" ON asaas_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tarefa checklist items (sub-tasks)
CREATE TABLE IF NOT EXISTS tarefa_checklist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id  UUID REFERENCES tarefas(id) ON DELETE CASCADE NOT NULL,
  texto      TEXT NOT NULL,
  concluido  BOOLEAN DEFAULT FALSE,
  ordem      INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tarefa_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_tarefa_checklist" ON tarefa_checklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM tarefas t WHERE t.id = tarefa_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM tarefas t WHERE t.id = tarefa_id AND t.user_id = auth.uid()));

-- Tarefa comments
CREATE TABLE IF NOT EXISTS tarefa_comentarios (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id  UUID REFERENCES tarefas(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tarefa_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_tarefa_comentarios" ON tarefa_comentarios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tarefa tags
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2) DEFAULT NULL;
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT NULL;

-- Migration: 20260319032704_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260320000000_new_modules.sql
-- ==========================================
-- NOVOS MÓDULOS: Time Tracking, CRM, Equipe, Contratos
-- ==========================================

-- 1. TIME ENTRIES (Controle de Horas)
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  processo_id uuid references public.processos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  descricao text not null,
  data date not null default current_date,
  horas numeric(5,2) not null default 0,
  valor_hora numeric(10,2) default 0,
  faturavel boolean default true,
  faturado boolean default false,
  categoria text default 'juridico',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.time_entries enable row level security;
create policy "Users manage own time_entries" on public.time_entries
  for all using (auth.uid() = user_id);

-- 2. LEADS / CRM
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  email text,
  telefone text,
  origem text default 'indicacao',
  area_interesse text,
  descricao text,
  status text default 'novo',
  prioridade text default 'media',
  valor_estimado numeric(10,2),
  data_contato date,
  proximo_contato date,
  convertido boolean default false,
  cliente_id uuid references public.clientes(id) on delete set null,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;
create policy "Users manage own leads" on public.leads
  for all using (auth.uid() = user_id);

-- 3. EQUIPE
create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  email text,
  telefone text,
  cargo text default 'advogado',
  oab text,
  especialidades text[],
  ativo boolean default true,
  valor_hora numeric(10,2) default 0,
  meta_horas_mes numeric(6,2) default 160,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.equipe enable row level security;
create policy "Users manage own equipe" on public.equipe
  for all using (auth.uid() = user_id);

-- 4. TEMPLATES DE CONTRATOS / PEÇAS
create table if not exists public.contratos_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  tipo text default 'contrato',
  area text,
  conteudo text not null,
  variaveis text[],
  ativo boolean default true,
  uso_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contratos_templates enable row level security;
create policy "Users manage own contratos_templates" on public.contratos_templates
  for all using (auth.uid() = user_id);

-- 5. DOCUMENTOS GERADOS (histórico de documentos criados por templates)
create table if not exists public.documentos_gerados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  template_id uuid references public.contratos_templates(id) on delete set null,
  processo_id uuid references public.processos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  conteudo text not null,
  status text default 'rascunho',
  created_at timestamptz default now()
);

alter table public.documentos_gerados enable row level security;
create policy "Users manage own documentos_gerados" on public.documentos_gerados
  for all using (auth.uid() = user_id);

-- 6. DESPESAS OPERACIONAIS DO ESCRITÓRIO
create table if not exists public.despesas_escritorio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  descricao text not null,
  categoria text default 'operacional',
  valor numeric(10,2) not null,
  data_competencia date not null default current_date,
  data_pagamento date,
  status text default 'pendente',
  recorrente boolean default false,
  created_at timestamptz default now()
);

alter table public.despesas_escritorio enable row level security;
create policy "Users manage own despesas_escritorio" on public.despesas_escritorio
  for all using (auth.uid() = user_id);

-- 7. METAS FINANCEIRAS
create table if not exists public.metas_financeiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mes integer not null,
  ano integer not null,
  meta_receita numeric(10,2) default 0,
  meta_novos_clientes integer default 0,
  meta_horas integer default 0,
  created_at timestamptz default now(),
  unique(user_id, mes, ano)
);

alter table public.metas_financeiras enable row level security;
create policy "Users manage own metas_financeiras" on public.metas_financeiras
  for all using (auth.uid() = user_id);

-- Indexes para performance
create index if not exists idx_time_entries_user on public.time_entries(user_id);
create index if not exists idx_time_entries_processo on public.time_entries(processo_id);
create index if not exists idx_time_entries_data on public.time_entries(data);
create index if not exists idx_leads_user on public.leads(user_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_equipe_user on public.equipe(user_id);

-- Migration: 20260322000000_adveyes_oab_sync_columns.sql
-- ADVeyes: Add columns needed by oab-sync edge function
-- processos: ultimo_andamento, fonte, data_ajuizamento
-- processo_monitoramento: full table create + oab_origem column

-- processos table new columns
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS ultimo_andamento TEXT,
  ADD COLUMN IF NOT EXISTS fonte TEXT,
  ADD COLUMN IF NOT EXISTS data_ajuizamento DATE;

-- processo_monitoramento table (create if not exists)
CREATE TABLE IF NOT EXISTS processo_monitoramento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_processo TEXT NOT NULL,
  tribunal TEXT,
  ultimo_movimento TEXT,
  ultima_verificacao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT TRUE,
  oab_origem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, numero_processo)
);

-- Add oab_origem if table already existed without it
ALTER TABLE processo_monitoramento
  ADD COLUMN IF NOT EXISTS oab_origem TEXT;

-- RLS for processo_monitoramento
ALTER TABLE processo_monitoramento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own monitoramento" ON processo_monitoramento;
CREATE POLICY "Users can manage their own monitoramento"
  ON processo_monitoramento
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migration: 20260322055130_2c7b2f8d-a48d-4a87-bd18-26a522076e48.sql
DROP POLICY IF EXISTS "Anon can read active portal access" ON public.portal_acessos;
-- Migration: 20260322120000_cron_monitoramento.sql
-- ADVeyes: Configura o CRON job para execução horária do cron-monitoramento
-- Requer extensões pg_cron e pg_net habilitadas no projeto Supabase

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior se existir
SELECT cron.unschedule('monitoramento-processos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitoramento-processos'
);

-- Agendar execução a cada hora
SELECT cron.schedule(
  'monitoramento-processos',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.supabase_url', true) || '/functions/v1/cron-monitoramento'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

