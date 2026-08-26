begin;

create table public.process_intelligence_current (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  phase text not null default 'nao_identificada' check (phase in (
    'conhecimento', 'recursal', 'cumprimento_execucao',
    'suspenso_sobrestado', 'arquivado_encerrado', 'nao_identificada'
  )),
  stage text not null default 'nao_identificada' check (stage in (
    'distribuicao', 'citacao', 'defesa', 'instrucao', 'pericia',
    'alegacoes_finais', 'sentenca', 'preparacao_recurso', 'contrarrazoes',
    'remessa', 'julgamento', 'transito_julgado', 'liquidacao', 'cobranca',
    'penhora', 'expropriacao', 'pagamento', 'suspenso', 'arquivado',
    'nao_identificada'
  )),
  waiting_on text not null default 'nao_identificado' check (waiting_on in (
    'escritorio', 'cliente', 'parte_contraria', 'juizo_tribunal',
    'orgao_externo', 'nao_identificado'
  )),
  waiting_reason text,
  next_action text,
  last_event_at timestamptz,
  last_advance_at timestamptz,
  stalled_days integer not null default 0 check (stalled_days >= 0),
  is_stalled boolean not null default false,
  risk text not null default 'normal' check (risk in ('normal', 'atencao', 'alto', 'critico')),
  confidence text not null default 'baixa' check (confidence in ('baixa', 'media', 'alta')),
  confidence_score numeric(5,4) not null default 0 check (confidence_score between 0 and 1),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  origin text not null default 'automatico' check (origin in ('automatico', 'manual')),
  run_status text not null default 'pending' check (run_status in ('pending', 'processing', 'ready', 'partial', 'failed')),
  classifier_version text not null default 'rules-v1',
  analyzed_at timestamptz,
  manual_override jsonb check (manual_override is null or jsonb_typeof(manual_override) = 'object'),
  manual_override_by uuid references auth.users(id) on delete set null,
  manual_override_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, process_id),
  unique (tenant_id, id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  constraint process_intelligence_manual_override_check check (
    (origin = 'automatico')
    or (origin = 'manual' and manual_override is not null and manual_override_at is not null)
  )
);

create table public.process_intelligence_history (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  intelligence_id uuid not null,
  change_kind text not null check (change_kind in ('initial', 'analysis', 'manual_correction', 'failure')),
  previous_value jsonb,
  new_value jsonb not null check (jsonb_typeof(new_value) = 'object'),
  changed_by uuid references auth.users(id) on delete set null,
  justification text,
  classifier_version text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade,
  foreign key (tenant_id, intelligence_id)
    references public.process_intelligence_current(tenant_id, id) on delete cascade,
  constraint process_intelligence_history_manual_reason_check check (
    change_kind <> 'manual_correction' or length(btrim(coalesce(justification, ''))) >= 3
  )
);

create table public.process_intelligence_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  office_days integer not null default 3 check (office_days between 0 and 365),
  counterparty_days integer not null default 15 check (counterparty_days between 0 and 365),
  court_days integer not null default 30 check (court_days between 0 and 730),
  daily_scan_enabled boolean not null default true,
  low_confidence_review boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.process_intelligence_queue (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  process_id uuid not null,
  reason text not null default 'source_event' check (reason in ('source_event', 'manual', 'daily_scan', 'backfill')),
  priority smallint not null default 0 check (priority between 0 and 100),
  status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, process_id),
  foreign key (tenant_id, process_id)
    references public.processos(tenant_id, id) on delete cascade
);

create index process_intelligence_current_attention_idx
  on public.process_intelligence_current (tenant_id, risk, is_stalled, stalled_days desc);
create index process_intelligence_current_phase_idx
  on public.process_intelligence_current (tenant_id, phase, stage);
create index process_intelligence_current_waiting_idx
  on public.process_intelligence_current (tenant_id, waiting_on, last_advance_at);
create index process_intelligence_history_process_idx
  on public.process_intelligence_history (tenant_id, process_id, created_at desc);
create index process_intelligence_queue_worker_idx
  on public.process_intelligence_queue (status, available_at, priority desc)
  where status in ('pending', 'retry');

