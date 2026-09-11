# Integração WhatsApp Cloud API — ADVeyes

Cada escritório conecta a própria WhatsApp Business Account (WABA) pelo
Embedded Signup do app Meta do ADVeyes. A cobrança permanece diretamente entre
o escritório e a Meta; o ADVeyes não compartilha linha de crédito.

## Configuração do provedor

Cadastre como segredos das Edge Functions:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_TOKEN_ENCRYPTION_KEY` — 32 bytes em base64url ou 64 caracteres hex
- `META_SYSTEM_USER_TOKEN` — opcional; atribui `MANAGE` ao system user do
  provedor, mas nunca é salvo como token de um escritório
- `META_GRAPH_VERSION` — opcional; padrão `v23.0`

O webhook da Meta deve apontar para:

`https://mrgxxwllthlwxqhehjwp.supabase.co/functions/v1/whatsapp-webhook`

Use `META_WEBHOOK_VERIFY_TOKEN` como token de verificação e assine o campo
`messages`. O receptor verifica `x-hub-signature-256` com o App Secret antes de
interpretar o JSON.

## Fluxo no ADVeyes

1. O owner/admin abre **WhatsApp → Conectar WhatsApp**.
2. A Meta executa o Embedded Signup e devolve código, WABA e número.
3. `whatsapp-admin` troca o código no servidor, obtém o token de integração
   específico do cliente e assina o app na WABA.
4. O token operacional é cifrado com AES-GCM e isolado por `tenant_id`.
5. Mensagens recebidas, enviadas e estados de entrega aparecem na conversa.

## Chamadas autenticadas

Todas as operações administrativas usam `POST /functions/v1/whatsapp-admin`,
JWT do usuário no header `Authorization` e `tenantId` no corpo. A função aceita:

- `status`
- `complete_embedded_signup`
- `templates`
- `send_text`
- `send_template`
- `disconnect`

Para templates com variáveis, envie `components` no mesmo formato aceito pela
Cloud API. Mensagem de texto livre só é permitida pela Meta dentro da janela de
atendimento de 24 horas; fora dela, use um template aprovado.

O contrato completo está em
[`whatsapp-meta.openapi.yaml`](whatsapp-meta.openapi.yaml) e será publicado em
`/api/whatsapp-openapi.yaml`.

## Segurança e idempotência

- O browser nunca recebe App Secret, system token ou token operacional da WABA.
- Somente owner/admin (ou Conta Geral com suporte temporário ativo) altera a
  conexão ou envia.
- RLS limita conversas e mensagens ao escritório.
- Eventos são deduplicados pelo ID da mensagem e mudança de status.
- Reentregas da Meta respondem `200` sem duplicar a conversa.
