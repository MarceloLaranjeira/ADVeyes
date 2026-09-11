-- A tentativa anterior ao leitor de frames não armazenou a credencial.
-- Remove somente o diagnóstico obsoleto para permitir nova validação no TJAM.
update public.legal_portal_connections
set status = 'pending',
    last_error_code = null,
    last_error_at = null,
    updated_at = now()
where provider = 'projudi_tjam'
  and court_code = 'TJAM'
  and vault_secret_id is null
  and status = 'paused'
  and last_error_code = 'layout_changed';
