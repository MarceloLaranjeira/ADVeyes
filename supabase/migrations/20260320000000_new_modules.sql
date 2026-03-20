-- ==========================================
-- NOVOS MÓDULOS: Time Tracking, CRM, Equipe, Contratos
-- ==========================================

-- 1. TIME ENTRIES (Controle de Horas)
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  processo_id uuid references public.processos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  descricao text not null,
  data date not null default current_date,
  horas numeric(5,2) not null default 0,
  valor_hora numeric(10,2) default 0,
  faturavel boolean default true,
  faturado boolean default false,
  categoria text default 'juridico',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.time_entries enable row level security;
create policy "Users manage own time_entries" on public.time_entries
  for all using (auth.uid() = user_id);

-- 2. LEADS / CRM
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  email text,
  telefone text,
  origem text default 'indicacao',
  area_interesse text,
  descricao text,
  status text default 'novo',
  prioridade text default 'media',
  valor_estimado numeric(10,2),
  data_contato date,
  proximo_contato date,
  convertido boolean default false,
  cliente_id uuid references public.clientes(id) on delete set null,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads enable row level security;
create policy "Users manage own leads" on public.leads
  for all using (auth.uid() = user_id);

-- 3. EQUIPE
create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  nome text not null,
  email text,
  telefone text,
  cargo text default 'advogado',
  oab text,
  especialidades text[],
  ativo boolean default true,
  valor_hora numeric(10,2) default 0,
  meta_horas_mes numeric(6,2) default 160,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.equipe enable row level security;
create policy "Users manage own equipe" on public.equipe
  for all using (auth.uid() = user_id);

-- 4. TEMPLATES DE CONTRATOS / PEÇAS
create table if not exists public.contratos_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  titulo text not null,
  tipo text default 'contrato',
  area text,
  conteudo text not null,
  variaveis text[],
  ativo boolean default true,
  uso_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contratos_templates enable row level security;
create policy "Users manage own contratos_templates" on public.contratos_templates
  for all using (auth.uid() = user_id);

-- 5. DOCUMENTOS GERADOS (histórico de documentos criados por templates)
create table if not exists public.documentos_gerados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  template_id uuid references public.contratos_templates(id) on delete set null,
  processo_id uuid references public.processos(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  titulo text not null,
  conteudo text not null,
  status text default 'rascunho',
  created_at timestamptz default now()
);

alter table public.documentos_gerados enable row level security;
create policy "Users manage own documentos_gerados" on public.documentos_gerados
  for all using (auth.uid() = user_id);

-- 6. DESPESAS OPERACIONAIS DO ESCRITÓRIO
create table if not exists public.despesas_escritorio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  descricao text not null,
  categoria text default 'operacional',
  valor numeric(10,2) not null,
  data_competencia date not null default current_date,
  data_pagamento date,
  status text default 'pendente',
  recorrente boolean default false,
  created_at timestamptz default now()
);

alter table public.despesas_escritorio enable row level security;
create policy "Users manage own despesas_escritorio" on public.despesas_escritorio
  for all using (auth.uid() = user_id);

-- 7. METAS FINANCEIRAS
create table if not exists public.metas_financeiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mes integer not null,
  ano integer not null,
  meta_receita numeric(10,2) default 0,
  meta_novos_clientes integer default 0,
  meta_horas integer default 0,
  created_at timestamptz default now(),
  unique(user_id, mes, ano)
);

alter table public.metas_financeiras enable row level security;
create policy "Users manage own metas_financeiras" on public.metas_financeiras
  for all using (auth.uid() = user_id);

-- Indexes para performance
create index if not exists idx_time_entries_user on public.time_entries(user_id);
create index if not exists idx_time_entries_processo on public.time_entries(processo_id);
create index if not exists idx_time_entries_data on public.time_entries(data);
create index if not exists idx_leads_user on public.leads(user_id);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_equipe_user on public.equipe(user_id);
