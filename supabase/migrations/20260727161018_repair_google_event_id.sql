-- Substitui a migration legada 20260410_google_event_id.sql, cujo prefixo
-- de oito dígitos não é aceito de forma consistente pelo CLI atual.
alter table public.eventos add column if not exists google_event_id text;
alter table public.audiencias add column if not exists google_event_id text;
alter table public.tarefas add column if not exists google_event_id text;
alter table public.financeiro add column if not exists google_event_id text;
