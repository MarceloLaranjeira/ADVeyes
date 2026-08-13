begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_table('public', 'process_parties', 'tabela de partes existe');
select has_table('public', 'process_documents', 'tabela de documentos públicos existe');
select has_column('public', 'processos', 'legal_sync_status', 'processo possui estado de sync');
select has_column('public', 'process_movements', 'complements', 'movimento possui complementos estruturados');
select has_column('public', 'publicacoes', 'recipients', 'publicação possui destinatários');
select has_column('public', 'audiencias', 'review_status', 'audiência possui revisão humana');
select has_column('public', 'clientes', 'relationship_type', 'contato possui classificação');

select ok(
  has_any_column_privilege('authenticated', 'public.process_parties', 'select'),
  'authenticated pode consultar colunas sanitizadas de partes'
);
select ok(
  not has_column_privilege('authenticated', 'public.process_parties', 'provider_payload', 'select'),
  'payload bruto de partes não é exposto ao navegador'
);
select ok(
  has_any_column_privilege('authenticated', 'public.process_documents', 'select'),
  'authenticated pode consultar colunas sanitizadas de documentos'
);
select ok(
  not has_column_privilege('authenticated', 'public.process_documents', 'provider_payload', 'select'),
  'payload bruto de documentos não é exposto ao navegador'
);
select ok(
  not has_table_privilege('anon', 'public.process_parties', 'select'),
  'anon não consulta partes'
);
select ok(
  not has_table_privilege('anon', 'public.process_documents', 'select'),
  'anon não consulta documentos'
);
select policies_are(
  'public',
  'process_documents',
  array['process_documents_tenant_read'],
  'documentos possuem somente política de leitura pública por tenant'
);

select * from finish();
rollback;
