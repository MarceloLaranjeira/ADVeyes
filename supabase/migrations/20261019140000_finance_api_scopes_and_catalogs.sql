begin;

-- Escopos financeiros para tokens da API (rotas /transactions no formato ADVBOX).
alter table public.api_tokens drop constraint api_tokens_scopes_check;
alter table public.api_tokens add constraint api_tokens_scopes_check check (
  cardinality(scopes) between 1 and 9
  and scopes <@ array[
    'contacts:read', 'contacts:write',
    'processes:read', 'processes:write',
    'tasks:read', 'tasks:write',
    'finance:read', 'finance:write',
    'webhooks:manage'
  ]::text[]
);

-- Cadastros financeiros no mesmo catálogo das demais configurações.
alter table public.catalogo_escritorio drop constraint catalogo_escritorio_tipo_check;
alter table public.catalogo_escritorio add constraint catalogo_escritorio_tipo_check check (tipo in (
  'grupo_acao', 'tipo_acao', 'etapa', 'origem_pessoa', 'termo_monitorado', 'meta',
  'categoria_financeira', 'centro_custo', 'conta_bancaria', 'departamento'
));

-- Classificação opcional dos lançamentos; a API valida o escritório e o tipo.
alter table public.financeiro
  add column if not exists categoria_id uuid references public.catalogo_escritorio(id) on delete set null,
  add column if not exists centro_custo_id uuid references public.catalogo_escritorio(id) on delete set null,
  add column if not exists conta_id uuid references public.catalogo_escritorio(id) on delete set null;

commit;