alter table public.process_intelligence_current enable row level security;
alter table public.process_intelligence_history enable row level security;
alter table public.process_intelligence_settings enable row level security;
alter table public.process_intelligence_queue enable row level security;

create policy process_intelligence_current_tenant_read
on public.process_intelligence_current
for select to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.can_access_tenant_record(auth.uid(), tenant_id, 'processos', process_id)
);

create policy process_intelligence_history_tenant_read
on public.process_intelligence_history
for select to authenticated
using (
  private.has_tenant_permission(tenant_id, 'legal', 'read')
  and private.can_access_tenant_record(auth.uid(), tenant_id, 'processos', process_id)
);

create policy process_intelligence_settings_tenant_read
on public.process_intelligence_settings
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy process_intelligence_settings_tenant_insert
on public.process_intelligence_settings
for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

create policy process_intelligence_settings_tenant_update
on public.process_intelligence_settings
for update to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

revoke all privileges on table
  public.process_intelligence_current,
  public.process_intelligence_history,
  public.process_intelligence_settings,
  public.process_intelligence_queue
from public, anon, authenticated;

grant select on table
  public.process_intelligence_current,
  public.process_intelligence_history,
  public.process_intelligence_settings
to authenticated;
grant insert, update (
  office_days, counterparty_days, court_days, daily_scan_enabled,
  low_confidence_review, updated_by, updated_at
) on public.process_intelligence_settings to authenticated;
grant all privileges on table
  public.process_intelligence_current,
  public.process_intelligence_history,
  public.process_intelligence_settings,
  public.process_intelligence_queue
to service_role;

create or replace function private.enqueue_process_intelligence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.tenant_id is null or new.process_id is null then
    return new;
  end if;

  insert into public.process_intelligence_queue (
    tenant_id, process_id, reason, priority, status, attempts, available_at,
    locked_at, last_error_code, updated_at
  ) values (
    new.tenant_id, new.process_id, 'source_event', 30, 'pending', 0, now(),
    null, null, now()
  )
  on conflict (tenant_id, process_id) do update set
    reason = 'source_event',
    priority = greatest(public.process_intelligence_queue.priority, 30),
    status = 'pending',
    attempts = 0,
    available_at = now(),
    locked_at = null,
    last_error_code = null,
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.enqueue_process_intelligence() from public, anon, authenticated;

create trigger process_movements_enqueue_intelligence
after insert or update of occurred_at, content, description, notes
on public.process_movements
for each row execute function private.enqueue_process_intelligence();

create trigger andamentos_enqueue_intelligence
after insert or update of data_andamento, descricao, tipo
on public.andamentos
for each row execute function private.enqueue_process_intelligence();

create trigger publicacoes_enqueue_intelligence
after insert or update of data_publicacao, conteudo, conteudo_simplificado, tipo
on public.publicacoes
for each row when (new.process_id is not null)
execute function private.enqueue_process_intelligence();

create or replace function private.audit_process_intelligence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  change_type text;
  reason_text text;
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  change_type := case
    when tg_op = 'INSERT' then 'initial'
    when new.run_status = 'failed' then 'failure'
    when new.origin = 'manual' and (old.origin is distinct from new.origin or old.manual_override is distinct from new.manual_override)
      then 'manual_correction'
    else 'analysis'
  end;
  reason_text := case
    when change_type = 'manual_correction' then new.manual_override ->> 'justification'
    else null
  end;

  insert into public.process_intelligence_history (
    tenant_id, process_id, intelligence_id, change_kind, previous_value,
    new_value, changed_by, justification, classifier_version
  ) values (
    new.tenant_id, new.process_id, new.id, change_type,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new), new.manual_override_by, reason_text, new.classifier_version
  );

  return new;
end;
$$;

revoke all on function private.audit_process_intelligence() from public, anon, authenticated;

create trigger process_intelligence_audit
after insert or update on public.process_intelligence_current
for each row execute function private.audit_process_intelligence();

comment on table public.process_intelligence_current is
  'Diagnóstico processual atual, derivado de evidências e sujeito a correção humana auditada.';
comment on table public.process_intelligence_history is
  'Histórico imutável de análises e correções da inteligência processual.';
comment on table public.process_intelligence_queue is
  'Fila idempotente exclusiva do backend para análise processual.';

commit;
