-- O identificador persistido do conector inclui o tribunal (projudi_tjam).

update public.legal_portal_connections
set
  status = 'pending',
  last_error_code = 'credential_missing',
  last_error_at = now(),
  last_result = jsonb_build_object(
    'code', 'credential_missing',
    'message', 'A credencial protegida não está disponível. Reconecte o acesso ao tribunal.'
  ),
  updated_at = now()
where provider like 'projudi%'
  and vault_secret_id is null
  and last_validated_at is null
  and status in ('active', 'invalid', 'validating', 'paused');
