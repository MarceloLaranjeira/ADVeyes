-- Global provider credentials are encrypted in Vault and are never exposed to
-- browser roles. Platform administrators access them only through an
-- authenticated Edge Function which, in turn, calls these service-role RPCs.

alter table public.process_movements
  add column if not exists process_number text,
  add column if not exists client_name text;

update public.process_movements movement
set
  process_number = process.numero,
  client_name = process.cliente_nome
from public.processos process
where process.tenant_id = movement.tenant_id
  and process.id = movement.process_id
  and (
    movement.process_number is distinct from process.numero
    or movement.client_name is distinct from process.cliente_nome
  );

with document_types as (
  select
    movement.id,
    coalesce(
      complement ->> 'nome',
      complement ->> 'valor'
    ) as document_type
  from public.process_movements movement
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(movement.provider_payload -> 'complementosTabelados') = 'array'
        then movement.provider_payload -> 'complementosTabelados'
      else '[]'::jsonb
    end
  ) complement
  where movement.provider = 'datajud'
    and lower(coalesce(complement ->> 'descricao', '')) in (
      'tipo_de_documento', 'tipo_documento'
    )
)
update public.process_movements movement
set
  title = case
    when lower(btrim(coalesce(movement.title, ''))) in (
      'documento', 'movimento', 'movimentação', 'movimentacao'
    ) and nullif(btrim(document_types.document_type), '') is not null
      then document_types.document_type
    else movement.title
  end,
  movement_type = 'DOCUMENTO',
  content = case
    when lower(btrim(coalesce(movement.title, ''))) in (
      'documento', 'movimento', 'movimentação', 'movimentacao'
    ) and nullif(btrim(document_types.document_type), '') is not null
      then 'Documento registrado: ' || document_types.document_type || '.'
    else replace(
      replace(movement.content, 'tipo_de_documento:', 'Tipo de documento:'),
      'tipo_documento:',
      'Tipo de documento:'
    )
  end
from document_types
where movement.id = document_types.id;

update public.process_movements
set content = replace(
  replace(
    replace(
      replace(content, 'resultado:', 'Resultado:'),
      'quantidade:', 'Quantidade:'
    ),
    'tipo:', 'Tipo:'
  ),
  'situacao:', 'Situação:'
)
where provider = 'datajud';

update public.publicacoes
set conteudo = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(conteudo, '&Aacute;', 'Á'),
                  '&aacute;', 'á'
                ),
                '&Ccedil;', 'Ç'
              ),
              '&ccedil;', 'ç'
            ),
            '&Eacute;', 'É'
          ),
          '&eacute;', 'é'
        ),
        '&Iacute;', 'Í'
      ),
      '&iacute;', 'í'
    ),
    '&atilde;', 'ã'
  ),
  '&ordm;', 'º'
)
where provider = 'djen'
  and conteudo like '%&%;';

create index if not exists process_movements_process_number_idx
  on public.process_movements (tenant_id, process_number);

create table if not exists public.platform_audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) between 2 and 120),
  target_type text check (
    target_type is null or length(btrim(target_type)) between 2 and 80
  ),
  target_id text,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  occurred_at timestamptz not null default now()
);

create index if not exists platform_audit_events_time_idx
  on public.platform_audit_events (occurred_at desc);

alter table public.platform_audit_events enable row level security;
revoke all on table public.platform_audit_events
  from public, anon, authenticated;
grant all on table public.platform_audit_events to service_role;

create or replace function public.platform_get_integration_secret(
  p_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_value text;
begin
  if p_name not in ('escavador_api_token') then
    raise exception using message = 'invalid_secret_name';
  end if;

  select secret.decrypted_secret
  into secret_value
  from vault.decrypted_secrets secret
  where secret.name = p_name
  limit 1;

  return secret_value;
end;
$$;

create or replace function public.platform_integration_secret_status(
  p_name text
)
returns table(configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name not in ('escavador_api_token') then
    raise exception using message = 'invalid_secret_name';
  end if;

  return query
  select true, secret.updated_at
  from vault.secrets secret
  where secret.name = p_name
  limit 1;

  if not found then
    return query select false, null::timestamptz;
  end if;
end;
$$;

create or replace function public.platform_upsert_integration_secret(
  p_name text,
  p_secret text,
  p_description text default null
)
returns table(configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if p_name not in ('escavador_api_token') then
    raise exception using message = 'invalid_secret_name';
  end if;
  if length(btrim(coalesce(p_secret, ''))) < 16
    or length(p_secret) > 4096 then
    raise exception using message = 'invalid_secret_value';
  end if;

  select secret.id
  into secret_id
  from vault.secrets secret
  where secret.name = p_name
  limit 1;

  if secret_id is null then
    perform vault.create_secret(
      p_secret,
      p_name,
      coalesce(p_description, 'Credencial global de integração do ADVeyes')
    );
  else
    perform vault.update_secret(
      secret_id,
      p_secret,
      p_name,
      coalesce(p_description, 'Credencial global de integração do ADVeyes')
    );
  end if;

  return query
  select true, secret.updated_at
  from vault.secrets secret
  where secret.name = p_name
  limit 1;
end;
$$;

revoke all on function public.platform_get_integration_secret(text)
  from public, anon, authenticated;
revoke all on function public.platform_integration_secret_status(text)
  from public, anon, authenticated;
revoke all on function public.platform_upsert_integration_secret(text, text, text)
  from public, anon, authenticated;

grant execute on function public.platform_get_integration_secret(text)
  to service_role;
grant execute on function public.platform_integration_secret_status(text)
  to service_role;
grant execute on function public.platform_upsert_integration_secret(text, text, text)
  to service_role;

comment on function public.platform_get_integration_secret(text) is
  'Returns a platform integration secret only to the service role.';
comment on function public.platform_upsert_integration_secret(text, text, text) is
  'Creates or rotates a platform integration secret in Supabase Vault.';
