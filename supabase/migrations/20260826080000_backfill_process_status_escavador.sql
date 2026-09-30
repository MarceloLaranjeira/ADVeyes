-- Recupera a baixa do tribunal nas descobertas que a perderam na gravação.
--
-- `process_discoveries.process_status` guarda o `fontes_tribunais_estao_
-- arquivadas` do Escavador, e é dele que a view `processos_carteira_ativa`
-- tira a terceira fonte de arquivamento. Só que existiam dois caminhos
-- gravando descoberta do Escavador a partir do mesmo payload, e apenas um
-- preenchia o campo: `legal-discover-lawyer-processes` sim, o trecho de
-- Escavador do `legal-reconcile` não.
--
-- O resultado é que parte da base tem `process_status` nulo em processos que
-- o tribunal já arquivou — e nulo, na view, significa "esta fonte não se
-- pronunciou". Eles continuariam na carteira ativa indefinidamente.
--
-- O payload cru foi guardado em `provider_payload`, então a informação não se
-- perdeu: dá para reconstruir o campo a partir dele.

begin;

update public.process_discoveries
set process_status = case
      when (provider_payload ->> 'fontes_tribunais_estao_arquivadas')::boolean
        then 'INATIVO'
      else 'ATIVO'
    end
where provider = 'escavador'
  and process_status is null
  -- Só onde o payload realmente traz a chave. Ausente significa que o
  -- provedor não informou, e inventar 'ATIVO' aí seria afirmar o que não se
  -- sabe — exatamente o oposto do que esta migration existe para corrigir.
  and provider_payload ? 'fontes_tribunais_estao_arquivadas'
  and jsonb_typeof(provider_payload -> 'fontes_tribunais_estao_arquivadas')
      = 'boolean';

commit;
