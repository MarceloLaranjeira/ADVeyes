# WhatsApp Cloud API por escritório — desenho

## Objetivo

Transformar a tela WhatsApp do ADVeyes em um hub multi-escritório conectado à
WhatsApp Cloud API. Cada escritório conecta a própria conta pelo Embedded
Signup do app Meta do ADVeyes e mantém a cobrança diretamente com a Meta.

## Escopo da primeira entrega

1. Corrigir ações mutáveis apresentadas no modo de visualização da Conta Geral.
2. Corrigir a reconciliação DJEN para que falhas transitórias não deixem fontes
   permanentemente interrompidas.
3. Persistir uma conexão WhatsApp por escritório, protegida por RLS.
4. Implementar o callback de onboarding, receptor de webhook e envio de texto
   e templates pela Cloud API.
5. Substituir o atalho de WhatsApp Web por uma tela de conexão e conversas.
6. Documentar os endpoints internos de integração e a configuração necessária.

## Fluxo de conexão

```text
Administrador do escritório
  -> "Conectar WhatsApp" no ADVeyes
  -> Meta Embedded Signup
  -> código de autorização + WABA/phone number id
  -> Edge Function troca o código no servidor
  -> adiciona o system user do provedor, registra o número e assina a WABA
  -> salva IDs e token cifrado no tenant
  -> conexão operacional
```

O browser recebe apenas o App ID e o Configuration ID públicos. `META_APP_SECRET`,
token de system user e tokens de acesso nunca são devolvidos pela API.

## Dados e segurança

- `whatsapp_connections`: uma conexão ativa por tenant, com WABA, número e
  token cifrado AES-GCM.
- `whatsapp_conversations` e `whatsapp_messages`: histórico e estados de
  entrega, isolados por `tenant_id`.
- `whatsapp_webhook_events`: deduplicação por id de evento/mensagem e trilha
  de auditoria sem segredos.
- Somente `owner` e `admin` podem conectar, desconectar ou enviar mensagens.
- O webhook é público somente para Meta, verifica desafio e assinatura
  `x-hub-signature-256` antes de persistir eventos.

## Cobrança

O ADVeyes não compartilha linha de crédito nem intermedeia cobrança. O
onboarding orienta o cliente a concluir pagamento diretamente no Business
Manager/WhatsApp Business da Meta.

## Operação e observabilidade

- Webhooks são idempotentes; reentregas não duplicam mensagens.
- Erros de envio ficam registrados no histórico com diagnóstico sanitizado.
- Falhas transitórias de DJEN continuam ativas com próximo agendamento; apenas
  erros explicitamente permanentes pausam a fonte.
- A Conta Geral em visualização bloqueia ações de escrita antes de chamar o
  backend e orienta a ativar suporte temporário.

## Configuração posterior ao deploy

Configurar apenas no servidor:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_SYSTEM_USER_TOKEN`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_TOKEN_ENCRYPTION_KEY` (base64, 32 bytes)

No painel Meta, cadastrar a URL da função `whatsapp-webhook` e assinar os
campos de mensagens e status. Cada escritório conclui cobrança diretamente na
Meta durante o Embedded Signup.
