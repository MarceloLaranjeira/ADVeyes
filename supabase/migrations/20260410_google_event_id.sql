ALTER TABLE eventos    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE audiencias ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE tarefas    ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS google_event_id TEXT;
