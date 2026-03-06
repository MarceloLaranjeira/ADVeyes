
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
