begin;

-- Dados cadastrais do escritório (tela Conta e assinatura). A identidade
-- visual continua em tenant_brand_settings.
create table public.escritorio_perfil (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  razao_social text check (razao_social is null or length(pg_catalog.btrim(razao_social)) between 1 and 200),
  nome_fantasia text check (nome_fantasia is null or length(pg_catalog.btrim(nome_fantasia)) between 1 and 200),
  documento text check (documento is null or length(documento) <= 20),
  pais text not null default 'Brasil' check (length(pg_catalog.btrim(pais)) between 1 and 80),
  cidade text check (cidade is null or length(cidade) <= 120),
  estado text check (estado is null or length(estado) <= 2),
  celular text check (celular is null or length(celular) <= 40),
  telefone text check (telefone is null or length(telefone) <= 40),
  email text check (email is null or length(email) <= 254),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger escritorio_perfil_touch_updated_at
before update on public.escritorio_perfil
for each row execute function private.touch_tenant_updated_at();

alter table public.escritorio_perfil enable row level security;

revoke all on table public.escritorio_perfil from anon, authenticated;
grant select, insert, update on table public.escritorio_perfil to authenticated;
grant all on table public.escritorio_perfil to service_role;

create policy escritorio_perfil_read on public.escritorio_perfil
for select to authenticated
using (private.is_active_tenant_member((select auth.uid()), tenant_id));

create policy escritorio_perfil_insert on public.escritorio_perfil
for insert to authenticated
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

create policy escritorio_perfil_update on public.escritorio_perfil
for update to authenticated
using (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'))
with check (private.tenant_role((select auth.uid()), tenant_id) in ('owner', 'admin'));

commit;
