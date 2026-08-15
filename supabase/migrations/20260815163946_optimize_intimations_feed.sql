-- A listagem global de andamentos ordena por escritório e data. Sem este
-- índice, escritórios com dezenas de milhares de eventos excedem o timeout do
-- PostgREST e impedem inclusive a exibição das intimações.
create index if not exists process_movements_tenant_occurred_idx
  on public.process_movements (tenant_id, occurred_at desc);

-- A situação das fontes usa a mesma ordenação por escritório.
create index if not exists legal_sync_sources_tenant_next_idx
  on public.legal_sync_sources (tenant_id, next_sync_at);
