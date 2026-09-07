# ADVeyes — plano de implementação da release operacional e API pública

## Resultado esperado

Entregar em produção uma API server-to-server versionada para contatos,
processos e tarefas, com gestão de tokens por escritório, idempotência,
auditoria, soft delete, webhooks persistentes e documentação OpenAPI. Preservar
o núcleo operacional e as mudanças locais existentes. Preparar adaptadores
JUDIT, TrackJud e Conecta sem ativá-los sem credenciais ou autorização.

## Tarefa 1 — Congelar contratos e invariantes

### Arquivos

- criar `supabase/functions/_shared/public-api-contract.ts`;
- criar `src/test/public-api-contract.test.ts`;
- criar `src/test/public-api-schema.test.ts`.

### Passos

1. Definir recursos, campos públicos, escopos, eventos e erros estáveis.
2. Implementar parser de rota, cursor opaco, mapeamento de entrada/saída e
   validações puras.
3. Testar rejeição de `tenant_id`, `user_id` e campos internos.
4. Testar cursores, escopos e transições de eventos.

## Tarefa 2 — Criar a fundação SQL

### Arquivos

- gerar com `npx supabase migration new public_api_foundation`;
- editar somente o arquivo criado pelo CLI;
- ampliar `supabase/tests` com invariantes da API pública;
- atualizar os tipos Supabase após verificar a migration.

### Passos

1. Adicionar `deleted_at` a contatos, processos e tarefas.
2. Criar `api_tokens`, `api_idempotency_keys`, `api_request_logs`,
   `domain_events`, `webhook_endpoints` e `webhook_deliveries`.
3. Criar índices, checks, FKs e retenção necessária.
4. Habilitar RLS e revogar acesso de `anon` e `authenticated` às tabelas
   internas.
5. Criar gatilhos que produzam eventos e outbox para mudanças dos três
   domínios, sem payloads internos ou segredos.
6. Garantir que eventos de conclusão e exclusão lógica não sejam duplicados.

## Tarefa 3 — Implementar gestão de credenciais

### Arquivos

- criar `supabase/functions/public-api-admin/index.ts`;
- criar `src/services/public-api-admin.ts`;
- criar `src/components/configuracoes/ApiIntegrationSettings.tsx`;
- integrar o componente à aba `Integrações & API` de `Configuracoes.tsx`;
- atualizar `supabase/config.toml`.

### Passos

1. Validar JWT e vínculo `owner` ou `admin` sem confiar em metadata editável.
2. Criar tokens aleatórios, persistir somente SHA-256 e exibir o segredo uma
   vez.
3. Listar e revogar tokens sem retornar hashes.
4. Criar e administrar destinos de webhook.
5. Cifrar o segredo do webhook com AES-GCM e
   `WEBHOOK_SECRET_ENCRYPTION_KEY`.
6. Exibir tokens e secrets uma única vez, com aviso de armazenamento seguro.

## Tarefa 4 — Implementar o gateway `/api/v1`

### Arquivos

- criar `supabase/functions/public-api/index.ts`;
- atualizar `supabase/config.toml`;
- atualizar `vercel.json` com proxy explícito para `/api/v1/*`.

### Passos

1. Desativar validação JWT do gateway e validar o bearer customizado dentro da
   função.
2. Resolver o tenant exclusivamente pelo hash do token.
3. Aplicar expiração, revogação, escopos e rate limit.
4. Implementar CRUD de contatos, processos e tarefas com campos permitidos.
5. Exigir e persistir `Idempotency-Key` em mutações.
6. Retornar cursores, `X-Request-Id` e erros `application/problem+json`.
7. Registrar auditoria técnica sem corpo sensível.

## Tarefa 5 — Entregar webhooks confiáveis

### Arquivos

- criar `supabase/functions/_shared/public-api-crypto.ts`;
- criar `supabase/functions/public-api-webhook-worker/index.ts`;
- gerar com `npx supabase migration new schedule_public_api_webhooks`;
- atualizar `supabase/config.toml`;
- criar testes de assinatura e retry.

### Passos

1. Buscar entregas vencidas em lotes pequenos.
2. Assinar o corpo bruto com HMAC-SHA256.
3. Enviar headers de evento, timestamp e assinatura.
4. Aplicar a política aprovada de tentativas e estado final.
5. Proteger o worker com `CRON_SECRET` e agendar via `pg_cron`/`pg_net`.
6. Permitir reprocessamento administrativo sem duplicar eventos.

## Tarefa 6 — Preparar roteamento jurídico econômico

### Arquivos

- criar `supabase/functions/_shared/legal-provider-router.ts`;
- criar `supabase/functions/_shared/judit-client.ts`;
- criar `supabase/functions/_shared/trackjud-client.ts`;
- criar testes de capacidades e escolha do provedor;
- ampliar status de integrações administrativas.

### Passos

1. Declarar capacidades por fonte e impedir chamadas incompatíveis.
2. Priorizar DataJud/DJEN e escolher somente um fallback pago.
3. Implementar clientes JUDIT e TrackJud sem ativação automática.
4. Registrar custo estimado, latência e motivo do fallback.
5. Manter Escavador como último fallback.
6. Declarar conectores Conecta como indisponíveis até autorização oficial.

## Tarefa 7 — Publicar documentação de integração

### Arquivos

- criar `docs/api/openapi.yaml`;
- criar `docs/api/getting-started.md`;
- criar `docs/api/webhooks.md`;
- criar `public/api/docs/index.html`;
- disponibilizar o OpenAPI em `public/api/openapi.yaml`.

### Passos

1. Documentar autenticação, escopos, paginação, idempotência e erros.
2. Documentar todos os endpoints e schemas reais.
3. Incluir exemplos em cURL e JavaScript sem dados ou secrets reais.
4. Validar que a interface navegável carrega o mesmo contrato versionado.

## Tarefa 8 — Verificar e publicar

### Ordem

1. Rodar testes focados de contrato, schema, crypto e roteador.
2. Rodar `npx tsc --noEmit`, testes completos, lint focado e build.
3. Aplicar migrations no Supabase vinculado e executar testes SQL.
4. Configurar `WEBHOOK_SECRET_ENCRYPTION_KEY` sem registrar o valor.
5. Implantar as três Edge Functions com API deployment.
6. Publicar a Vercel, validar documentação e smoke test autenticado.
7. Criar token de teste, executar CRUD idempotente e entregar webhook de teste.
8. Manter JUDIT, TrackJud e Conecta desativados sem credenciais.

## Critério de conclusão

A implementação estará concluída quando proprietário ou administrador puder
criar e revogar um token, um parceiro puder usar o contrato documentado sem
informar `tenant_id`, repetição idempotente não duplicar dados, um webhook
assinado for entregue e os módulos operacionais existentes continuarem passando
pelas verificações de release.

