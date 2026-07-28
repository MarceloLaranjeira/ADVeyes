# Checklist operacional — migração multiempresa

**Projeto:** ADVeyes  
**Plano:** `docs/superpowers/plans/2026-07-28-adveyes-multitenant-whitelabel.md`

Este documento é preenchido em cada ensaio e na mudança de produção. Não
registre senhas, tokens, connection strings ou chaves.

## 1. Identificação do ambiente

- [ ] Ambiente: `local` / `homologação` / `produção`
- [ ] Project ref ou identificador não secreto:
- [ ] Responsável:
- [ ] Data e hora:
- [ ] Commit implantado:
- [ ] Versão do Supabase CLI:
- [ ] Versão do Postgres:

## 2. Proteção do estado

- [ ] `git status --short` está limpo.
- [ ] Testes do baseline passam.
- [ ] TypeScript passa.
- [ ] Build de produção passa.
- [ ] Backup foi concluído.
- [ ] O backup tem data, tamanho e checksum registrados fora do repositório.
- [ ] A restauração foi testada em ambiente descartável.
- [ ] O resultado de `scripts/multitenant-preflight.sql` foi arquivado.

## 3. Segredos e integrações

Confirmar existência sem copiar valores:

- [ ] `ASAAS_API_KEY`
- [ ] `ASAAS_WEBHOOK_TOKEN`
- [ ] `CRON_SECRET`
- [ ] `DATAJUD_API_KEY`
- [ ] `LOVABLE_API_KEY`
- [ ] `GOOGLE_CALENDAR_CLIENT_ID`
- [ ] `GOOGLE_CALENDAR_CLIENT_SECRET`
- [ ] `GOOGLE_CALENDAR_REDIRECT_URI`
- [ ] `GOOGLE_TOKEN_ENCRYPTION_KEY`
- [ ] `GOOGLE_CALENDAR_WORKER_SECRET`
- [ ] `APP_URL`

## 4. Antes das migrations

- [ ] As migrations locais reproduzem o schema do ambiente.
- [ ] Não há migration local presente apenas remotamente ou vice-versa.
- [ ] O tenant Albertino ainda não existe ou sua existência foi tratada de
      forma idempotente.
- [ ] Os três usuários existentes foram localizados.
- [ ] O owner foi confirmado explicitamente.
- [ ] Contagens das tabelas foram registradas.
- [ ] Policies e funções privilegiadas foram revisadas.
- [ ] Jobs cron ativos foram registrados.
- [ ] Bucket e quantidade de objetos foram registrados.

## 5. Depois de cada grupo de migrations

- [ ] Executar testes SQL.
- [ ] Executar advisors de segurança.
- [ ] Executar advisors de desempenho.
- [ ] Comparar contagens de registros.
- [ ] Confirmar zero linhas empresariais órfãs.
- [ ] Testar usuário do tenant A contra dados do tenant B.
- [ ] Verificar logs sem dados sensíveis.
- [ ] Registrar duração e erros.

## 6. Ensaio de rollback

- [ ] Feature flags retornam ao comportamento anterior.
- [ ] As colunas legadas continuam disponíveis.
- [ ] Nenhuma etapa depende de apagar migration aplicada.
- [ ] A aplicação anterior abre e consulta dados.
- [ ] Jobs novos podem ser pausados sem afetar os antigos.

## 7. Liberação de produção

- [ ] Janela aprovada pelo responsável.
- [ ] Backup final confirmado.
- [ ] Homologação passou pelos critérios da especificação.
- [ ] DNS não será alterado na mesma etapa das migrations de banco.
- [ ] Cobrança nova inicia em modo observação.
- [ ] Bloqueios comerciais continuam desligados.
- [ ] Canal de suporte e responsável pelo rollback estão definidos.

## 8. Evidências

| Evidência | Local seguro | Resultado |
|---|---|---|
| Pré-voo SQL |  |  |
| Backup |  |  |
| Restauração |  |  |
| Testes RLS |  |  |
| Advisors |  |  |
| Testes frontend |  |  |
| Testes Edge Functions |  |  |

