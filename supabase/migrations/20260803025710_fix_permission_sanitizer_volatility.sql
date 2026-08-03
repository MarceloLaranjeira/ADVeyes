-- `jsonb_set` e os operadores de jsonb sao STABLE, entao marcar o sanitizador
-- como IMMUTABLE permitia ao planejador inlinar ou cachear o resultado
-- indevidamente. O corpo permanece igual; muda apenas a volatilidade.

create or replace function private.sanitize_permission_overrides(
  p_overrides jsonb
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  module_key text;
  action_key text;
  actions jsonb;
  raw_value text;
  normalized_value text;
  result jsonb := '{}'::jsonb;
begin
  if p_overrides is null or jsonb_typeof(p_overrides) <> 'object' then
    return '{}'::jsonb;
  end if;

  for module_key in select jsonb_object_keys(p_overrides) loop
    actions := p_overrides -> module_key;
    continue when jsonb_typeof(actions) <> 'object';

    for action_key in select jsonb_object_keys(actions) loop
      continue when not private.allowed_permission_override(
        module_key,
        action_key
      );

      raw_value := lower(coalesce(actions ->> action_key, ''));
      normalized_value := case
        when raw_value in ('allow', 'true') then 'allow'
        when raw_value = 'deny' then 'deny'
        else null
      end;

      if normalized_value is not null then
        result := jsonb_set(
          result,
          array[module_key, action_key],
          to_jsonb(normalized_value),
          true
        );
      end if;
    end loop;
  end loop;

  return result;
end;
$$;

revoke all on function private.sanitize_permission_overrides(jsonb)
from public, anon, authenticated;
