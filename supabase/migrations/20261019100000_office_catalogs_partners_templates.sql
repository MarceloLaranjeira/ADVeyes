begin;

-- Catálogos simples do escritório (configurações): um modelo único para
-- grupos e tipos de ação, etapas, origens de pessoas, termos monitorados e metas.
create table public.catalogo_escritorio (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tipo text not null check (tipo in (
    'grupo_acao', 'tipo_acao', 'etapa', 'origem_pessoa', 'termo_monitorado', 'meta'
  )),
  nome text not null check (length(pg_catalog.btrim(nome)) between 1 and 160),
  valor integer check (valor is null or valor >= 0),
  ordem integer not null default 0 check (ordem >= 0),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, tipo, nome)
);

create index catalogo_escritorio_tenant_tipo_idx
  on public.catalogo_escritorio (tenant_id, tipo, ativo, ordem, nome);

-- Rede de parceiros (outros escritórios).
create table public.parceiros (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null check (length(pg_catalog.btrim(nome)) between 1 and 160),
  email text check (email is null or length(email) <= 254),
  telefone text check (telefone is null or length(telefone) <= 40),
  oab text check (oab is null or length(oab) <= 40),
  observacoes text,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create index parceiros_tenant_active_idx on public.parceiros (tenant_id, ativo, nome);

-- Processos compartilhados com (ou recebidos de) um parceiro, e a demanda aberta.
create table public.parceiro_processos (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null,
  parceiro_id uuid not null,
  processo_id uuid not null,
  direcao text not null default 'compartilhado' check (direcao in ('compartilhado', 'recebido')),
  tipo_acao text check (tipo_acao is null or length(tipo_acao) <= 120),
  demanda_pendente boolean not null default false,
  demanda_descricao text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parceiro_id, processo_id),
  foreign key (tenant_id, parceiro_id) references public.parceiros(tenant_id, id) on delete cascade,
  foreign key (tenant_id, processo_id) references public.processos(tenant_id, id) on delete cascade
);

create index parceiro_processos_tenant_idx on public.parceiro_processos (tenant_id, parceiro_id);

-- Modelos de documento do escritório.
create table public.modelos_documento (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null check (length(pg_catalog.btrim(nome)) between 1 and 160),
  categoria text check (categoria is null or length(categoria) <= 80),
  conteudo text not null default '' check (length(conteudo) <= 200000),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, nome)
);

create index modelos_documento_tenant_idx on public.modelos_documento (tenant_id, ativo, nome);

create trigger catalogo_escritorio_touch_updated_at
before update on public.catalogo_escritorio
for each row execute function private.touch_tenant_updated_at();

create trigger parceiros_touch_updated_at
before update on public.parceiros
for each row execute function private.touch_tenant_updated_at();

create trigger parceiro_processos_touch_updated_at
before update on public.parceiro_processos
for each row execute function private.touch_tenant_updated_at();

create trigger modelos_documento_touch_updated_at
before update on public.modelos_documento
for each row execute function private.touch_tenant_updated_at();

alter table public.catalogo_escritorio enable row level security;
alter table public.parceiros enable row level security;
alter table public.parceiro_processos enable row level security;
alter table public.modelos_documento enable row level security;

revoke all on table public.catalogo_escritorio, public.parceiros,
  public.parceiro_processos, public.modelos_documento from anon, authenticated;
grant select, insert, update, delete on table public.catalogo_escritorio, public.parceiros,
  public.parceiro_processos, public.modelos_documento to authenticated;
grant all on table public.catalogo_escritorio, public.parceiros,
  public.parceiro_processos, public.modelos_documento to service_role;

-- Leitura: quem lê o jurídico. Catálogos de configuração: só owner/admin escrevem.
create policy catalogo_escritorio_read on public.catalogo_escritorio
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy catalogo_escritorio_manage on public.catalogo_escritorio
for all to authenticated
using (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'))
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

-- Parceiros, processos compartilhados e modelos: quem edita o jurídico escreve.
create policy parceiros_read on public.parceiros
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy parceiros_write on public.parceiros
for all to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

create policy parceiro_processos_read on public.parceiro_processos
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy parceiro_processos_write on public.parceiro_processos
for all to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

create policy modelos_documento_read on public.modelos_documento
for select to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'read'));

create policy modelos_documento_write on public.modelos_documento
for all to authenticated
using (private.has_tenant_permission(tenant_id, 'legal', 'update'))
with check (private.has_tenant_permission(tenant_id, 'legal', 'update'));

commit;
