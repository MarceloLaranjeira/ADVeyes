
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
