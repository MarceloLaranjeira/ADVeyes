begin;

create table public.legal_court_registry (
  id uuid primary key default extensions.gen_random_uuid(),
  court_code text not null unique,
  datajud_alias text not null unique,
  display_name text not null,
  timezone text not null,
  utc_offset text not null check (utc_offset ~ '^[+-][0-9]{2}:[0-9]{2}$'),
  public_datajud_enabled boolean not null default true,
  public_djen_enabled boolean not null default true,
  authenticated_adapter text,
  authenticated_status text not null default 'not_homologated'
    check (authenticated_status in ('not_homologated', 'testing', 'pilot', 'active', 'paused')),
  capabilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_court_registry enable row level security;

create policy legal_court_registry_authenticated_read
on public.legal_court_registry
for select to authenticated
using (true);

revoke all on public.legal_court_registry from public, anon, authenticated;
grant select on public.legal_court_registry to authenticated;
grant all on public.legal_court_registry to service_role;

create index legal_court_registry_public_coverage_idx
  on public.legal_court_registry (public_datajud_enabled, authenticated_status, court_code);

drop trigger if exists legal_court_registry_touch_updated_at
on public.legal_court_registry;
create trigger legal_court_registry_touch_updated_at
before update on public.legal_court_registry
for each row execute function private.touch_tenant_updated_at();

insert into public.legal_court_registry
  (court_code, datajud_alias, display_name, timezone, utc_offset, authenticated_adapter, authenticated_status, capabilities)
values
  ('TJAC','tjac','Tribunal de Justiça do Acre','America/Rio_Branco','-05:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJAL','tjal','Tribunal de Justiça de Alagoas','America/Maceio','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJAP','tjap','Tribunal de Justiça do Amapá','America/Belem','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJAM','tjam','Tribunal de Justiça do Amazonas','America/Manaus','-04:00','projudi_tjam','pilot','{"public_processes":true,"public_movements":true,"authenticated_hearings":true}'::jsonb),
  ('TJBA','tjba','Tribunal de Justiça da Bahia','America/Bahia','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJCE','tjce','Tribunal de Justiça do Ceará','America/Fortaleza','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJDFT','tjdft','Tribunal de Justiça do Distrito Federal e Territórios','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJES','tjes','Tribunal de Justiça do Espírito Santo','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJGO','tjgo','Tribunal de Justiça de Goiás','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJMA','tjma','Tribunal de Justiça do Maranhão','America/Fortaleza','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJMT','tjmt','Tribunal de Justiça de Mato Grosso','America/Cuiaba','-04:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJMS','tjms','Tribunal de Justiça de Mato Grosso do Sul','America/Campo_Grande','-04:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJMG','tjmg','Tribunal de Justiça de Minas Gerais','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJPA','tjpa','Tribunal de Justiça do Pará','America/Belem','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJPB','tjpb','Tribunal de Justiça da Paraíba','America/Fortaleza','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJPR','tjpr','Tribunal de Justiça do Paraná','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJPE','tjpe','Tribunal de Justiça de Pernambuco','America/Recife','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJPI','tjpi','Tribunal de Justiça do Piauí','America/Fortaleza','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJRJ','tjrj','Tribunal de Justiça do Rio de Janeiro','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJRN','tjrn','Tribunal de Justiça do Rio Grande do Norte','America/Fortaleza','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJRS','tjrs','Tribunal de Justiça do Rio Grande do Sul','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJRO','tjro','Tribunal de Justiça de Rondônia','America/Porto_Velho','-04:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJRR','tjrr','Tribunal de Justiça de Roraima','America/Boa_Vista','-04:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJSC','tjsc','Tribunal de Justiça de Santa Catarina','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJSE','tjse','Tribunal de Justiça de Sergipe','America/Maceio','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJSP','tjsp','Tribunal de Justiça de São Paulo','America/Sao_Paulo','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb),
  ('TJTO','tjto','Tribunal de Justiça do Tocantins','America/Araguaina','-03:00',null,'not_homologated','{"public_processes":true,"public_movements":true}'::jsonb)
on conflict (court_code) do update set
  datajud_alias = excluded.datajud_alias,
  display_name = excluded.display_name,
  timezone = excluded.timezone,
  utc_offset = excluded.utc_offset,
  public_datajud_enabled = true,
  public_djen_enabled = true,
  authenticated_adapter = excluded.authenticated_adapter,
  authenticated_status = excluded.authenticated_status,
  capabilities = excluded.capabilities,
  updated_at = now();

commit;
