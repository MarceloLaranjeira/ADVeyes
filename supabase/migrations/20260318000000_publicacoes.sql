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
