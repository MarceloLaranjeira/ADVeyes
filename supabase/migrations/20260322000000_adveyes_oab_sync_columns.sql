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
