# Release operacional — enriquecimento público de contatos

Data: 2026-09-01

## Componentes

- migration `20260902014752_contact_public_enrichment.sql`;
- Edge Function `contact-enrichment-worker`;
- adaptadores BrasilAPI e OpenCNPJ;
- integração com a reconciliação de partes processuais;
- estados de enriquecimento na tela de contatos.

## Segredos

Não há segredo novo para os provedores gratuitos. O agendamento reutiliza os
segredos existentes do Vault:

- `project_url`;
- `cron_secret`.

O trabalhador valida `x-cron-secret` e não aceita chamadas públicas anônimas.

## Operação

O cron `contact-enrichment-worker-every-5-minutes` processa até dez trabalhos
por execução. Leases vencidos retornam ao processamento, e falhas transitórias
usam backoff progressivo até oito tentativas.

Consultas úteis:

```sql
select status, provider, count(*)
from public.contact_enrichment_jobs
group by status, provider
order by status, provider;
```

```sql
select count(*) as due
from public.contact_enrichment_jobs
where status in ('pending', 'retry')
  and next_attempt_at <= now();
```

## Privacidade

A fila não é exposta ao navegador. CNPJ completo não é incluído em logs ou
erros, o payload integral dos provedores não é persistido e nenhum CPF participa
do pipeline.

## Limitações esperadas

Uma capa sem CNPJ completo continuará exibindo apenas nome, papel e vínculos
processuais. Um cadastro empresarial também pode não possuir telefone ou e-mail
publicado. Esses casos são estados válidos, não falhas silenciosas.

## Rollback

O frontend e a Edge Function podem ser revertidos sem perder os contatos. A
fila é aditiva e não altera dados manuais. Não remover a tabela enquanto houver
uma versão do reconciliador que chame `enqueue_contact_enrichment`.
