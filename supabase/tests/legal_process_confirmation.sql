begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

select has_table(
  'private',
  'legal_process_registry',
  'registro canônico preserva processos existentes e impede novas duplicações'
);

select has_function(
  'public',
  'confirm_discovered_process',
  array['uuid', 'uuid', 'uuid', 'text', 'boolean'],
  'confirmação idempotente e transacional existe'
);

select * from finish();

rollback;
