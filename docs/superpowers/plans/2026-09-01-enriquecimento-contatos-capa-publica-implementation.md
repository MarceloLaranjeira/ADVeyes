# Implementação — enriquecimento de contatos da capa pública

Data: 2026-09-01  
Design: `docs/superpowers/specs/2026-09-01-enriquecimento-contatos-capa-publica-design.md`

## Etapa 1 — Contrato e normalização dos provedores

Arquivos:

- criar `supabase/functions/_shared/contact-enrichment.ts`;
- criar `src/test/contact-enrichment.test.ts`.

Implementar:

1. validação de CNPJ numérico e alfanumérico;
2. normalização segura de telefone, e-mail e endereço;
3. adaptador BrasilAPI;
4. adaptador OpenCNPJ;
5. verificação de que o CNPJ da resposta coincide com o consultado;
6. classificação de erros transitórios, não encontrados e respostas inválidas;
7. contrato comum que permita adicionar SERPRO posteriormente.

## Etapa 2 — Fila durável, isolamento e backfill

Arquivos:

- gerar migration `contact_public_enrichment` pela Supabase CLI;
- atualizar os tipos gerados depois da migration.

Criar:

1. `contact_enrichment_jobs`, com vínculo composto de tenant e contato;
2. estados, tentativas, lease, próxima execução, provedor e resultado;
3. índice parcial da fila e unicidade idempotente;
4. RLS habilitada, acesso revogado ao navegador e permissão exclusiva ao
   `service_role`;
5. RPC atômica para reclamar trabalhos com `skip locked`;
6. gatilho que enfileira contatos quando um CNPJ completo é salvo;
7. backfill idempotente dos contatos e partes existentes com CNPJ completo;
8. agendamento por `pg_cron` e `pg_net`, usando o segredo existente do Vault.

## Etapa 3 — Integração com a capa processual

Arquivos:

- alterar `supabase/functions/_shared/legal-ingestion.ts`;
- complementar testes de ingestão e reconciliação.

Depois de criar ou vincular o contato:

1. detectar CNPJ completo recebido legalmente pela fonte;
2. enfileirar o contato sem bloquear a sincronização processual;
3. não enfileirar CPF, documento mascarado ou valor inválido;
4. preservar dados e classificações manuais;
5. corrigir o retorno precoce de processos sem `user_id`, usando um proprietário
   válido do tenant apenas quando a coluna legada ainda exigir esse valor.

## Etapa 4 — Trabalhador de enriquecimento

Arquivos:

- criar `supabase/functions/contact-enrichment-worker/index.ts`;
- criar testes de comportamento do trabalhador quando aplicável.

O trabalhador:

1. aceita somente chamadas internas autenticadas por `CRON_SECRET`;
2. recupera leases vencidos;
3. reclama um lote pequeno atomicamente;
4. consulta BrasilAPI e usa OpenCNPJ como contingência;
5. relê o contato antes da escrita;
6. preenche apenas campos vazios;
7. registra metadados por campo, sem salvar payload integral;
8. conclui, agenda retentativa ou marca ausência de dados;
9. nunca inclui CNPJ completo em logs ou erros.

## Etapa 5 — Interface de contatos

Arquivos:

- alterar `src/pages/Clientes.tsx`;
- complementar o teste da página de contatos.

Exibir:

1. selo para contato enriquecido por fonte empresarial pública;
2. fonte e data da última consulta;
3. estado aguardando ou retentativa quando aplicável;
4. mensagem específica para CNPJ ausente;
5. mensagem específica para cadastro público sem meios de contato.

## Etapa 6 — Documentação operacional e de API

Arquivos:

- atualizar `docs/integracoes/provedores-juridicos.md`;
- criar registro de release em `docs/operations/`.

Documentar fontes, limites, privacidade, backfill, agendamento, observabilidade e
ativação futura do SERPRO.

## Etapa 7 — Verificação e publicação

1. rodar testes focados;
2. rodar toda a suíte;
3. rodar TypeScript, lint e build;
4. aplicar migration em produção;
5. publicar a Edge Function com JWT obrigatório conforme a configuração interna;
6. atualizar tipos e publicar o frontend;
7. validar filas, cron, logs, políticas e contagens;
8. confirmar em produção que dados manuais não foram alterados;
9. acompanhar o primeiro backfill e registrar seus resultados.
