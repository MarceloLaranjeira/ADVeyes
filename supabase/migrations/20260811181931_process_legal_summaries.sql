begin;

alter table public.processos
  add column if not exists legal_summary text,
  add column if not exists legal_summary_status text not null default 'pending',
  add column if not exists legal_summary_provider text,
  add column if not exists legal_summary_request_id text,
  add column if not exists legal_summary_requested_at timestamptz,
  add column if not exists legal_summary_updated_at timestamptz;

alter table public.processos
  drop constraint if exists processos_legal_summary_status_check,
  add constraint processos_legal_summary_status_check check (
    legal_summary_status in ('pending', 'processing', 'ready', 'unavailable', 'failed')
  ),
  drop constraint if exists processos_legal_summary_provider_check,
  add constraint processos_legal_summary_provider_check check (
    legal_summary_provider is null or legal_summary_provider in ('escavador', 'internal')
  );

comment on column public.processos.legal_summary is
  'Resumo processual persistido; nunca substitui os dados e documentos de origem.';
comment on column public.processos.legal_summary_status is
  'Estado durável da geração assíncrona do resumo processual.';

commit;
