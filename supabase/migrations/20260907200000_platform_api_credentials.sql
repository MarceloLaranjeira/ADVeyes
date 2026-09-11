-- Credencial de plataforma para a API pública.
--
-- Até aqui todo token pertencia a um escritório. A operadora da plataforma
-- precisa alcançar os escritórios existentes e os que ainda vão nascer sem
-- emitir e cadastrar uma credencial por tenant, então o token de plataforma
-- não carrega tenant: ele escolhe o escritório em cada requisição.

alter table public.api_tokens
  alter column tenant_id drop not null;

alter table public.api_tokens
  add column if not exists is_platform boolean not null default false;

-- O par (is_platform, tenant_id) é a única fonte de verdade do alcance do
-- token. Um token de plataforma nunca tem tenant; um de escritório sempre tem.
alter table public.api_tokens
  drop constraint if exists api_tokens_scope_ck;
alter table public.api_tokens
  add constraint api_tokens_scope_ck
  check (is_platform = (tenant_id is null));

-- A unicidade original era (tenant_id, token_prefix) e não alcança linhas com
-- tenant nulo, porque NULL nunca conflita em índice único comum.
create unique index if not exists api_tokens_platform_prefix_key
  on public.api_tokens (token_prefix)
  where tenant_id is null;

-- Uma chamada de plataforma que apenas lista escritórios não age sobre nenhum
-- deles, mas continua sendo auditada.
alter table public.api_request_logs
  alter column tenant_id drop not null;

create index if not exists api_request_logs_platform_idx
  on public.api_request_logs (api_token_id, created_at desc)
  where tenant_id is null;
