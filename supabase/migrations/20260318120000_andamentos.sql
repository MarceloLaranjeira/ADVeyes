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
