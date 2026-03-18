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
