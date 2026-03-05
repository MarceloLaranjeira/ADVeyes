
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
