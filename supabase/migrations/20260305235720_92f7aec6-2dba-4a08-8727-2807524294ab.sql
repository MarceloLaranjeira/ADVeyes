
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
