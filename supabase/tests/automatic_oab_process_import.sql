begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select has_column(
  'public',
  'process_parties',
  'contact_data',
  'partes preservam dados públicos de contato normalizados'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.process_parties',
    'contact_data',
    'select'
  ),
  'authenticated pode ler contato sanitizado da parte'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.process_parties',
    'provider_payload',
    'select'
  ),
  'payload bruto continua oculto do navegador'
);

select has_trigger(
  'public',
  'lawyer_registrations',
  'lawyer_registrations_sync_source',
  'cadastro de OAB mantém gatilho de fontes automáticas'
);

select ok(
  position(
    '''datajud''' in pg_get_functiondef(
      'private.sync_source_for_lawyer_registration()'::regprocedure
    )
  ) > 0,
  'gatilho de OAB inclui fallback DataJud'
);

select * from finish();
rollback;
