
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
