-- Calendário forense.
--
-- O motor de prazos calcula sozinho o que é objetivo em todo o país: fins de
-- semana, feriados civis nacionais, os feriados móveis derivados da Páscoa e
-- a suspensão do art. 220 do CPC. Nada disso precisa de banco, é aritmética.
--
-- O que precisa de banco é o resto: feriado de tribunal, feriado estadual,
-- feriado municipal, suspensão de expediente por portaria. Essa é a única
-- razão desta tabela existir.
--
-- Duas origens convivem na mesma tabela:
--
--   tenant_id nulo      — calendário curado pela plataforma, visível a todos
--                         os escritórios. Só administrador da plataforma edita.
--   tenant_id preenchido — exceção do próprio escritório, que conhece a
--                         comarca onde atua melhor que qualquer catálogo.
--
-- Nada aqui é alterado por função existente. A tabela é nova e o motor de
-- prazos apenas lê.

begin;

create table public.forensic_holidays (
  id uuid primary key default gen_random_uuid(),
  -- Nulo indica feriado curado pela plataforma.
  tenant_id uuid references public.tenants(id) on delete cascade,
  -- Nulo indica feriado válido para qualquer tribunal.
  tribunal text,
  holiday_date date not null,
  description text not null check (length(btrim(description)) > 0),
  -- Expediente reduzido não interrompe a contagem; apenas protrai começo e
  -- vencimento que caiam nele (CPC, art. 224, §1).
  partial_expedient boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.forensic_holidays is
  'Feriados forenses que o cálculo automático não deduz: tribunal, estado, '
  'município e portarias de suspensão de expediente.';

-- Impede cadastrar o mesmo dia duas vezes no mesmo escopo. Os COALESCE
-- existem porque, em índice único, NULL nunca colide com NULL.
create unique index forensic_holidays_scope_unique_idx
  on public.forensic_holidays (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(tribunal, ''),
    holiday_date
  );

-- O motor consulta sempre por faixa de datas e, quando conhece, por tribunal.
create index forensic_holidays_lookup_idx
  on public.forensic_holidays (holiday_date, tribunal);

create trigger forensic_holidays_touch_updated_at
before update on public.forensic_holidays
for each row execute function private.touch_tenant_updated_at();

alter table public.forensic_holidays enable row level security;

-- Leitura: o calendário da plataforma é público para quem está autenticado,
-- porque feriado é fato objetivo e não revela nada de ninguém. O calendário
-- próprio só aparece para quem é membro ativo do escritório.
create policy forensic_holidays_read
on public.forensic_holidays
for select
to authenticated
using (
  tenant_id is null
  or private.is_active_tenant_member(auth.uid(), tenant_id)
);

-- Escrita do escritório: apenas proprietário e administrador, e apenas em
-- linhas do próprio escritório. Ninguém edita o calendário da plataforma
-- por esta via.
create policy forensic_holidays_tenant_insert
on public.forensic_holidays
for insert
to authenticated
with check (
  tenant_id is not null
  and private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
);

create policy forensic_holidays_tenant_update
on public.forensic_holidays
for update
to authenticated
using (
  tenant_id is not null
  and private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
)
with check (
  tenant_id is not null
  and private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
);

create policy forensic_holidays_tenant_delete
on public.forensic_holidays
for delete
to authenticated
using (
  tenant_id is not null
  and private.tenant_role(auth.uid(), tenant_id) in ('owner', 'admin')
);

-- O calendário da plataforma é mantido por administrador da plataforma.
create policy forensic_holidays_platform_manage
on public.forensic_holidays
for all
to authenticated
using (tenant_id is null and private.is_platform_admin(auth.uid()))
with check (tenant_id is null and private.is_platform_admin(auth.uid()));

commit;
