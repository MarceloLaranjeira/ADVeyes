# Plano de implementação: conta geral e integração jurídica híbrida

## Referência

Especificação aprovada:
`docs/superpowers/specs/2026-07-30-conta-geral-integracao-juridica-hibrida-design.md`.

## Etapa 1 — Contratos e testes de banco

- Criar testes pgTAP para administrador da plataforma, isolamento entre tenants,
  OABs, candidatos, vínculos e eventos idempotentes.
- Criar a migration exclusivamente com `supabase migration new`.
- Preservar tabelas legadas e migrar sem apagar registros.

## Etapa 2 — Conta geral

- Expor RPC mínima `current_user_is_platform_admin`.
- Expor RPC administrativa server-only para visão geral e listagem de tenants.
- Criar Edge Function `platform-admin` com autenticação e autorização explícita.
- Criar rota `/admin`, layout e visão geral.
- Redirecionar administradores para `/admin` após login no domínio central.
- Identificar e auditar o acesso administrativo a um escritório.

## Etapa 3 — Base jurídica multi-tenant

- Criar `lawyer_registrations`, `process_discoveries`, `process_lawyers`,
  `legal_provider_monitors`, `process_movements`, `legal_provider_events` e
  `legal_usage_events`.
- Adicionar RLS por tenant e índices de idempotência.
- Tornar novas escritas dependentes de membership ativa.

## Etapa 4 — Descoberta híbrida

- Criar biblioteca compartilhada para cliente Escavador V2.
- Implementar busca paginada por OAB conforme documentação oficial.
- Persistir candidatos sem criar monitoramento pago.
- Consultar DataJud como validação/fallback, sem chamar movimentação de
  publicação.

## Etapa 5 — Confirmação e monitoramento

- Confirmar candidatos individualmente ou em lote.
- Criar processo canônico e vínculo com advogado.
- Criar monitoramento idempotente somente após confirmação.
- Registrar uso, auditoria e estados do provedor.

## Etapa 6 — Callback Escavador

- Criar `escavador-webhook` sem JWT, protegido pelo token de callback.
- Validar payload, localizar monitor interno e deduplicar evento.
- Separar movimentação, publicação e documento.
- Enfileirar notificações depois da persistência.

## Etapa 7 — Interface do escritório

- Adicionar OAB estruturada ao perfil do advogado.
- Criar caixa de processos encontrados com confirmação e impacto no plano.
- Exibir monitoramentos, falhas e consumo.

## Etapa 8 — Verificação e implantação

- Rodar testes pgTAP, testes React, TypeScript, lint e build.
- Rodar advisors e revisar funções privilegiadas.
- Configurar segredos sem registrar os valores.
- Implantar migrations e funções sem ativar monitoramento.
- Validar descoberta com uma OAB autorizada.
- Ativar apenas um processo piloto após nova confirmação explícita.

## Restrições

- Nenhuma chave no frontend ou no repositório.
- Nenhuma rota antiga da API V1 misturada com V2.
- Nenhum monitoramento real durante testes automatizados.
- Nenhuma escrita sem `tenant_id`.
- Nenhuma autorização baseada em `user_metadata`.
- Toda função privilegiada tem grants mínimos e auditoria.

